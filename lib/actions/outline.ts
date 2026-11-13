"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProjectContext } from "@/lib/data";
import { logActivity } from "@/lib/activity";
import type { Chapter, ChapterStatus, Note } from "@/lib/types";

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const STATUSES: ChapterStatus[] = ["draft", "in_progress", "complete", "needs_review"];
const NOTE_KINDS: Note["kind"][] = ["note", "character", "location", "event", "research"];

function revalidateProject(projectId: string, chapterId?: string) {
  revalidatePath(`/app/projects/${projectId}`);
  // every chapter under this project re-renders the outline / editor chrome
  revalidatePath(`/app/projects/${projectId}/editor`, "layout");
  if (chapterId) revalidatePath(`/app/projects/${projectId}/editor/${chapterId}`);
}

async function requireEditor(projectId: string): Promise<{ error: string } | null> {
  const ctx = await getProjectContext(projectId);
  if (!ctx.canEdit) return { error: "You do not have permission to change this project." };
  return null;
}

async function siblingPosition(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  parentId: string | null,
) {
  let query = supabase
    .from("chapters")
    .select("position")
    .eq("project_id", projectId)
    .order("position", { ascending: false })
    .limit(1);
  query = parentId ? query.eq("parent_id", parentId) : query.is("parent_id", null);
  const { data } = await query;
  const max = (data?.[0]?.position as number | undefined) ?? -1;
  return max + 1;
}

function cleanTitle(input: string | null | undefined, fallback: string) {
  const title = (input ?? "").trim();
  return title.length ? title.slice(0, 200) : fallback;
}

function cleanTags(tags: string[] | undefined) {
  if (!Array.isArray(tags)) return [];
  const unique = new Set(
    tags
      .map((t) => String(t).trim())
      .filter(Boolean),
  );
  return Array.from(unique).slice(0, 12);
}

/* ------------------------------------------------------------------ chapters */

export async function createChapter(
  projectId: string,
  input: { title?: string; parentId?: string | null; position?: number } = {},
): Promise<ActionResult<Chapter>> {
  const guard = await requireEditor(projectId);
  if (guard) return { ok: false, error: guard.error };

  const supabase = await createClient();
  const parentId = input.parentId ?? null;

  if (parentId) {
    const { data: parent } = await supabase
      .from("chapters")
      .select("id, project_id")
      .eq("id", parentId)
      .eq("project_id", projectId)
      .maybeSingle();
    if (!parent) return { ok: false, error: "The parent section no longer exists." };
  }

  const position = input.position ?? (await siblingPosition(supabase, projectId, parentId));
  const title = cleanTitle(input.title, "Untitled Chapter");

  const { data, error } = await supabase
    .from("chapters")
    .insert({
      project_id: projectId,
      parent_id: parentId,
      title,
      position,
      status: "draft",
      content_md: "",
    })
    .select("*")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "Could not create the chapter." };

  await logActivity({
    projectId,
    action: "chapter.created",
    targetType: "chapter",
    targetId: data.id,
    summary: `Added “${title}”`,
  });

  revalidateProject(projectId, data.id);
  return { ok: true, data: data as Chapter };
}

/** Batched insert used by "add 3 chapters". */
export async function createChapters(
  projectId: string,
  count: number,
  input: { parentId?: string | null; titlePrefix?: string } = {},
): Promise<ActionResult<Chapter[]>> {
  const guard = await requireEditor(projectId);
  if (guard) return { ok: false, error: guard.error };

  const total = Math.max(1, Math.min(12, Math.floor(count)));
  const supabase = await createClient();
  const parentId = input.parentId ?? null;

  if (parentId) {
    const { data: parent } = await supabase
      .from("chapters")
      .select("id, project_id")
      .eq("id", parentId)
      .eq("project_id", projectId)
      .maybeSingle();
    if (!parent) return { ok: false, error: "The parent section no longer exists." };
  }

  const start = await siblingPosition(supabase, projectId, parentId);
  const prefix = input.titlePrefix?.trim() || "Untitled Chapter";

  const rows = Array.from({ length: total }, (_, i) => ({
    project_id: projectId,
    parent_id: parentId,
    title: total === 1 ? prefix : `${prefix} ${i + 1}`,
    position: start + i,
    status: "draft",
    content_md: "",
  }));

  const { data, error } = await supabase.from("chapters").insert(rows).select("*");
  if (error || !data?.length)
    return { ok: false, error: error?.message ?? "Could not create the chapters." };

  await logActivity({
    projectId,
    action: "chapter.created",
    targetType: "chapter",
    summary: `Added ${data.length} chapters`,
  });

  revalidateProject(projectId);
  return { ok: true, data: data as Chapter[] };
}

