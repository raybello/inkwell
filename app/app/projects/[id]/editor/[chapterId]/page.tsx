import { notFound } from "next/navigation";
import { getProjectContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { EditorShell } from "@/components/editor/editor-shell";
import type { AssetOption, ChapterListItem, VersionItem } from "@/components/editor/types";
import type { Chapter } from "@/lib/types";

const CURSOR_COLORS = ["#c8814a", "#7d9a7e", "#8b6b8f", "#5b8aa8", "#b46a6a", "#a8934f"];

function cursorColor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return CURSOR_COLORS[hash % CURSOR_COLORS.length];
}

function toListItem(chapter: Chapter | Record<string, unknown>): ChapterListItem {
  const row = chapter as unknown as Chapter;
  return {
    id: row.id,
    title: row.title,
    word_count: row.word_count ?? 0,
    status: row.status,
    position: row.position,
    updated_at: row.updated_at,
    synopsis: row.synopsis,
  };
}

export default async function EditorPage({
  params,
}: {
  params: Promise<{ id: string; chapterId: string }>;
}) {
  const { id, chapterId } = await params;
  const { project, canEdit, profile } = await getProjectContext(id);

  const supabase = await createClient();

  const [{ data: chapterRow }, { data: chapterRows }, { data: assetRows }, { data: versionRows }] =
    await Promise.all([
      supabase.from("chapters").select("*").eq("id", chapterId).eq("project_id", id).maybeSingle(),
      supabase
        .from("chapters")
        .select("id, title, synopsis, word_count, status, position, updated_at")
        .eq("project_id", id)
        .order("position", { ascending: true }),
      supabase
        .from("assets")
        .select("id, filename, public_url, alt_text, mime_type")
        .eq("project_id", id)
        .order("created_at", { ascending: false })
        .limit(120),
      supabase
        .from("chapter_versions")
        .select("id, label, kind, word_count, created_at, saved_by")
        .eq("chapter_id", chapterId)
        .order("created_at", { ascending: false })
        .limit(40),
    ]);

  if (!chapterRow) notFound();
  const chapter = chapterRow as unknown as Chapter;

  const assets: AssetOption[] = (assetRows ?? []).map((row) => ({
    id: row.id as string,
    filename: (row.filename as string) ?? "Image",
    public_url: (row.public_url as string | null) ?? null,
    alt_text: (row.alt_text as string | null) ?? null,
    mime_type: (row.mime_type as string | null) ?? null,
  }));

  const versions: VersionItem[] = (versionRows ?? []).map((row) => ({
    id: row.id as string,
    label: (row.label as string | null) ?? null,
    kind: ((row.kind as string) === "manual" ? "manual" : "auto") as VersionItem["kind"],
    word_count: (row.word_count as number) ?? 0,
    created_at: row.created_at as string,
    saved_by: (row.saved_by as string | null) ?? null,
  }));

  const name = profile?.display_name ?? profile?.email?.split("@")[0] ?? "Writer";
  const dailyGoalRaw = Number(project.settings?.daily_goal_words ?? 500);
  const dailyGoal = Number.isFinite(dailyGoalRaw) && dailyGoalRaw > 0 ? dailyGoalRaw : 500;

  return (
    <EditorShell
      key={chapter.id}
      projectId={id}
      chapter={{ ...toListItem(chapter), content: chapter.content, content_md: chapter.content_md }}
      chapters={(chapterRows ?? []).map(toListItem)}
      assets={assets}
      versions={versions}
      user={{
        id: profile?.id ?? "anonymous",
        name,
        color: cursorColor(profile?.id ?? name),
        avatarUrl: profile?.avatar_url ?? null,
      }}
      canEdit={canEdit}
      dailyGoal={dailyGoal}
    />
  );
}
