import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { API_SCOPES, type ApiScope } from "@/lib/api/types";

/**
 * Key format: `ink_live_<prefix>_<secret>`
 *  - prefix: 12 url-safe chars, stored in `api_keys.prefix` so the UI can show it
 *  - secret: 32 random bytes, base64url
 *  - only sha256(full key) is stored, in `api_keys.key_hash`
 */

const KEY_PREFIX = "ink_live";
const PREFIX_LENGTH = 12;

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex");
}

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const prefix = randomBytes(9).toString("base64url").slice(0, PREFIX_LENGTH);
  const secret = randomBytes(32).toString("base64url");
  const key = `${KEY_PREFIX}_${prefix}_${secret}`;
  return { key, prefix, hash: hashApiKey(key) };
}

/** Parse without trusting: returns null unless the shape matches exactly. */
export function parseApiKey(key: string): { prefix: string } | null {
  const match = /^ink_live_([A-Za-z0-9_-]{6,24})_([A-Za-z0-9_-]{20,})$/.exec(key.trim());
  if (!match) return null;
  return { prefix: match[1] };
}

/** Constant-time hash comparison. Length is fixed (sha256 hex), so no length leak. */
export function safeHashEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
  } catch {
    return false;
  }
}

export function normalizeScopes(input: unknown): ApiScope[] {
  if (!Array.isArray(input)) return [];
  return Array.from(
    new Set(
      input.filter(
        (s): s is ApiScope => typeof s === "string" && (API_SCOPES as readonly string[]).includes(s),
      ),
    ),
  );
}

export function clampRpm(input: unknown, fallback = 100): number {
  const n = typeof input === "number" ? input : Number(input);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(6000, Math.max(1, Math.round(n)));
}

export function isApiScope(value: string): value is ApiScope {
  return (API_SCOPES as readonly string[]).includes(value);
}