export async function renameChapter(
  projectId: string,
  chapterId: string,
  title: string,
): Promise<ActionResult<Chapter>> {
  const guard = await requireEditor(projectId);
  if (guard) return { ok: false, error: guard.error };

  const nextTitle = cleanTitle(title, "");
  if (!nextTitle) return { ok: false, error: "A chapter needs a title." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chapters")
    .update({ title: nextTitle })
    .eq("id", chapterId)
    .eq("project_id", projectId)
    .select("*")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Chapter not found." };

  await logActivity({
    projectId,
    action: "chapter.renamed",
    targetType: "chapter",
    targetId: chapterId,
    summary: `Renamed a section to “${nextTitle}”`,
  });

  revalidateProject(projectId, chapterId);
  return { ok: true, data: data as Chapter };
}

/** Deleting a node cascades to its children (FK on delete cascade). */
export async function deleteChapter(
  projectId: string,
  chapterId: string,
): Promise<ActionResult<{ deleted: number }>> {
  const guard = await requireEditor(projectId);
  if (guard) return { ok: false, error: guard.error };

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("chapters")
    .select("id, parent_id, title")
    .eq("project_id", projectId);
  const list = (rows ?? []) as { id: string; parent_id: string | null; title: string }[];

  const target = list.find((c) => c.id === chapterId);
  if (!target) return { ok: false, error: "Chapter not found." };

  // count the subtree so the caller can report what was removed
  const doomed = new Set<string>([chapterId]);
  let grown = true;
  while (grown) {
    grown = false;
    for (const row of list) {
      if (row.parent_id && doomed.has(row.parent_id) && !doomed.has(row.id)) {
        doomed.add(row.id);
        grown = true;
      }
    }
  }

  const { error } = await supabase
    .from("chapters")
    .delete()
    .eq("id", chapterId)
    .eq("project_id", projectId);
  if (error) return { ok: false, error: error.message };

  await logActivity({
    projectId,
    action: "chapter.deleted",
    targetType: "chapter",
    targetId: chapterId,
    summary:
      doomed.size > 1
        ? `Deleted “${target.title}” and ${doomed.size - 1} nested sections`
        : `Deleted “${target.title}”`,
  });

  revalidateProject(projectId);
  return { ok: true, data: { deleted: doomed.size } };
}

export type ReorderItem = { id: string; parent_id: string | null; position: number };

export async function reorderChapters(
  projectId: string,
  items: ReorderItem[],
): Promise<ActionResult<ReorderItem[]>> {
  const guard = await requireEditor(projectId);
  if (guard) return { ok: false, error: guard.error };
  if (!Array.isArray(items) || !items.length) return { ok: true, data: [] };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("chapters")
    .select("id, parent_id")
    .eq("project_id", projectId);
  const rows = (existing ?? []) as { id: string; parent_id: string | null }[];
  const ids = new Set(rows.map((r) => r.id));

  if (items.some((item) => !ids.has(item.id))) {
    return { ok: false, error: "One of those sections is no longer part of this project." };
  }

  const parentById = new Map(rows.map((r) => [r.id, r.parent_id] as const));
  for (const item of items) parentById.set(item.id, item.parent_id);

  // a node may never become its own ancestor
  for (const item of items) {
    const seen = new Set<string>([item.id]);
    let cursor = item.parent_id;
    while (cursor) {
      if (seen.has(cursor)) return { ok: false, error: "That move would create a loop." };
      seen.add(cursor);
      cursor = parentById.get(cursor) ?? null;
    }
    if (item.parent_id && !ids.has(item.parent_id)) {
      return { ok: false, error: "That parent section is no longer available." };
    }
  }

  const results = await Promise.all(
    items.map((item) =>
      supabase
        .from("chapters")
        .update({ parent_id: item.parent_id, position: item.position })
        .eq("id", item.id)
        .eq("project_id", projectId),
    ),
  );

  const failure = results.find((r) => r.error);
  if (failure?.error) return { ok: false, error: failure.error.message };

  await logActivity({
    projectId,
    action: "chapter.reordered",
    targetType: "chapter",
    summary: "Reordered the outline",
  });

  revalidateProject(projectId);
  return { ok: true, data: items };
}

export type ChapterMetaPatch = {
  synopsis?: string | null;
  status?: ChapterStatus;
  pov?: string | null;
  arc?: string | null;
  subplot?: string | null;
  color?: string | null;
};

export async function updateChapterMeta(
  projectId: string,
  chapterId: string,
  patch: ChapterMetaPatch,
): Promise<ActionResult<Chapter>> {
  const guard = await requireEditor(projectId);
  if (guard) return { ok: false, error: guard.error };

  const update: Record<string, unknown> = {};
  if (patch.status !== undefined) {
    if (!STATUSES.includes(patch.status)) return { ok: false, error: "Unknown status." };
    update.status = patch.status;
  }
  for (const key of ["synopsis", "pov", "arc", "subplot", "color"] as const) {
    if (patch[key] !== undefined) {
      const value = patch[key];
      update[key] = typeof value === "string" ? value.trim() || null : null;
    }
  }
  if (!Object.keys(update).length) return { ok: false, error: "Nothing to update." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chapters")
    .update(update)
    .eq("id", chapterId)
    .eq("project_id", projectId)
    .select("*")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Chapter not found." };

  await logActivity({
    projectId,
    action: "chapter.updated",
    targetType: "chapter",
    targetId: chapterId,
    summary: `Updated the outline card for “${(data as Chapter).title}”`,
  });

  revalidateProject(projectId, chapterId);
  return { ok: true, data: data as Chapter };
}

/* ---------------------------------------------------------------------- notes */

export async function createNote(
  projectId: string,
  input: { kind?: Note["kind"]; title: string; body?: string | null; tags?: string[]; url?: string | null },
): Promise<ActionResult<Note>> {
  const guard = await requireEditor(projectId);
  if (guard) return { ok: false, error: guard.error };

  const title = cleanTitle(input.title, "");
  if (!title) return { ok: false, error: "Give the note a title." };
  const kind = input.kind && NOTE_KINDS.includes(input.kind) ? input.kind : "note";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notes")
    .insert({
      project_id: projectId,
      kind,
      title,
      body: input.body?.trim() || null,
      tags: cleanTags(input.tags),
      url: input.url?.trim() || null,
    })
    .select("*")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "Could not create the note." };

  await logActivity({
    projectId,
    action: "note.created",
    targetType: "note",
    targetId: data.id,
    summary: `Added the ${kind} note “${title}”`,
  });

  revalidatePath(`/app/projects/${projectId}`);
  return { ok: true, data: data as Note };
}

export async function updateNote(
  projectId: string,
  noteId: string,
  patch: { kind?: Note["kind"]; title?: string; body?: string | null; tags?: string[] },
): Promise<ActionResult<Note>> {
  const guard = await requireEditor(projectId);
  if (guard) return { ok: false, error: guard.error };

  const update: Record<string, unknown> = {};
  if (patch.title !== undefined) {
    const title = cleanTitle(patch.title, "");
    if (!title) return { ok: false, error: "Give the note a title." };
    update.title = title;
  }
  if (patch.kind !== undefined) {
    if (!NOTE_KINDS.includes(patch.kind)) return { ok: false, error: "Unknown note kind." };
    update.kind = patch.kind;
  }
  if (patch.body !== undefined) update.body = patch.body?.trim() || null;
  if (patch.tags !== undefined) update.tags = cleanTags(patch.tags);
  if (!Object.keys(update).length) return { ok: false, error: "Nothing to update." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notes")
    .update(update)
    .eq("id", noteId)
    .eq("project_id", projectId)
    .select("*")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Note not found." };

  revalidatePath(`/app/projects/${projectId}`);
  return { ok: true, data: data as Note };
}

export async function deleteNote(
  projectId: string,
  noteId: string,
): Promise<ActionResult<{ id: string }>> {
  const guard = await requireEditor(projectId);
  if (guard) return { ok: false, error: guard.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("notes")
    .delete()
    .eq("id", noteId)
    .eq("project_id", projectId);
  if (error) return { ok: false, error: error.message };

  await logActivity({
    projectId,
    action: "note.deleted",
    targetType: "note",
    targetId: noteId,
    summary: "Removed a research note",
  });

  revalidatePath(`/app/projects/${projectId}`);
  return { ok: true, data: { id: noteId } };
}
