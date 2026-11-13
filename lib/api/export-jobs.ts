import { createAdminClient } from "@/lib/supabase/admin";
import { uploadExport } from "@/lib/storage";
import { emitWebhookEvent } from "@/lib/webhooks";
import { generateExport } from "@/lib/export";
import type { ExportFormat, GenerateExportInput, StyleName } from "@/lib/export/types";
import type { Asset, Chapter, ExportJob, Note, Project } from "@/lib/types";

export const EXPORT_FORMATS = ["markdown", "docx", "epub", "pdf", "pdf_screen", "html", "json"] as const;
export type ApiExportFormat = (typeof EXPORT_FORMATS)[number];

export interface EnqueueExportInput {
  projectId: string;
  requestedBy: string | null;
  format: ApiExportFormat;
  styleTemplate: string;
  scope: "project" | "chapter";
  chapterId: string | null;
  options: Record<string, unknown>;
}

/** Creates a queued `export_jobs` row. */
export async function enqueueExport(input: EnqueueExportInput): Promise<ExportJob> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("export_jobs")
    .insert({
      project_id: input.projectId,
      requested_by: input.requestedBy,
      format: input.format,
      style_template: input.styleTemplate,
      scope: input.scope,
      chapter_id: input.chapterId,
      options: input.options,
      status: "queued",
      progress: 0,
    })
    .select("*")
    .single<ExportJob>();

  if (error || !data) throw new Error(error?.message ?? "Could not enqueue export.");

  const workerUrl = process.env.EXPORT_WORKER_URL;
  if (workerUrl) {
    void fetch(workerUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(process.env.EXPORT_WORKER_SECRET
          ? { authorization: `Bearer ${process.env.EXPORT_WORKER_SECRET}` }
          : {}),
      },
      body: JSON.stringify({ jobId: data.id }),
      signal: AbortSignal.timeout(5000),
    }).catch(() => undefined);
  }

  return data;
}

/**
 * Claims and runs a queued export job through `lib/export` (EPUB/PDF/DOCX/
 * Markdown/HTML/JSON), uploads the result to the public `exports` bucket, and
 * marks the row done. Emits `export.completed`.
 *
 * Concurrency-safe: the status transition `queued → processing` is the lock, so
 * the POST kick and a concurrent poll cannot generate twice.
 */
export async function processExportJob(jobId: string): Promise<ExportJob | null> {
  const admin = createAdminClient();

  const { data: claimed, error: claimError } = await admin
    .from("export_jobs")
    .update({ status: "processing", started_at: new Date().toISOString(), progress: 5 })
    .eq("id", jobId)
    .eq("status", "queued")
    .select("*")
    .maybeSingle<ExportJob>();

  if (claimError) throw new Error(claimError.message);
  if (!claimed) return null; // already claimed or finished

  const job = claimed;

  try {
    const [{ data: project }, { data: chapters }, { data: assets }, { data: notes }] = await Promise.all([
      admin.from("projects").select("*").eq("id", job.project_id).maybeSingle<Project>(),
      admin.from("chapters").select("*").eq("project_id", job.project_id).order("position", { ascending: true }),
      admin.from("assets").select("*").eq("project_id", job.project_id),
      admin.from("notes").select("*").eq("project_id", job.project_id),
    ]);

    if (!project) throw new Error("Project for this export no longer exists.");

    const options =
      typeof job.options === "object" && job.options !== null
        ? (job.options as GenerateExportInput["options"])
        : {};

    const generated = await generateExport({
      project,
      chapters: (chapters ?? []) as Chapter[],
      format: job.format as ExportFormat,
      style: (job.style_template as StyleName) ?? "literary",
      options,
      scope: job.scope,
      chapterId: job.chapter_id,
      assets: (assets ?? []) as Asset[],
      notes: (notes ?? []) as Note[],
    });

    const uploaded = await uploadExport(generated.filename, generated.bytes, generated.contentType);

    const { data: done, error: doneError } = await admin
      .from("export_jobs")
      .update({
        status: "done",
        progress: 100,
        storage_path: uploaded.path,
        download_url: uploaded.url,
        size_bytes: generated.bytes.byteLength,
        error: null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", job.id)
      .select("*")
      .single<ExportJob>();

    if (doneError || !done) throw new Error(doneError?.message ?? "Could not finalise export job.");

    void emitWebhookEvent("export.completed", job.project_id, {
      job_id: done.id,
      format: done.format,
      download_url: done.download_url,
      size_bytes: done.size_bytes,
    }).catch(() => undefined);

    return done;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Export failed.";
    const { data: failed } = await admin
      .from("export_jobs")
      .update({ status: "failed", error: message, completed_at: new Date().toISOString() })
      .eq("id", job.id)
      .select("*")
      .maybeSingle<ExportJob>();
    return failed ?? null;
  }
}

export function serializeExportJob(job: ExportJob) {
  return {
    id: job.id,
    project_id: job.project_id,
    format: job.format,
    style_template: job.style_template,
    scope: job.scope,
    chapter_id: job.chapter_id,
    status: job.status,
    progress: job.progress,
    download_url: job.download_url,
    size_bytes: job.size_bytes,
    error: job.error,
    created_at: job.created_at,
    started_at: job.started_at,
    completed_at: job.completed_at,
  };
}
