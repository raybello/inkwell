import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withApi, json, apiError } from "@/lib/api/respond";
import { authorize } from "@/lib/api/auth";
import { reorderChaptersSchema } from "@/lib/api/schemas";
import { getApiProject } from "@/lib/api/projects";
import { validateBody } from "@/lib/api/validate";
import { emitWebhookEvent } from "@/lib/webhooks";
import type { Chapter } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Body: `{ order: [{ id, position?, parent_id? }, ...] }`
 * The array is applied in order: each entry's `position` defaults to its index.
 */
export const POST = withApi<Ctx>(async (request: NextRequest, ctx, meta) => {
  const auth = await authorize(request, meta, "chapters:write");
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const access = await getApiProject(auth.auth, id, "write");
  if (!access.ok) return apiError(access.status, access.code, access.message, undefined, auth.meta);

  const body = await validateBody(request, reorderChaptersSchema, auth.meta);
  if (!body.ok) return body.response;

  const admin = createAdminClient();
  const { data: existing, error: loadError } = await admin
    .from("chapters")
    .select("id")
    .eq("project_id", id);
  if (loadError) return apiError(500, "internal_error", loadError.message, undefined, auth.meta);

  const known = new Set((existing ?? []).map((row: { id: string }) => row.id));
  const unknown = body.data.order.filter((entry) => !known.has(entry.id)).map((entry) => entry.id);
  if (unknown.length) {
    return apiError(422, "validation_error", "Some chapter ids do not belong to this project.", { ids: unknown }, auth.meta);
  }

  const seen = new Set<string>();
  for (const entry of body.data.order) {
    if (seen.has(entry.id)) {
      return apiError(422, "validation_error", "Duplicate chapter ids in `order`.", { id: entry.id }, auth.meta);
    }
    seen.add(entry.id);
    if (entry.parent_id && !known.has(entry.parent_id)) {
      return apiError(422, "validation_error", "`parent_id` does not belong to this project.", { id: entry.parent_id }, auth.meta);
    }
  }

  for (const [index, entry] of body.data.order.entries()) {
    const patch: Record<string, unknown> = { position: entry.position ?? index };
    if (entry.parent_id !== undefined) patch.parent_id = entry.parent_id;
    const { error } = await admin
      .from("chapters")
      .update(patch)
      .eq("id", entry.id)
      .eq("project_id", id);
    if (error) return apiError(500, "internal_error", error.message, undefined, auth.meta);
  }

  const { data: chapters } = await admin
    .from("chapters")
    .select("*")
    .eq("project_id", id)
    .order("position", { ascending: true });

  void emitWebhookEvent("chapter.updated", id, {
    operation: "reorder",
    count: body.data.order.length,
  }).catch(() => undefined);

  return json(
    {
      data: ((chapters ?? []) as Chapter[]).map((chapter) => ({
        id: chapter.id,
        parent_id: chapter.parent_id,
        position: chapter.position,
        title: chapter.title,
      })),
    },
    auth.meta,
  );
});
