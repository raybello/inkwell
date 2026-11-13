import { getProjectContext, listChapters } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { ProjectSettingsTabs } from "@/components/projects/project-settings-tabs";
import {
  ProjectSettingsHistory,
  type HistoryChapter,
  type HistoryVersion,
} from "@/components/projects/project-settings-history";

export const metadata = { title: "Version history" };

export default async function ProjectHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ canEdit }, chapters, supabase] = await Promise.all([getProjectContext(id), listChapters(id), createClient()]);

  const chapterRows: HistoryChapter[] = chapters.map((c) => ({
    id: c.id,
    title: c.title,
    content_md: c.content_md ?? "",
    word_count: c.word_count ?? 0,
  }));

  let versions: HistoryVersion[] = [];
  if (chapters.length) {
    const { data } = await supabase
      .from("chapter_versions")
      .select("id, chapter_id, label, kind, created_at, word_count, saved_by, content_md")
      .in(
        "chapter_id",
        chapters.map((c) => c.id),
      )
      .order("created_at", { ascending: false })
      .limit(120);

    const rows = data ?? [];
    const savedByIds = Array.from(new Set(rows.map((v) => v.saved_by).filter((v): v is string => !!v)));
    const { data: profiles } = savedByIds.length
      ? await supabase.from("profiles").select("id, display_name").in("id", savedByIds)
      : { data: [] as { id: string; display_name: string | null }[] };
    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

    versions = rows.map((v) => ({
      id: v.id as string,
      chapter_id: v.chapter_id as string,
      label: (v.label as string | null) ?? null,
      kind: (v.kind as "auto" | "manual") ?? "auto",
      created_at: v.created_at as string,
      word_count: (v.word_count as number) ?? 0,
      author: v.saved_by ? nameById.get(v.saved_by as string) ?? null : null,
      content_md: (v.content_md as string | null) ?? "",
    }));
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8 md:px-10">
      <p className="text-[11px] uppercase tracking-[0.2em] text-accent">Project settings</p>
      <h1 className="mt-1.5 font-serif text-3xl font-semibold tracking-[-0.01em]">History</h1>
      <p className="mt-1 max-w-xl text-sm text-muted">
        Compare a saved version with the current draft, then accept or reject each change. Accepting writes the reviewed
        text back to the chapter and records a new snapshot.
      </p>

      <div className="mt-6">
        <ProjectSettingsTabs projectId={id} active="history" />
      </div>

      <div className="mt-6">
        <ProjectSettingsHistory projectId={id} chapters={chapterRows} versions={versions} canEdit={canEdit} />
      </div>
    </div>
  );
}
