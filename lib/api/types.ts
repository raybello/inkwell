/**
 * Shared types for the public Agent API (v1).
 *
 * The API is deliberately boring: every success response is `{ data: ... }`,
 * every failure is `{ error: { code, message, details? } }`, and every response
 * carries an `X-Request-Id` header.
 */

export const API_SCOPES = [
  "projects:read",
  "projects:write",
  "chapters:read",
  "chapters:write",
  "assets:read",
  "assets:write",
  "storyboard:write",
  "canvases:write",
  "exports:write",
  "ai:write",
] as const;

export type ApiScope = (typeof API_SCOPES)[number];

export const SCOPE_DESCRIPTIONS: Record<ApiScope, string> = {
  "projects:read": "List and read projects, and poll export job status.",
  "projects:write": "Create, update and delete projects.",
  "chapters:read": "Read chapters, storyboard cards and canvases.",
  "chapters:write": "Create, update, delete and reorder chapters and blocks.",
  "assets:read": "List a project's asset library.",
  "assets:write": "Upload and delete assets.",
  "storyboard:write": "Pin and unpin storyboard images.",
  "canvases:write": "Add elements to canvases.",
  "exports:write": "Trigger exports.",
  "ai:write": "Generate text and images with the workspace AI provider.",
};

export interface RateLimitInfo {
  /** Requests allowed per minute for this key. */
  limit: number;
  /** Tokens left in the current bucket. */
  remaining: number;
  /** Unix seconds when the bucket refills to full. */
  reset: number;
  /** Seconds to wait before retrying (only meaningful on a 429). */
  retryAfter: number;
}

export interface ApiMeta {
  requestId: string;
  rateLimit?: RateLimitInfo;
}

export interface ApiAuth {
  keyId: string;
  /** Workspace owner the key belongs to. */
  userId: string;
  keyPrefix: string;
  scopes: ApiScope[];
  rateLimitRpm: number;
}

export type ApiAuthResult =
  | { ok: true; auth: ApiAuth; rateLimit: RateLimitInfo }
  | { ok: false; status: number; code: string; message: string; rateLimit?: RateLimitInfo };

export type ProjectRole = "owner" | "editor" | "reviewer" | "viewer";
