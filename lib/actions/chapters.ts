"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProjectContext } from "@/lib/data";
import { logActivity } from "@/lib/activity";
import { emitWebhookEvent } from "@/lib/webhooks";
import { countWords, markdownToTiptap, tiptapToMarkdown } from "@/lib/markdown";
import type { Chapter, ChapterStatus } from "@/lib/types";

export type ChapterActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export interface SaveChapterResult {
  wordCount: number;
  updatedAt: string;
}

export interface ChapterSearchSnippet {
  text: string;
  index: number;
}

export interface ChapterSearchHit {
  chapterId: string;
  title: string;
  position: number;
  count: number;
  snippets: ChapterSearchSnippet[];
}

export interface ChapterSearchResult {
  total: number;
  hits: ChapterSearchHit[];
}

const STATUSES: ChapterStatus[] = ["draft", "in_progress", "complete", "needs_review"];

type Supabase = Awaited<ReturnType<typeof createClient>>;

function revalidateChapterSurfaces(projectId: string) {
  revalidatePath(`/app/projects/${projectId}`);
  revalidatePath("/app");
}

async function requireEditor(projectId: string): Promise<{ error: string } | null> {
  const ctx = await getProjectContext(projectId);
  if (!ctx.canEdit) return { error: "You do not have permission to edit this project." };
  return null;
}

async function loadChapter(supabase: Supabase, projectId: string, chapterId: string) {
  const { data } = await supabase
    .from("chapters")
    .select("id, project_id, title, position, status")
    .eq("id", chapterId)
    .eq("project_id", projectId)
    .maybeSingle();
  return data as Pick<Chapter, "id" | "project_id" | "title" | "position" | "status"> | null;
}

function cleanTitle(input: string | null | undefined, fallback = "Untitled Chapter") {
  const title = (input ?? "").trim();
  return (title.length ? title : fallback).slice(0, 200);
}

/* --------------------------------------------------------------- content save */

/**
 * Writes the TipTap JSON body and its markdown mirror. `word_count` is computed
 * by the `chapters_sync_meta` trigger from `content_md`, so it is never trusted
 * from the client. Activity logging is throttled; webhooks are fire-and-forget
 * and can never fail the save.
 */
export async function saveChapterContent(input: {
  projectId: string;
  chapterId: string;
  content: unknown;
}): Promise<ChapterActionResult<SaveChapterResult>> {
  const { projectId, chapterId, content } = input;
  if (!projectId || !chapterId) return { ok: false, error: "Missing chapter." };

  const guard = await requireEditor(projectId);
  if (guard) return { ok: false, error: guard.error };

  const doc =
    content && typeof content === "object" && !Array.isArray(content)
      ? (content as Record<string, unknown>)
      : null;
  if (!doc || doc.type !== "doc") return { ok: false, error: "Malformed chapter content." };

  let contentMd = "";
  try {
    contentMd = tiptapToMarkdown(doc);
  } catch (mdError) {
    console.error("[chapters] markdown mirror failed", mdError);
    contentMd = "";
  }
  if (!contentMd) {
    console.error("[chapters] empty markdown mirror", JSON.stringify(doc).slice(0, 400));
  }

  const supabase = await createClient();
  const existing = await loadChapter(supabase, projectId, chapterId);
  if (!existing) return { ok: false, error: "Chapter not found." };

  const { data, error } = await supabase
    .from("chapters")
    .update({ content: doc, content_md: contentMd })
    .eq("id", chapterId)
    .eq("project_id", projectId)
    .select("word_count, updated_at")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "Could not save the chapter." };

  const wordCount = typeof data.word_count === "number" ? data.word_count : countWords(contentMd);

  // Throttle the activity feed: a save every couple of seconds would drown it.
  try {
    const { data: recent } = await supabase
      .from("activities")
      .select("id, created_at")
      .eq("project_id", projectId)
      .eq("action", "chapter.saved")
      .eq("target_id", chapterId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const last = recent?.created_at ? new Date(recent.created_at).getTime() : 0;
    if (!last || Date.now() - last > 3 * 60 * 1000) {
      await logActivity({
        projectId,
        action: "chapter.saved",
        targetType: "chapter",
        targetId: chapterId,
        summary: `Worked on “${existing.title}”`,
      });
    }
  } catch {
    // never block a save on telemetry
  }

  try {
    void emitWebhookEvent("chapter.updated", projectId, {
      chapter_id: chapterId,
      title: existing.title,
      word_count: wordCount,
      content_md: contentMd.slice(0, 2000),
    }).catch(() => undefined);
  } catch {
    // webhooks must never break a save
  }

  revalidateChapterSurfaces(projectId);
  return {
    ok: true,
    data: { wordCount, updatedAt: data.updated_at as string },
  };
}

