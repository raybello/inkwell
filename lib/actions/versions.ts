"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProjectContext } from "@/lib/data";
import { logActivity } from "@/lib/activity";
import { countWords, tiptapToMarkdown } from "@/lib/markdown";
import type { ChapterVersion } from "@/lib/types";

export type VersionActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export interface VersionSummary {
  id: string;
  chapter_id: string;
  word_count: number;
  label: string | null;
  kind: "auto" | "manual";
  created_at: string;
  saved_by: string | null;
}

function revalidateAll(projectId: string, chapterId: string) {
  revalidatePath(`/app/projects/${projectId}`);
  revalidatePath(`/app/projects/${projectId}/editor/${chapterId}`);
}

async function resolveChapter(supabase: Awaited<ReturnType<typeof createClient>>, chapterId: string) {
  const { data } = await supabase
    .from("chapters")
    .select("id, project_id, title, content, content_md")
    .eq("id", chapterId)
    .maybeSingle();
  return data as
    | { id: string; project_id: string; title: string; content: unknown; content_md: string }
    | null;
}

/** Newest-first list for the right rail (also used to refresh after a snapshot). */
export async function listChapterVersionsAction(chapterId: string, limit = 40): Promise<VersionActionResult<VersionSummary[]>> {
  const supabase = await createClient();
  const chapter = await resolveChapter(supabase, chapterId);
  if (!chapter) return { ok: false, error: "Chapter not found." };

  const { data, error } = await supabase
    .from("chapter_versions")
    .select("id, chapter_id, word_count, label, kind, created_at, saved_by")
    .eq("chapter_id", chapterId)
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(100, limit)));
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: (data ?? []) as VersionSummary[] };
}

/** On-demand fetch of the (potentially large) snapshot body for preview. */
export async function getChapterVersionAction(versionId: string): Promise<VersionActionResult<ChapterVersion>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("chapter_versions").select("*").eq("id", versionId).maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "That snapshot no longer exists." };
  return { ok: true, data: data as ChapterVersion };
}

export async function createChapterVersionAction(
  chapterId: string,
  label?: string,
): Promise<VersionActionResult<VersionSummary>> {
  const supabase = await createClient();
  const chapter = await resolveChapter(supabase, chapterId);
  if (!chapter) return { ok: false, error: "Chapter not found." };

  const ctx = await getProjectContext(chapter.project_id);
  if (!ctx.canEdit) return { ok: false, error: "You do not have permission to snapshot this chapter." };

  const { data: userData } = await supabase.auth.getUser();
  const contentMd = chapter.content_md ?? tiptapToMarkdown(chapter.content);

  const { data, error } = await supabase
    .from("chapter_versions")
    .insert({
      chapter_id: chapterId,
      content: chapter.content ?? null,
      content_md: contentMd,
      word_count: countWords(contentMd),
      saved_by: userData.user?.id ?? null,
      label: label?.trim().slice(0, 120) || "Named snapshot",
      kind: "manual",
    })
    .select("id, chapter_id, word_count, label, kind, created_at, saved_by")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Could not save the snapshot." };

  await logActivity({
    projectId: chapter.project_id,
    action: "chapter.snapshot",
    targetType: "chapter",
    targetId: chapterId,
    summary: `Saved a snapshot of “${chapter.title}”`,
  });
  revalidateAll(chapter.project_id, chapterId);
  return { ok: true, data: data as VersionSummary };
}

/**
 * Restores a snapshot: the chapter body is rewritten and a manual snapshot of
 * the restored state is kept, labelled "Restored from …", so the history
 * explains itself. The state that was overwritten is captured by the
 * `chapters_snapshot` trigger on the update.
 */
export async function restoreChapterVersionAction(
  versionId: string,
): Promise<VersionActionResult<{ chapterId: string; projectId: string; wordCount: number }>> {
  const supabase = await createClient();
  const { data: version } = await supabase
    .from("chapter_versions")
    .select("id, chapter_id, content, content_md, word_count, label, kind, created_at")
    .eq("id", versionId)
    .maybeSingle();
  if (!version) return { ok: false, error: "That snapshot no longer exists." };

  const chapter = await resolveChapter(supabase, version.chapter_id);
  if (!chapter) return { ok: false, error: "Chapter not found." };

  const ctx = await getProjectContext(chapter.project_id);
  if (!ctx.canEdit) return { ok: false, error: "You do not have permission to restore this chapter." };

  const contentMd = version.content_md ?? tiptapToMarkdown(version.content);
  const { data: userData } = await supabase.auth.getUser();

  // Keep a labelled snapshot of what is about to be replaced, so a restore is
  // never destructive of the writer's latest words.
  const now = new Date();
  const beforeLabel = `Before restore — ${now.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })}`;
  const { error: backupError } = await supabase.from("chapter_versions").insert({
    chapter_id: chapter.id,
    content: chapter.content ?? null,
    content_md: chapter.content_md ?? "",
    word_count: countWords(chapter.content_md),
    saved_by: userData.user?.id ?? null,
    label: beforeLabel.slice(0, 160),
    kind: "manual",
  });
  if (backupError) return { ok: false, error: `Could not keep a backup of the current text: ${backupError.message}` };

  const { error } = await supabase
    .from("chapters")
    .update({ content: version.content ?? null, content_md: contentMd })
    .eq("id", chapter.id);
  if (error) return { ok: false, error: error.message };

  const stamp = new Date(version.created_at).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const label = `Restored from ${version.kind === "manual" && version.label ? version.label : stamp}`;

  const { error: snapshotError } = await supabase.from("chapter_versions").insert({
    chapter_id: chapter.id,
    content: version.content ?? null,
    content_md: contentMd,
    word_count: typeof version.word_count === "number" ? version.word_count : countWords(contentMd),
    saved_by: userData.user?.id ?? null,
    label: label.slice(0, 160),
    kind: "manual",
  });
  if (snapshotError) {
    // the restore itself succeeded; surface the snapshot problem softly
    revalidateAll(chapter.project_id, chapter.id);
    return { ok: false, error: `Chapter restored, but the snapshot label could not be saved: ${snapshotError.message}` };
  }

  await logActivity({
    projectId: chapter.project_id,
    action: "chapter.restored",
    targetType: "chapter",
    targetId: chapter.id,
    summary: `Restored “${chapter.title}” from ${stamp}`,
  });
  revalidateAll(chapter.project_id, chapter.id);
  return {
    ok: true,
    data: {
      chapterId: chapter.id,
      projectId: chapter.project_id,
      wordCount: typeof version.word_count === "number" ? version.word_count : countWords(contentMd),
    },
  };
}
