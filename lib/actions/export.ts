"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { emitWebhookEvent } from "@/lib/webhooks";
import { uploadExport } from "@/lib/storage";
import { generateExport, resolveStyle, FORMAT_META } from "@/lib/export";
import type { ExportFormat, ExportOptions } from "@/lib/export/types";
import type { Chapter, ExportJob, Project } from "@/lib/types";

export interface StartExportInput {
  projectId: string;
  format: ExportFormat;
  style?: string;
  scope?: "project" | "chapter";
  chapterId?: string | null;
  options?: ExportOptions;
}

export type ExportActionResult =
  | { ok: true; job: ExportJob }
  | { ok: false; error: string; job?: ExportJob };

const FORMATS = new Set<ExportFormat>(["markdown", "docx", "epub", "pdf", "pdf_screen", "html", "json"]);
const PAGE_SIZES = new Set(["6x9", "a5", "a4"]);

function safeOptions(input: ExportOptions | undefined): ExportOptions {
  const opts = input ?? {};
  return {
    includeCover: opts.includeCover !== false,
    includeToc: opts.includeToc !== false,
    includeSynopses: opts.includeSynopses === true,
    dropCaps: opts.dropCaps === true ? true : opts.dropCaps === false ? false : undefined,
    chapterBreaks: opts.chapterBreaks !== false,
    pageSize: opts.pageSize && PAGE_SIZES.has(opts.pageSize) ? opts.pageSize : undefined,
    language: typeof opts.language === "string" ? opts.language.slice(0, 12) : undefined,
    author: typeof opts.author === "string" ? opts.author.slice(0, 120) : undefined,
  };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : "The export could not be generated.";
}

/**
 * Generate an export synchronously and keep the `export_jobs` row in sync.
 * Row-level security means only owners/editors can create jobs for a project.
 */
async function executeJob(jobId: string): Promise<ExportActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "You need to sign in to export." };

  const supabase = await createClient();
  // `export_jobs` has select/insert RLS policies but no update policy; status
  // transitions are written with the service client after role verification.
  const admin = createAdminClient();
  const { data: jobRow, error: jobError } = await supabase
    .from("export_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();
  if (jobError || !jobRow) return { ok: false, error: "Export job not found." };
  const job = jobRow as ExportJob;

  const { data: projectRow } = await supabase.from("projects").select("*").eq("id", job.project_id).maybeSingle();
  if (!projectRow) return { ok: false, error: "Project not found or you no longer have access." };
  const project = projectRow as Project;

  const { data: role } = await supabase.rpc("project_role", { p: job.project_id });
  if (role !== "owner" && role !== "editor") {
    return { ok: false, error: "Only editors and the owner can export this project." };
  }

  const options = safeOptions(job.options as ExportOptions);
  const format = job.format as ExportFormat;
  if (!FORMATS.has(format) || !FORMAT_META[format]) {
    await admin.from("export_jobs").update({ status: "failed", error: "Unknown export format", completed_at: new Date().toISOString() }).eq("id", job.id);
    return { ok: false, error: "Unknown export format." };
  }

  await admin
    .from("export_jobs")
    .update({ status: "processing", progress: 10, started_at: new Date().toISOString(), error: null })
    .eq("id", job.id);

  try {
    let query = supabase.from("chapters").select("*").eq("project_id", project.id).order("position", { ascending: true });
    if (job.scope === "chapter" && job.chapter_id) query = query.eq("id", job.chapter_id);
    const { data: chapterRows, error: chapterError } = await query;
    if (chapterError) throw new Error(chapterError.message);
    const chapters = (chapterRows ?? []) as Chapter[];
    if (!chapters.length) throw new Error("There are no chapters to export yet.");

    const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle();
    const author = profile?.display_name || user.user_metadata?.display_name || user.email?.split("@")[0] || null;
    const includeAssets = format === "json";
    const [{ data: assetRows }, { data: noteRows }] = includeAssets
      ? await Promise.all([
          supabase.from("assets").select("*").eq("project_id", project.id),
          supabase.from("notes").select("*").eq("project_id", project.id),
        ])
      : [{ data: [] }, { data: [] }];

    await admin.from("export_jobs").update({ progress: 35 }).eq("id", job.id);
    const generated = await generateExport({
      project,
      chapters,
      format,
      style: resolveStyle(job.style_template).id,
      options,
      scope: job.scope === "chapter" ? "chapter" : "project",
      chapterId: job.chapter_id,
      assets: assetRows ?? [],
      notes: noteRows ?? [],
      authorName: author,
    });
    await admin.from("export_jobs").update({ progress: 75 }).eq("id", job.id);

    const ext = FORMAT_META[format].ext;
    const base = generated.filename.replace(new RegExp(`\\.${ext}$`), "");
    const stored = await uploadExport(`${base}-${job.id.slice(0, 8)}.${ext}`, generated.bytes, generated.contentType);

    const { data: doneRow, error: doneError } = await admin
      .from("export_jobs")
      .update({
        status: "done",
        progress: 100,
        storage_path: stored.path,
        download_url: stored.url,
        size_bytes: generated.bytes.byteLength,
        completed_at: new Date().toISOString(),
        error: null,
      })
      .eq("id", job.id)
      .select("*")
      .single();
    if (doneError) throw new Error(doneError.message);

    await logActivity({
      projectId: project.id,
      action: "export.completed",
      targetType: "export_job",
      targetId: job.id,
      summary: `Exported ${FORMAT_META[format].label}${job.scope === "chapter" ? " (chapter)" : ""}`,
    });
    try {
      await emitWebhookEvent("export.completed", project.id, {
        job_id: job.id,
        format,
        scope: job.scope,
        chapter_id: job.chapter_id,
        filename: `${base}-${job.id.slice(0, 8)}.${ext}`,
        download_url: stored.url,
        size_bytes: generated.bytes.byteLength,
        style: job.style_template,
      });
    } catch {
      // Webhook delivery is best-effort; the export itself has already succeeded.
    }

    revalidatePath(`/app/projects/${project.id}/export`);
    return { ok: true, job: doneRow as ExportJob };
  } catch (error) {
    const message = errorMessage(error).slice(0, 500);
    const { data: failedRow } = await admin
      .from("export_jobs")
      .update({ status: "failed", progress: 100, error: message, completed_at: new Date().toISOString() })
      .eq("id", job.id)
      .select("*")
      .maybeSingle();
    revalidatePath(`/app/projects/${project.id}/export`);
    return { ok: false, error: message, job: (failedRow as ExportJob | null) ?? undefined };
  }
}

