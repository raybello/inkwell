import type { NextRequest } from "next/server";
import { withApi, json, apiError } from "@/lib/api/respond";
import { authorize } from "@/lib/api/auth";
import { getApiProject } from "@/lib/api/projects";
import { removeProjectAsset } from "@/lib/api/assets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; aid: string }> };

export const DELETE = withApi<Ctx>(async (request: NextRequest, ctx, meta) => {
  const auth = await authorize(request, meta, "assets:write");
  if (!auth.ok) return auth.response;

  const { id, aid } = await ctx.params;
  const access = await getApiProject(auth.auth, id, "write");
  if (!access.ok) return apiError(access.status, access.code, access.message, undefined, auth.meta);

  const removed = await removeProjectAsset(id, aid);
  if (!removed) return apiError(404, "not_found", "Asset not found.", undefined, auth.meta);

  return json({ data: { id: aid, deleted: true } }, auth.meta);
});