/* ------------------------------------------------------------------- chapters */

/** Re-reads a chapter body after a server-side rewrite (project-wide replace). */
export async function getChapterContentAction(
  projectId: string,
  chapterId: string,
): Promise<ChapterActionResult<{ content: unknown; contentMd: string; wordCount: number }>> {
  const ctx = await getProjectContext(projectId);
  if (!ctx.canComment) return { ok: false, error: "You do not have access to this chapter." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chapters")
    .select("content, content_md, word_count")
    .eq("id", chapterId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Chapter not found." };

  return {
    ok: true,
    data: {
      content: data.content,
      contentMd: (data.content_md as string | null) ?? "",
      wordCount: (data.word_count as number | null) ?? 0,
    },
  };
}

export async function createChapterAction(
  projectId: string,
  input: { title?: string; afterChapterId?: string | null } = {},
): Promise<ChapterActionResult<Chapter>> {
  const guard = await requireEditor(projectId);
  if (guard) return { ok: false, error: guard.error };

  const supabase = await createClient();
  const title = cleanTitle(input.title, "Untitled Chapter");

  const { data: siblings } = await supabase
    .from("chapters")
    .select("id, position")
    .eq("project_id", projectId)
    .is("parent_id", null)
    .order("position", { ascending: true });

  const rows = siblings ?? [];
  let position = rows.length ? Math.max(...rows.map((r) => r.position ?? 0)) + 1 : 0;
  let insertIndex = rows.length;

  if (input.afterChapterId) {
    const at = rows.findIndex((r) => r.id === input.afterChapterId);
    if (at >= 0) {
      insertIndex = at + 1;
      position = at + 1;
    }
  }

  const { data, error } = await supabase
    .from("chapters")
    .insert({ project_id: projectId, title, position, status: "draft", content_md: "" })
    .select("*")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Could not add the chapter." };

  // push later siblings down so the new chapter sits exactly where asked
  if (insertIndex < rows.length) {
    const extras = rows.slice(insertIndex).filter((r) => r.id !== data.id);
    await Promise.all(
      extras.map((row, offset) =>
        supabase.from("chapters").update({ position: position + offset + 1 }).eq("id", row.id),
      ),
    );
  }

  await logActivity({
    projectId,
    action: "chapter.created",
    targetType: "chapter",
    targetId: data.id,
    summary: `Added “${title}”`,
  });
  try {
    void emitWebhookEvent("chapter.created", projectId, { chapter_id: data.id, title }).catch(() => undefined);
  } catch {
    // ignore
  }

  revalidateChapterSurfaces(projectId);
  return { ok: true, data: data as Chapter };
}

export async function renameChapterAction(
  projectId: string,
  chapterId: string,
  title: string,
): Promise<ChapterActionResult<{ title: string }>> {
  const guard = await requireEditor(projectId);
  if (guard) return { ok: false, error: guard.error };

  const next = cleanTitle(title);
  const supabase = await createClient();
  const { error } = await supabase
    .from("chapters")
    .update({ title: next })
    .eq("id", chapterId)
    .eq("project_id", projectId);
  if (error) return { ok: false, error: error.message };

  await logActivity({
    projectId,
    action: "chapter.renamed",
    targetType: "chapter",
    targetId: chapterId,
    summary: `Renamed a chapter to “${next}”`,
  });
  revalidateChapterSurfaces(projectId);
  return { ok: true, data: { title: next } };
}

export async function deleteChapterAction(
  projectId: string,
  chapterId: string,
): Promise<ChapterActionResult<{ id: string }>> {
  const guard = await requireEditor(projectId);
  if (guard) return { ok: false, error: guard.error };

  const supabase = await createClient();
  const chapter = await loadChapter(supabase, projectId, chapterId);
  if (!chapter) return { ok: false, error: "Chapter not found." };

  const { error } = await supabase.from("chapters").delete().eq("id", chapterId).eq("project_id", projectId);
  if (error) return { ok: false, error: error.message };

  await logActivity({
    projectId,
    action: "chapter.deleted",
    targetType: "chapter",
    targetId: chapterId,
    summary: `Deleted “${chapter.title}”`,
  });
  try {
    void emitWebhookEvent("chapter.deleted", projectId, { chapter_id: chapterId, title: chapter.title }).catch(
      () => undefined,
    );
  } catch {
    // ignore
  }

  revalidateChapterSurfaces(projectId);
  return { ok: true, data: { id: chapterId } };
}

export async function reorderChaptersAction(
  projectId: string,
  orderedIds: string[],
): Promise<ChapterActionResult<{ count: number }>> {
  const guard = await requireEditor(projectId);
  if (guard) return { ok: false, error: guard.error };
  if (!Array.isArray(orderedIds) || !orderedIds.length) return { ok: false, error: "Nothing to reorder." };

  const supabase = await createClient();
  const ids = Array.from(new Set(orderedIds));

  const results = await Promise.all(
    ids.map((id, index) => supabase.from("chapters").update({ position: index }).eq("id", id).eq("project_id", projectId)),
  );
  const failure = results.find((r) => r.error);
  if (failure?.error) return { ok: false, error: failure.error.message };

  await logActivity({ projectId, action: "chapter.reordered", summary: "Reordered chapters" });
  revalidateChapterSurfaces(projectId);
  return { ok: true, data: { count: ids.length } };
}

export async function updateChapterStatusAction(
  projectId: string,
  chapterId: string,
  status: ChapterStatus,
): Promise<ChapterActionResult<{ status: ChapterStatus }>> {
  if (!STATUSES.includes(status)) return { ok: false, error: "Unknown status." };
  const guard = await requireEditor(projectId);
  if (guard) return { ok: false, error: guard.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("chapters")
    .update({ status })
    .eq("id", chapterId)
    .eq("project_id", projectId);
  if (error) return { ok: false, error: error.message };

  await logActivity({
    projectId,
    action: "chapter.status",
    targetType: "chapter",
    targetId: chapterId,
    summary: `Marked a chapter ${status.replace("_", " ")}`,
  });
  revalidateChapterSurfaces(projectId);
  return { ok: true, data: { status } };
}

export async function updateChapterSynopsisAction(
  projectId: string,
  chapterId: string,
  synopsis: string,
): Promise<ChapterActionResult<{ synopsis: string }>> {
  const guard = await requireEditor(projectId);
  if (guard) return { ok: false, error: guard.error };

  const clean = synopsis.trim().slice(0, 2000);
  const supabase = await createClient();
  const { error } = await supabase
    .from("chapters")
    .update({ synopsis: clean || null })
    .eq("id", chapterId)
    .eq("project_id", projectId);
  if (error) return { ok: false, error: error.message };

  revalidateChapterSurfaces(projectId);
  return { ok: true, data: { synopsis: clean } };
}

/* ------------------------------------------------------- project-wide find */

function makeRegExp(query: string, opts: { regex?: boolean; caseSensitive?: boolean }) {
  if (!query) return null;
  try {
    if (opts.regex) return new RegExp(query, `g${opts.caseSensitive ? "" : "i"}`);
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(escaped, `g${opts.caseSensitive ? "" : "i"}`);
  } catch {
    return null;
  }
}

function countMatches(text: string, re: RegExp, cap = 500) {
  re.lastIndex = 0;
  let count = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (!m[0].length) {
      re.lastIndex += 1;
      continue;
    }
    count += 1;
    if (count >= cap) break;
  }
  return count;
}

export async function searchProjectChaptersAction(
  projectId: string,
  query: string,
  opts: { regex?: boolean; caseSensitive?: boolean } = {},
): Promise<ChapterActionResult<ChapterSearchResult>> {
  const trimmed = query.trim();
  if (!trimmed) return { ok: true, data: { total: 0, hits: [] } };
  const re = makeRegExp(trimmed, opts);
  if (!re) return { ok: false, error: "That regular expression is not valid." };

  const ctx = await getProjectContext(projectId);
  if (!ctx.canComment) return { ok: false, error: "You do not have access to this project." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chapters")
    .select("id, title, content_md, position")
    .eq("project_id", projectId)
    .order("position", { ascending: true });
  if (error) return { ok: false, error: error.message };

  const hits: ChapterSearchHit[] = [];
  let total = 0;

  for (const row of data ?? []) {
    const md = (row.content_md as string | null) ?? "";
    if (!md) continue;
    const count = countMatches(md, re);
    if (!count) continue;
    total += count;

    const snippets: ChapterSearchSnippet[] = [];
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(md)) && snippets.length < 3) {
      if (!m[0].length) {
        re.lastIndex += 1;
        continue;
      }
      const start = Math.max(0, m.index - 46);
      const end = Math.min(md.length, m.index + m[0].length + 46);
      const text = md
        .slice(start, end)
        .replace(/\s+/g, " ")
        .trim();
      snippets.push({ text: `${start > 0 ? "…" : ""}${text}${end < md.length ? "…" : ""}`, index: m.index });
    }

    hits.push({
      chapterId: row.id as string,
      title: (row.title as string) ?? "Untitled",
      position: (row.position as number) ?? 0,
      count,
      snippets,
    });
  }

  return { ok: true, data: { total, hits } };
}

/**
 * Plain-text replace across every chapter. Regex replacement is deliberately
 * not supported here (backreferences across a whole manuscript are a footgun);
 * the dialog disables it for project-wide mode.
 */
export async function replaceProjectChaptersAction(
  projectId: string,
  query: string,
  replacement: string,
  opts: { caseSensitive?: boolean } = {},
): Promise<ChapterActionResult<{ chapters: number; replacements: number }>> {
  const trimmed = query.trim();
  if (!trimmed) return { ok: false, error: "Enter something to replace." };

  const guard = await requireEditor(projectId);
  if (guard) return { ok: false, error: guard.error };

  const re = makeRegExp(trimmed, { caseSensitive: opts.caseSensitive });
  if (!re) return { ok: false, error: "Invalid search text." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chapters")
    .select("id, title, content_md")
    .eq("project_id", projectId)
    .order("position", { ascending: true });
  if (error) return { ok: false, error: error.message };

  let chaptersTouched = 0;
  let replacements = 0;

  for (const row of data ?? []) {
    const md = (row.content_md as string | null) ?? "";
    re.lastIndex = 0;
    if (!re.test(md)) continue;
    re.lastIndex = 0;
    const count = countMatches(md, re, 100_000);
    if (!count) continue;

    re.lastIndex = 0;
    const nextMd = md.replace(re, () => replacement);
    const nextDoc = markdownToTiptap(nextMd);

    const { error: updateError } = await supabase
      .from("chapters")
      .update({ content: nextDoc, content_md: nextMd })
      .eq("id", row.id)
      .eq("project_id", projectId);
    if (updateError) return { ok: false, error: updateError.message };

    chaptersTouched += 1;
    replacements += count;

    try {
      void emitWebhookEvent("chapter.updated", projectId, {
        chapter_id: row.id,
        title: row.title,
        reason: "project_replace",
      }).catch(() => undefined);
    } catch {
      // ignore
    }
  }

  if (chaptersTouched) {
    await logActivity({
      projectId,
      action: "chapter.replace",
      summary: `Replaced “${trimmed}” in ${chaptersTouched} chapter${chaptersTouched === 1 ? "" : "s"}`,
    });
  }

  revalidateChapterSurfaces(projectId);
  return { ok: true, data: { chapters: chaptersTouched, replacements } };
}
