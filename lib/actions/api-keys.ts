"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { clampRpm, generateApiKey, hashApiKey, normalizeScopes } from "@/lib/api/keys";

export interface ApiKeyActionResult {
  ok: boolean;
  error?: string;
  /** Full key — returned exactly once, on creation. */
  key?: string;
  keyId?: string;
}

const MAX_KEYS_PER_WORKSPACE = 25;

export async function createApiKeyAction(input: {
  name: string;
  scopes: string[];
  rpm?: number;
}): Promise<ApiKeyActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const name = input.name.trim().slice(0, 80);
  if (!name) return { ok: false, error: "Give the key a name so you can recognise it later." };

  const scopes = normalizeScopes(input.scopes);
  if (!scopes.length) return { ok: false, error: "Select at least one scope." };

  const rpm = clampRpm(input.rpm ?? 100);

  const supabase = await createClient();
  const { count } = await supabase
    .from("api_keys")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", user.id)
    .is("revoked_at", null);
  if ((count ?? 0) >= MAX_KEYS_PER_WORKSPACE) {
    return { ok: false, error: `You already have ${MAX_KEYS_PER_WORKSPACE} active keys. Revoke one first.` };
  }

  const generated = generateApiKey();
  // Defensive: the helper and the value stored must agree.
  if (generated.hash !== hashApiKey(generated.key)) {
    return { ok: false, error: "Could not generate a key. Try again." };
  }

  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      workspace_id: user.id,
      name,
      prefix: generated.prefix,
      key_hash: generated.hash,
      scopes,
      rate_limit_rpm: rpm,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) return { ok: false, error: error?.message ?? "Could not create the key." };

  revalidatePath("/app/settings/api");
  return { ok: true, key: generated.key, keyId: data.id };
}

export async function revokeApiKeyAction(id: string): Promise<ApiKeyActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("workspace_id", user.id)
    .is("revoked_at", null);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/app/settings/api");
  return { ok: true, keyId: id };
}