export async function startExportAction(input: StartExportInput): Promise<ExportActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "You need to sign in to export." };
  if (!input?.projectId) return { ok: false, error: "Missing project." };
  if (!FORMATS.has(input.format)) return { ok: false, error: "Choose a supported export format." };

  const supabase = await createClient();
  const { data: projectRow } = await supabase.from("projects").select("*").eq("id", input.projectId).maybeSingle();
  if (!projectRow) return { ok: false, error: "Project not found or you no longer have access." };

  const { data: role } = await supabase.rpc("project_role", { p: input.projectId });
  if (role !== "owner" && role !== "editor") {
    return { ok: false, error: "Only editors and the owner can export this project." };
  }

  const scope = input.scope === "chapter" ? "chapter" : "project";
  let chapterId: string | null = null;
  if (scope === "chapter") {
    if (!input.chapterId) return { ok: false, error: "Choose a chapter to export." };
    const { data: chapter } = await supabase
      .from("chapters")
      .select("id")
      .eq("id", input.chapterId)
      .eq("project_id", input.projectId)
      .maybeSingle();
    if (!chapter) return { ok: false, error: "That chapter does not belong to this project." };
    chapterId = input.chapterId;
  }

  const options = safeOptions(input.options);
  const { data: jobRow, error: insertError } = await supabase
    .from("export_jobs")
    .insert({
      project_id: input.projectId,
      requested_by: user.id,
      format: input.format,
      style_template: resolveStyle(input.style).id,
      scope,
      chapter_id: chapterId,
      options,
      status: "queued",
      progress: 0,
    })
    .select("*")
    .single();
  if (insertError || !jobRow) return { ok: false, error: insertError?.message ?? "Could not create the export job." };

  return executeJob((jobRow as ExportJob).id);
}

/** Re-run a failed export in place, preserving the original options. */
export async function retryExportAction(jobId: string): Promise<ExportActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "You need to sign in to export." };
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) return { ok: false, error: "Export job not found." };

  const supabase = await createClient();
  const { data: job } = await supabase.from("export_jobs").select("*").eq("id", jobId).maybeSingle();
  if (!job) return { ok: false, error: "Export job not found." };

  const { data: role } = await supabase.rpc("project_role", { p: job.project_id });
  if (role !== "owner" && role !== "editor") {
    return { ok: false, error: "Only editors and the owner can retry this export." };
  }

  await createAdminClient()
    .from("export_jobs")
    .update({ status: "queued", progress: 0, error: null, completed_at: null, started_at: null })
    .eq("id", jobId);

  return executeJob(jobId);
}
