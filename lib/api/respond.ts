import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { ApiMeta, RateLimitInfo } from "@/lib/api/types";

export type JsonInit = {
  status?: number;
  headers?: Record<string, string>;
};

function rateLimitHeaders(info: RateLimitInfo): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(info.limit),
    "X-RateLimit-Remaining": String(Math.max(0, info.remaining)),
    "X-RateLimit-Reset": String(info.reset),
  };
}

function baseHeaders(meta?: ApiMeta): Record<string, string> {
  const headers: Record<string, string> = {};
  if (meta?.requestId) headers["X-Request-Id"] = meta.requestId;
  if (meta?.rateLimit) Object.assign(headers, rateLimitHeaders(meta.rateLimit));
  return headers;
}

/** Success envelope: `{ data: ... }`. Callers may add fields (e.g. pagination). */
export function json(body: Record<string, unknown>, meta?: ApiMeta, init: JsonInit = {}) {
  return NextResponse.json(body, {
    status: init.status ?? 200,
    headers: { ...baseHeaders(meta), ...(init.headers ?? {}) },
  });
}

/** Convenience: `json({ data }, meta)` for the common single-object response. */
export function jsonData(data: unknown, meta?: ApiMeta, init: JsonInit = {}) {
  return json({ data }, meta, init);
}

/** Plain-text response (used for `?format=md` chapter reads). */
export function text(body: string, meta?: ApiMeta, init: JsonInit = {}) {
  return new NextResponse(body, {
    status: init.status ?? 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      ...baseHeaders(meta),
      ...(init.headers ?? {}),
    },
  });
}

export function apiError(
  status: number,
  code: string,
  message: string,
  details?: unknown,
  meta?: ApiMeta,
  headers?: Record<string, string>,
) {
  return NextResponse.json(
    { error: { code, message, ...(details === undefined ? {} : { details }) } },
    { status, headers: { ...baseHeaders(meta), ...(headers ?? {}) } },
  );
}

export const ERROR_CODES = {
  unauthorized: "Missing or malformed API key.",
  invalid_key: "The API key is unknown or has been revoked.",
  insufficient_scope: "The key does not have the required scope.",
  forbidden: "The key's workspace cannot access this resource.",
  not_found: "The requested resource does not exist.",
  validation_error: "The request body or query is invalid.",
  rate_limited: "Too many requests for this key.",
  conflict: "The request conflicts with the current state.",
  unsupported: "The requested capability is not available.",
  internal_error: "An unexpected error occurred.",
} as const;

type RouteHandler<C> = (req: NextRequest, ctx: C, meta: ApiMeta) => Promise<Response>;

/**
 * Wraps a route handler so that:
 *  - a request id is generated (or the caller's `X-Request-Id` echoed),
 *  - thrown errors become a predictable 500 envelope,
 *  - the request id is present on every response.
 *
 * The route context is optional so the same wrapper works for static routes
 * (no params) and dynamic ones (`{ params: Promise<{ id: string }> }`).
 */
export function withApi<C = any>(handler: RouteHandler<C>) {
  // Next 15.5 requires the second argument to be RouteContext-compatible; `any`
  // keeps the wrapper usable for both static routes and dynamic `{ params }`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return async (req: NextRequest, ctx: any): Promise<Response> => {
    const incoming = req.headers.get("x-request-id")?.slice(0, 64);
    const meta: ApiMeta = { requestId: incoming && incoming.trim() ? incoming : crypto.randomUUID() };
    try {
      return await handler(req, ctx as C, meta);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error(`[api] ${req.method} ${req.nextUrl.pathname} request_id=${meta.requestId}:`, error);
      return apiError(
        500,
        "internal_error",
        "An unexpected error occurred. Quote the request id when reporting this.",
        process.env.NODE_ENV === "development" ? { message } : undefined,
        meta,
      );
    }
  };
}
