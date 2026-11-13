import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { consumeRateLimit } from "@/lib/api/rate-limit";
import { hashApiKey, normalizeScopes, parseApiKey, safeHashEqual } from "@/lib/api/keys";
import { apiError } from "@/lib/api/respond";
import type { ApiAuth, ApiAuthResult, ApiMeta, ApiScope } from "@/lib/api/types";

interface ApiKeyRow {
  id: string;
  workspace_id: string;
  prefix: string;
  key_hash: string;
  scopes: string[] | null;
  rate_limit_rpm: number | null;
  revoked_at: string | null;
}

/**
 * Validates `Authorization: Bearer ink_live_<prefix>_<secret>` against
 * `api_keys.key_hash` (sha256, constant-time compared). Runs on the admin client
 * because API calls carry no session cookie — ownership is enforced separately
 * per project in `lib/api/projects.ts`.
 */
export async function authenticateApiKey(request: NextRequest): Promise<ApiAuthResult> {
  const header = request.headers.get("authorization");
  if (!header) {
    return {
      ok: false,
      status: 401,
      code: "unauthorized",
      message: "Missing Authorization header. Use `Authorization: Bearer ink_live_…`.",
    };
  }

  const bearer = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!bearer) {
    return {
      ok: false,
      status: 401,
      code: "unauthorized",
      message: "Malformed Authorization header. Expected `Bearer ink_live_…`.",
    };
  }

  const key = bearer[1].trim();
  const parsed = parseApiKey(key);
  if (!parsed) {
    return { ok: false, status: 401, code: "invalid_key", message: "This API key is not valid." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("api_keys")
    .select("id, workspace_id, prefix, key_hash, scopes, rate_limit_rpm, revoked_at")
    .eq("prefix", parsed.prefix)
    .maybeSingle<ApiKeyRow>();

  if (error) throw new Error(`api_keys lookup failed: ${error.message}`);

  if (!data || !safeHashEqual(hashApiKey(key), data.key_hash)) {
    return { ok: false, status: 401, code: "invalid_key", message: "This API key is not valid." };
  }

  if (data.revoked_at) {
    return {
      ok: false,
      status: 401,
      code: "invalid_key",
      message: "This API key has been revoked. Create a new key in Settings → API.",
    };
  }

  const rpm = data.rate_limit_rpm ?? 100;
  const rateLimit = consumeRateLimit(data.id, rpm);
  if (rateLimit.retryAfter > 0 && rateLimit.remaining < 1) {
    return {
      ok: false,
      status: 429,
      code: "rate_limited",
      message: `Rate limit exceeded (${rateLimit.limit} requests/minute). Retry in ${rateLimit.retryAfter}s.`,
      rateLimit,
    };
  }

  // Fire and forget — never block a request on usage telemetry.
  void admin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(
      () => undefined,
      () => undefined,
    );

  const auth: ApiAuth = {
    keyId: data.id,
    userId: data.workspace_id,
    keyPrefix: data.prefix,
    scopes: normalizeScopes(data.scopes ?? []),
    rateLimitRpm: rpm,
  };

  return { ok: true, auth, rateLimit };
}

export function hasScope(auth: ApiAuth, scope: ApiScope): boolean {
  return auth.scopes.includes(scope);
}

/** Returns an error response when the scope is missing, otherwise null. */
export function requireScope(
  auth: ApiAuth,
  scope: ApiScope,
  meta: ApiMeta,
): NextResponse | null {
  if (hasScope(auth, scope)) return null;
  return apiError(
    403,
    "insufficient_scope",
    `This key is missing the \`${scope}\` scope.`,
    { required: scope, granted: auth.scopes },
    meta,
  );
}

export type Authorized =
  | { ok: true; auth: ApiAuth; meta: ApiMeta }
  | { ok: false; response: NextResponse };

/**
 * One call for the common route preamble: authenticate, then check a scope.
 * The returned `meta` carries the request id and rate-limit headers that the
 * handler must pass to `json()` / `apiError()`.
 */
export async function authorize(
  request: NextRequest,
  meta: ApiMeta,
  scope: ApiScope | ApiScope[],
): Promise<Authorized> {
  const result = await authenticateApiKey(request);
  if (!result.ok) {
    return {
      ok: false,
      response: apiError(
        result.status,
        result.code,
        result.message,
        undefined,
        { ...meta, rateLimit: result.rateLimit },
        result.status === 429 && result.rateLimit
          ? { "Retry-After": String(result.rateLimit.retryAfter) }
          : undefined,
      ),
    };
  }

  const authedMeta: ApiMeta = { ...meta, rateLimit: result.rateLimit };
  const required = Array.isArray(scope) ? scope : [scope];
  for (const s of required) {
    const denial = requireScope(result.auth, s, authedMeta);
    if (denial) return { ok: false, response: denial };
  }

  return { ok: true, auth: result.auth, meta: authedMeta };
}
