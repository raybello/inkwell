import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withApi, json, apiError } from "@/lib/api/respond";
import { authorize } from "@/lib/api/auth";
import { getApiProject } from "@/lib/api/projects";
import { processExportJob, serializeExportJob } from "@/lib/api/export-jobs";
import type { ExportJob } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ jobId: string }> };

/** GET /api/v1/exports/:jobId — poll an export job; includes `download_url` when done. */
export const GET = withApi<Ctx>(async (request: NextRequest, ctx, meta) => {
  const auth = await authorize(request, meta, "projects:read");
  if (!auth.ok) return auth.response;

  const { jobId } = await ctx.params;
  const admin = createAdminClient();

  const load = async (): Promise<ExportJob | null> => {
    const { data, error } = await admin.from("export_jobs").select("*").eq("id", jobId).maybeSingle<ExportJob>();
    if (error) throw new Error(error.message);
    return data ?? null;
  };

  let job = await load();
  if (!job) return apiError(404, "not_found", "Export job not found.", undefined, auth.meta);

  // Ownership is checked through the job's project, never through the job id alone.
  const access = await getApiProject(auth.auth, job.project_id, "read");
  if (!access.ok) return apiError(404, "not_found", "Export job not found.", undefined, auth.meta);

  // A queued job is processed here when no external worker has claimed it yet.
  if (job.status === "queued") {
    await processExportJob(job.id);
    job = (await load()) ?? job;
  }

  return json({ data: serializeExportJob(job) }, auth.meta);
});
