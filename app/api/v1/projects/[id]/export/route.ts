import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withApi, json, apiError } from "@/lib/api/respond";
import { authorize } from "@/lib/api/auth";
import { createExportSchema } from "@/lib/api/schemas";
import { getApiProject } from "@/lib/api/projects";
import { enqueueExport, processExportJob, serializeExportJob } from "@/lib/api/export-jobs";
import { validateBody } from "@/lib/api/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/v1/projects/:id/export — enqueue an export job.
 *
 * Responds 202 with the job row. Poll `GET /api/v1/exports/:jobId` until
 * `status` is `done` (then read `download_url`) or `failed`.
 */
export const POST = withApi<Ctx>(async (request: NextRequest, ctx, meta) => {
  const auth = await authorize(request, meta, "exports:write");
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const access = await getApiProject(auth.auth, id, "write");
  if (!access.ok) return apiError(access.status, access.code, access.message, undefined, auth.meta);

  const body = await validateBody(request, createExportSchema, auth.meta);
  if (!body.ok) return body.response;

  const chapterId = body.data.chapter_id ?? null;
  if (body.data.scope === "chapter" && !chapterId) {
    return apiError(422, "validation_error", "`chapter_id` is required when `scope` is `chapter`.", undefined, auth.meta);
  }

  if (chapterId) {
    const admin = createAdminClient();
    const { data: chapter } = await admin
      .from("chapters")
      .select("id")
      .eq("id", chapterId)
      .eq("project_id", id)
      .maybeSingle<{ id: string }>();
    if (!chapter) {
      return apiError(422, "validation_error", "`chapter_id` does not belong to this project.", undefined, auth.meta);
    }
  }

  const job = await enqueueExport({
    projectId: id,
    requestedBy: auth.auth.userId,
    format: body.data.format,
    styleTemplate: body.data.style_template,
    scope: body.data.scope,
    chapterId,
    options: body.data.options ?? {},
  });

  // Best-effort inline processing: the job row is the source of truth, and the
  // poll endpoint can also claim it. Never block the 202 on generation.
  void processExportJob(job.id).catch(() => undefined);

  return json({ data: serializeExportJob(job) }, auth.meta, {
    status: 202,
    headers: { Location: `/api/v1/exports/${job.id}` },
  });
});
