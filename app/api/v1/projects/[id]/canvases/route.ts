import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withApi, json, apiError } from "@/lib/api/respond";
import { authorize } from "@/lib/api/auth";
import { getApiProject } from "@/lib/api/projects";
import type { Canvas } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function elementCount(content: unknown): number {
  if (typeof content !== "object" || content === null) return 0;
  const elements = (content as Record<string, unknown>).elements;
  return Array.isArray(elements) ? elements.length : 0;
}

/** GET /api/v1/projects/:id/canvases — canvas boards with element counts. */
export const GET = withApi<Ctx>(async (request: NextRequest, ctx, meta) => {
  const auth = await authorize(request, meta, "chapters:read");
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const access = await getApiProject(auth.auth, id, "read");
  if (!access.ok) return apiError(access.status, access.code, access.message, undefined, auth.meta);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("canvases")
    .select("*")
    .eq("project_id", id)
    .order("updated_at", { ascending: false });
  if (error) return apiError(500, "internal_error", error.message, undefined, auth.meta);

  return json(
    {
      data: ((data ?? []) as Canvas[]).map((canvas) => ({
        id: canvas.id,
        name: canvas.name,
        thumbnail_url: canvas.thumbnail_url,
        element_count: elementCount(canvas.content),
        created_at: canvas.created_at,
        updated_at: canvas.updated_at,
      })),
    },
    auth.meta,
  );
});
