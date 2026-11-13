"use server";

import { createHmac, randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth";
import type { Webhook } from "@/lib/types";
import {
  WEBHOOK_EVENTS,
  type WebhookDeliveryView,
  type WebhookEventName,
} from "@/components/webhooks/types";

interface ActionResult {
  ok: boolean;
  error?: string;
}

function sanitizeUrl(input: string): { url: string } | { error: string } {
  let parsed: URL;
  try {
    parsed = new URL(input.trim());
  } catch {
    return { error: "Enter a valid URL, including the scheme." };
  }
  const host = parsed.hostname.toLowerCase();
  const isLocal = host === "localhost" || host === "127.0.0.1" || host === "::1";
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && isLocal)) {
    return { error: "Webhook endpoints must use HTTPS (http is allowed for localhost during development)." };
  }
  return { url: parsed.toString() };
}

async function assertOwner(projectId: string): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  const supabase = await createClient();
  const { data: role } = await supabase.rpc("project_role", { p: projectId });
  if (role !== "owner") return { ok: false, error: "Only the project owner can manage webhooks." };
  return { ok: true, userId: user.id };
}

function sign(secret: string, body: string) {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export async function getWebhooksState(projectId: string): Promise<{
  ok: boolean;
  isOwner: boolean;
  hooks: Webhook[];
  deliveries: WebhookDeliveryView[];
  error?: string;
}> {
  const user = await getSessionUser();
  if (!user) return { ok: false, isOwner: false, hooks: [], deliveries: [], error: "Not signed in." };

  const supabase = await createClient();
  const { data: role } = await supabase.rpc("project_role", { p: projectId });
  if (role !== "owner") return { ok: true, isOwner: false, hooks: [], deliveries: [] };

  const { data: hooks, error } = await supabase
    .from("webhooks")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) return { ok: false, isOwner: true, hooks: [], deliveries: [], error: error.message };

  const ids = (hooks ?? []).map((hook: Webhook) => hook.id);
  let deliveries: WebhookDeliveryView[] = [];
  if (ids.length) {
    const { data } = await supabase
      .from("webhook_deliveries")
      .select("id, webhook_id, event, status_code, ok, attempts, error, created_at, payload")
      .in("webhook_id", ids)
      .order("created_at", { ascending: false })
      .limit(200);
    deliveries = (data ?? []) as WebhookDeliveryView[];
  }

  return { ok: true, isOwner: true, hooks: (hooks ?? []) as Webhook[], deliveries };
}

