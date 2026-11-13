import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { startExportAction } from "@/lib/actions/export";
import type { ExportFormat, ExportOptions } from "@/lib/export/types";

export const dynamic = "force-dynamic";

const FORMATS = new Set<ExportFormat>(["markdown", "docx", "epub", "pdf", "pdf_screen", "html", "json"]);

/**
 * Internal export trigger used by the writing UI (and reusable by the public
 * API stream once API-key auth is wired). Session auth via Supabase cookies.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized", message: "Sign in to export." }, { status: 401 });
  }

  let body: {
    format?: string;
    style?: string;
    scope?: string;
    chapter_id?: string | null;
    options?: ExportOptions;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "Send a JSON body." }, { status: 400 });
  }

  if (!body.format || !FORMATS.has(body.format as ExportFormat)) {
    return NextResponse.json(
      { error: "invalid_format", message: `format must be one of ${[...FORMATS].join(", ")}` },
      { status: 422 },
    );
  }

  const result = await startExportAction({
    projectId: id,
    format: body.format as ExportFormat,
    style: body.style,
    scope: body.scope === "chapter" ? "chapter" : "project",
    chapterId: body.chapter_id ?? null,
    options: body.options,
  });

  if (!result.ok) {
    const status = result.error.includes("not found") || result.error.includes("access") ? 404 : 422;
    return NextResponse.json({ error: "export_failed", message: result.error }, { status });
  }
  return NextResponse.json({ job: result.job }, { status: 201 });
}

/** Recent export jobs for the project (session-scoped, RLS enforced). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized", message: "Sign in to view exports." }, { status: 401 });
  }
  const { data: jobs, error } = await supabase
    .from("export_jobs")
    .select("*")
    .eq("project_id", id)
    .order("created_at", { ascending: false })
    .limit(25);
  if (error) {
    return NextResponse.json({ error: "not_found", message: "Project not found." }, { status: 404 });
  }
  return NextResponse.json({ jobs: jobs ?? [] }, { headers: { "Cache-Control": "no-store" } });
}
