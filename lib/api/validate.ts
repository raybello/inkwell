import type { NextRequest } from "next/server";
import type { z } from "zod";
import { apiError } from "@/lib/api/respond";
import { zodDetails } from "@/lib/api/schemas";
import type { ApiMeta } from "@/lib/api/types";

export type Validated<T> = { ok: true; data: T } | { ok: false; response: Response };

/** Parses and validates a JSON body, returning a 422 envelope on failure. */
export async function validateBody<S extends z.ZodTypeAny>(
  request: NextRequest,
  schema: S,
  meta: ApiMeta,
): Promise<Validated<z.infer<S>>> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return {
      ok: false,
      response: apiError(400, "validation_error", "Request body must be valid JSON.", undefined, meta),
    };
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      response: apiError(422, "validation_error", "Request body failed validation.", zodDetails(parsed.error), meta),
    };
  }
  return { ok: true, data: parsed.data as z.infer<S> };
}

/** Validates search params against a zod object schema (coerces numbers). */
export function validateQuery<S extends z.ZodTypeAny>(
  request: NextRequest,
  schema: S,
  meta: ApiMeta,
): Validated<z.infer<S>> {
  const raw: Record<string, string> = {};
  request.nextUrl.searchParams.forEach((value, key) => {
    raw[key] = value;
  });
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: apiError(422, "validation_error", "Query parameters failed validation.", zodDetails(parsed.error), meta),
    };
  }
  return { ok: true, data: parsed.data as z.infer<S> };
}