export async function createWebhookAction(input: {
  projectId: string;
  url: string;
  events: string[];
  active?: boolean;
}): Promise<ActionResult & { id?: string }> {
  const owner = await assertOwner(input.projectId);
  if (!owner.ok) return { ok: false, error: owner.error };

  const parsed = sanitizeUrl(input.url);
  if ("error" in parsed) return { ok: false, error: parsed.error };

  const events = input.events.filter((e): e is WebhookEventName =>
    (WEBHOOK_EVENTS as readonly string[]).includes(e),
  );
  if (!events.length) return { ok: false, error: "Select at least one event." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("webhooks")
    .insert({
      project_id: input.projectId,
      url: parsed.url,
      events,
      active: input.active ?? true,
      created_by: owner.userId,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) return { ok: false, error: error?.message ?? "Could not create the webhook." };
  return { ok: true, id: data.id };
}

export async function updateWebhookAction(input: {
  projectId: string;
  id: string;
  url?: string;
  events?: string[];
  active?: boolean;
}): Promise<ActionResult> {
  const owner = await assertOwner(input.projectId);
  if (!owner.ok) return { ok: false, error: owner.error };

  const patch: Record<string, unknown> = {};
  if (input.url !== undefined) {
    const parsed = sanitizeUrl(input.url);
    if ("error" in parsed) return { ok: false, error: parsed.error };
    patch.url = parsed.url;
  }
  if (input.events !== undefined) {
    const events = input.events.filter((e): e is WebhookEventName =>
      (WEBHOOK_EVENTS as readonly string[]).includes(e),
    );
    if (!events.length) return { ok: false, error: "Select at least one event." };
    patch.events = events;
  }
  if (input.active !== undefined) patch.active = input.active;
  if (!Object.keys(patch).length) return { ok: false, error: "Nothing to update." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("webhooks")
    .update(patch)
    .eq("id", input.id)
    .eq("project_id", input.projectId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteWebhookAction(input: { projectId: string; id: string }): Promise<ActionResult> {
  const owner = await assertOwner(input.projectId);
  if (!owner.ok) return { ok: false, error: owner.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("webhooks")
    .delete()
    .eq("id", input.id)
    .eq("project_id", input.projectId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

async function deliver(input: {
  projectId: string;
  hook: Webhook;
  event: string;
  data: Record<string, unknown>;
}): Promise<{ ok: boolean; statusCode: number | null; error?: string }> {
  const body = JSON.stringify({
    id: randomUUID(),
    event: input.event,
    project_id: input.projectId,
    created_at: new Date().toISOString(),
    data: input.data,
  });

  const admin = createAdminClient();
  try {
    const response = await fetch(input.hook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Inkwell-Event": input.event,
        "X-Inkwell-Signature": `sha256=${sign(input.hook.secret, body)}`,
      },
      body,
      signal: AbortSignal.timeout(8000),
    });
    await admin.from("webhook_deliveries").insert({
      webhook_id: input.hook.id,
      event: input.event,
      payload: { event: input.event, projectId: input.projectId, data: input.data },
      status_code: response.status,
      ok: response.ok,
      attempts: 1,
      error: response.ok ? null : `HTTP ${response.status}`,
    });
    return { ok: response.ok, statusCode: response.status, error: response.ok ? undefined : `HTTP ${response.status}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : "request failed";
    await admin.from("webhook_deliveries").insert({
      webhook_id: input.hook.id,
      event: input.event,
      payload: { event: input.event, projectId: input.projectId, data: input.data },
      status_code: null,
      ok: false,
      attempts: 1,
      error: message,
    });
    return { ok: false, statusCode: null, error: message };
  }
}

export async function testWebhookAction(input: {
  projectId: string;
  id: string;
}): Promise<{ ok: boolean; statusCode?: number | null; error?: string }> {
  const owner = await assertOwner(input.projectId);
  if (!owner.ok) return { ok: false, error: owner.error };

  const supabase = await createClient();
  const { data: hook } = await supabase
    .from("webhooks")
    .select("*")
    .eq("id", input.id)
    .eq("project_id", input.projectId)
    .maybeSingle<Webhook>();
  if (!hook) return { ok: false, error: "Webhook not found." };

  const result = await deliver({
    projectId: input.projectId,
    hook,
    event: "chapter.created",
    data: {
      id: randomUUID(),
      title: "Test chapter",
      status: "draft",
      word_count: 128,
      synopsis: "Sample payload from the Inkwell webhook tester.",
      test: true,
    },
  });
  return result;
}

export async function retryDeliveryAction(input: {
  projectId: string;
  deliveryId: string;
}): Promise<{ ok: boolean; statusCode?: number | null; error?: string }> {
  const owner = await assertOwner(input.projectId);
  if (!owner.ok) return { ok: false, error: owner.error };

  const supabase = await createClient();
  const { data: delivery } = await supabase
    .from("webhook_deliveries")
    .select("id, webhook_id, event, payload")
    .eq("id", input.deliveryId)
    .maybeSingle<{ id: string; webhook_id: string; event: string; payload: Record<string, unknown> }>();
  if (!delivery) return { ok: false, error: "Delivery not found." };

  const { data: hook } = await supabase
    .from("webhooks")
    .select("*")
    .eq("id", delivery.webhook_id)
    .eq("project_id", input.projectId)
    .maybeSingle<Webhook>();
  if (!hook) return { ok: false, error: "Webhook not found." };

  const data =
    delivery.payload && typeof delivery.payload.data === "object" && delivery.payload.data !== null
      ? (delivery.payload.data as Record<string, unknown>)
      : {};

  return deliver({ projectId: input.projectId, hook, event: delivery.event, data });
}
