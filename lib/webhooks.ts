import { createHmac, randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export type WebhookEvent =
  | "chapter.created"
  | "chapter.updated"
  | "chapter.deleted"
  | "asset.uploaded"
  | "export.completed"
  | "comment.created"
  | "project.updated";

export interface WebhookPayload {
  event: WebhookEvent;
  projectId: string;
  data: Record<string, unknown>;
}

function sign(secret: string, body: string) {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export async function emitWebhookEvent(event: WebhookEvent, projectId: string, data: Record<string, unknown>) {
  const admin = createAdminClient();
  const { data: hooks } = await admin
    .from("webhooks")
    .select("*")
    .eq("project_id", projectId)
    .eq("active", true);

  if (!hooks?.length) return { delivered: 0 };

  const payload: WebhookPayload = { event, projectId, data };
  const body = JSON.stringify({
    id: randomUUID(),
    event,
    project_id: projectId,
    created_at: new Date().toISOString(),
    data,
  });

  let delivered = 0;
  for (const hook of hooks) {
    if (hook.events?.length && !hook.events.includes(event)) continue;
    const attempt = async (n: number): Promise<void> => {
      try {
        const res = await fetch(hook.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Inkwell-Event": event,
            "X-Inkwell-Signature": `sha256=${sign(hook.secret, body)}`,
          },
          body,
          signal: AbortSignal.timeout(8000),
        });
        await admin.from("webhook_deliveries").insert({
          webhook_id: hook.id,
          event,
          payload,
          status_code: res.status,
          ok: res.ok,
          attempts: n,
          error: res.ok ? null : `HTTP ${res.status}`,
        });
        if (res.ok) delivered += 1;
        else if (n < 3) {
          await new Promise((r) => setTimeout(r, 400 * n));
          await attempt(n + 1);
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "request failed";
        if (n < 3) {
          await new Promise((r) => setTimeout(r, 400 * n));
          return attempt(n + 1);
        }
        await admin.from("webhook_deliveries").insert({
          webhook_id: hook.id,
          event,
          payload,
          status_code: null,
          ok: false,
          attempts: n,
          error: message,
        });
      }
    };
    await attempt(1);
  }

  return { delivered };
}
