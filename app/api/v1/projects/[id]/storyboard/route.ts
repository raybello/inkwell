import type { NextRequest } from "next/server";
import { withApi, json, apiError } from "@/lib/api/respond";
import { authorize } from "@/lib/api/auth";
import { getApiProject } from "@/lib/api/projects";
import { listStoryboard } from "@/lib/api/storyboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/v1/projects/:id/storyboard — cards joined with chapter titles and images. */
export const GET = withApi<Ctx>(async (request: NextRequest, ctx, meta) => {
  const auth = await authorize(request, meta, "chapters:read");
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const access = await getApiProject(auth.auth, id, "read");
  if (!access.ok) return apiError(access.status, access.code, access.message, undefined, auth.meta);

  const cards = await listStoryboard(id);
  return json({ data: cards, count: cards.length }, auth.meta);
});
