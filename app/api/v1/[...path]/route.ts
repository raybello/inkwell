import type { NextRequest } from "next/server";
import { apiError, withApi } from "@/lib/api/respond";
import type { ApiMeta } from "@/lib/api/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Unknown `/api/v1/*` paths still answer in the standard error envelope, so an
 * agent never has to parse an HTML error page.
 */
async function notFound(request: NextRequest, _ctx: unknown, meta: ApiMeta) {
  return apiError(
    404,
    "not_found",
    `No API endpoint matches ${request.method} ${request.nextUrl.pathname}.`,
    undefined,
    meta,
  );
}

export const GET = withApi(notFound);
export const POST = withApi(notFound);
export const PATCH = withApi(notFound);
export const PUT = withApi(notFound);
export const DELETE = withApi(notFound);
