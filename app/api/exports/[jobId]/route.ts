import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Poll an export job. Session auth today; the public API stream can reuse the
 * shape once API-key auth lands. RLS restricts select to project members, so a
 * job in a project the caller cannot view is a 404 rather than a 403 leak.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  if (!UUID.test(jobId)) {
    return NextResponse.json({ error: "not_found", message: "Export job not found." }, { status: 404 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized", message: "Sign in to view this export." }, { status: 401 });
  }

  const { data: job, error } = await supabase.from("export_jobs").select("*").eq("id", jobId).maybeSingle();
  if (error) {
    return NextResponse.json({ error: "not_found", message: "Export job not found." }, { status: 404 });
  }
  if (!job) {
    return NextResponse.json({ error: "not_found", message: "Export job not found." }, { status: 404 });
  }

  return NextResponse.json(
    {
      job,
      id: job.id,
      project_id: job.project_id,
      format: job.format,
      style: job.style_template,
      scope: job.scope,
      chapter_id: job.chapter_id,
      status: job.status,
      progress: job.progress,
      download_url: job.download_url,
      size_bytes: job.size_bytes,
      error: job.error,
      created_at: job.created_at,
      completed_at: job.completed_at,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
