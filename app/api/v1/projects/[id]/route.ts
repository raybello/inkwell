import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withApi, json, apiError } from "@/lib/api/respond";
import { authorize } from "@/lib/api/auth";
import { updateProjectSchema } from "@/lib/api/schemas";
import { getApiProject } from "@/lib/api/projects";
import { serializeProject } from "@/lib/api/serialize";
import { validateBody } from "@/lib/api/validate";
import { emitWebhookEvent } from "@/lib/webhooks";
import type { Project } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function statsFor(projectId: string) {
  const admin = createAdminClient();
  const [{ data: chapters }, { data: assets }] = await Promise.all([
    admin.from("chapters").select("id, word_count").eq("project_id", projectId),
    admin.from("assets").select("id").eq("project_id", projectId),
  ]);
  return {
    chapter_count: chapters?.length ?? 0,
    word_count: (chapters ?? []).reduce(
      (sum: number, row: { word_count: number }) => sum + (row.word_count ?? 0),
      0,
    ),
    asset_count: assets?.length ?? 0,
  };
}

export const GET = withApi<Ctx>(async (request: NextRequest, ctx, meta) => {
  const auth = await authorize(request, meta, "projects:read");
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const access = await getApiProject(auth.auth, id, "read");
  if (!access.ok) return apiError(access.status, access.code, access.message, undefined, auth.meta);

  const stats = await statsFor(id);
  return json(
    { data: serializeProject(access.project, { role: access.role, ...stats }) },
    auth.meta,
  );
});

export const PATCH = withApi<Ctx>(async (request: NextRequest, ctx, meta) => {
  const auth = await authorize(request, meta, "projects:write");
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const access = await getApiProject(auth.auth, id, "write");
  if (!access.ok) return apiError(access.status, access.code, access.message, undefined, auth.meta);

  const body = await validateBody(request, updateProjectSchema, auth.meta);
  if (!body.ok) return body.response;

  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body.data)) {
    if (value !== undefined) patch[key] = value;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("projects")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single<Project>();

  if (error || !data) {
    return apiError(500, "internal_error", error?.message ?? "Could not update project.", undefined, auth.meta);
  }

  void emitWebhookEvent("project.updated", id, {
    id,
    fields: Object.keys(patch),
  }).catch(() => undefined);

  return json({ data: serializeProject(data, { role: access.role }) }, auth.meta);
});

export const DELETE = withApi<Ctx>(async (request: NextRequest, ctx, meta) => {
  const auth = await authorize(request, meta, "projects:write");
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const access = await getApiProject(auth.auth, id, "write");
  if (!access.ok) return apiError(access.status, access.code, access.message, undefined, auth.meta);

  if (access.role !== "owner") {
    return apiError(403, "forbidden", "Only the project owner can delete a project.", undefined, auth.meta);
  }

  const admin = createAdminClient();
  const { error } = await admin.from("projects").delete().eq("id", id);
  if (error) return apiError(500, "internal_error", error.message, undefined, auth.meta);

  return json({ data: { id, deleted: true } }, auth.meta);
});
