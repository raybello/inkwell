"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProjectContext } from "@/lib/data";
import { logActivity } from "@/lib/activity";

/**
 * Storyboard server actions.
 *
 * Every action is scoped to a project the caller can edit (RLS is the second
 * line of defence — the client below is the user-scoped one, never admin).
 * Card positions are mirrored onto chapters.position so the outline, corkboard
 * and storyboard all agree on order.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Keep in sync with components/storyboard/types.ts */
const MOOD_LIMIT = 5;
const NOTES_LIMIT = 4000;

export type StoryboardActionResult = {
  ok: boolean;
  error?: string;
  data?: { created?: number; removed?: number };
};

type Supabase = Awaited<ReturnType<typeof createClient>>;

type EditorGate =
  | { supabase: Supabase; error: null }
  | { supabase: null; error: string };

async function requireEditor(projectId: string): Promise<EditorGate> {
  if (!projectId || !UUID_RE.test(projectId)) {
    return { supabase: null, error: "Invalid project." };
  }
  const { canEdit } = await getProjectContext(projectId);
  if (!canEdit) {
    return { supabase: null, error: "You need edit access to change the storyboard." };
  }
  return { supabase: await createClient(), error: null };
}

function revalidateBoard(projectId: string) {
  revalidatePath(`/app/projects/${projectId}/storyboard`);
  revalidatePath(`/app/projects/${projectId}/corkboard`);
  revalidatePath(`/app/projects/${projectId}`);
}

function isImageMime(mime: string | null | undefined) {
  return !!mime && mime.startsWith("image/");
}

type ChapterRow = { id: string; title: string; parent_id: string | null; position: number };
type CardRow = { id: string; chapter_id: string; position: number; mood_image_ids: string[] | null };

/**
 * Creates the storyboard_cards rows missing for top-level chapters.
 * Called automatically when either board loads (with revalidate disabled —
 * revalidatePath during render is not allowed) so new chapters always appear.
 */
export async function ensureCards(
  projectId: string,
  options?: { revalidate?: boolean },
): Promise<StoryboardActionResult> {
  const gate = await requireEditor(projectId);
  if (!gate.supabase) return { ok: false, error: gate.error };
  const supabase = gate.supabase;

  const [{ data: chapterData }, { data: cardData }] = await Promise.all([
    supabase
      .from("chapters")
      .select("id, parent_id, position")
      .eq("project_id", projectId)
      .order("position", { ascending: true }),
    supabase.from("storyboard_cards").select("chapter_id, position").eq("project_id", projectId),
  ]);

  const topLevel = ((chapterData ?? []) as Pick<ChapterRow, "id" | "parent_id" | "position">[]).filter(
    (c) => !c.parent_id,
  );
  if (!topLevel.length) return { ok: true, data: { created: 0 } };

  const cards = (cardData ?? []) as Pick<CardRow, "chapter_id" | "position">[];
  const existing = new Set(cards.map((c) => c.chapter_id));
  const missing = topLevel.filter((c) => !existing.has(c.id));
  if (!missing.length) return { ok: true, data: { created: 0 } };

  const start = cards.reduce((max, c) => Math.max(max, c.position ?? 0), -1) + 1;
  const rows = missing.map((chapter, index) => ({
    project_id: projectId,
    chapter_id: chapter.id,
    position: start + index,
  }));

  const { error } = await supabase.from("storyboard_cards").insert(rows);
  if (error) return { ok: false, error: error.message };

  if (options?.revalidate !== false) revalidateBoard(projectId);
  return { ok: true, data: { created: rows.length } };
}

/**
 * Persists a new order for the top-level chapters. `chapterIds` is the full
 * list in the desired order; both chapter and storyboard positions are rewritten.
 */
export async function reorderCards(
  projectId: string,
  chapterIds: string[],
): Promise<StoryboardActionResult> {
  const gate = await requireEditor(projectId);
  if (!gate.supabase) return { ok: false, error: gate.error };
  const supabase = gate.supabase;

  if (!Array.isArray(chapterIds) || chapterIds.length === 0) {
    return { ok: false, error: "Nothing to reorder." };
  }
  const ids = chapterIds.filter((id) => typeof id === "string" && UUID_RE.test(id));
  if (ids.length !== chapterIds.length || new Set(ids).size !== ids.length) {
    return { ok: false, error: "That chapter order is not valid." };
  }

  const { data: chapterData } = await supabase
    .from("chapters")
    .select("id, parent_id")
    .eq("project_id", projectId);
  const allowed = new Set(
    ((chapterData ?? []) as Pick<ChapterRow, "id" | "parent_id">[])
      .filter((c) => !c.parent_id)
      .map((c) => c.id),
  );
  if (ids.length !== allowed.size || ids.some((id) => !allowed.has(id))) {
    return { ok: false, error: "The storyboard is out of date. Refresh the page and try again." };
  }

  const updates = await Promise.all(
    ids.map((id, index) =>
      supabase.from("chapters").update({ position: index }).eq("id", id).eq("project_id", projectId),
    ),
  );
  const failure = updates.find((r) => r.error);
  if (failure?.error) return { ok: false, error: failure.error.message };

  const { error: cardError } = await supabase.from("storyboard_cards").upsert(
    ids.map((chapter_id, position) => ({ project_id: projectId, chapter_id, position })),
    { onConflict: "chapter_id" },
  );
  if (cardError) return { ok: false, error: cardError.message };

  revalidateBoard(projectId);
  await logActivity({
    projectId,
    action: "storyboard.reordered",
    targetType: "storyboard",
    summary: "Reordered the storyboard",
  });
  return { ok: true };
}

/** Pins an asset as the card's primary image, or clears it with null. */
export async function setPrimaryImage(
  projectId: string,
  chapterId: string,
  assetId: string | null,
): Promise<StoryboardActionResult> {
  const gate = await requireEditor(projectId);
  if (!gate.supabase) return { ok: false, error: gate.error };
  const supabase = gate.supabase;

  if (!chapterId || !UUID_RE.test(chapterId)) return { ok: false, error: "Invalid chapter." };
  if (assetId !== null && (typeof assetId !== "string" || !UUID_RE.test(assetId))) {
    return { ok: false, error: "Invalid image." };
  }

  const { data: chapter } = await supabase
    .from("chapters")
    .select("id, title")
    .eq("id", chapterId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!chapter) return { ok: false, error: "That chapter is no longer in this project." };

  let filename = "";
  if (assetId) {
    const { data: asset } = await supabase
      .from("assets")
      .select("id, filename, mime_type")
      .eq("id", assetId)
      .eq("project_id", projectId)
      .maybeSingle();
    if (!asset || !isImageMime(asset.mime_type)) {
      return { ok: false, error: "That file is not an image in this project." };
    }
    filename = asset.filename ?? "";
  }

  const { data: existing } = await supabase
    .from("storyboard_cards")
    .select("id, mood_image_ids")
    .eq("project_id", projectId)
    .eq("chapter_id", chapterId)
    .maybeSingle();

  const mood = ((existing?.mood_image_ids ?? []) as string[]).filter((id) => id !== assetId);

  const { error } = await supabase.from("storyboard_cards").upsert(
    {
      project_id: projectId,
      chapter_id: chapterId,
      primary_image_id: assetId,
      mood_image_ids: mood,
    },
    { onConflict: "chapter_id" },
  );
  if (error) return { ok: false, error: error.message };

  revalidateBoard(projectId);
  await logActivity({
    projectId,
    action: assetId ? "storyboard.image_pinned" : "storyboard.image_cleared",
    targetType: "chapter",
    targetId: chapterId,
    summary: assetId
      ? `Pinned ${filename || "an image"} to “${chapter.title}”`
      : `Removed the pinned image from “${chapter.title}”`,
  });
  return { ok: true };
}

export async function addMoodImage(
  projectId: string,
  chapterId: string,
  assetId: string,
): Promise<StoryboardActionResult> {
  const gate = await requireEditor(projectId);
  if (!gate.supabase) return { ok: false, error: gate.error };
  const supabase = gate.supabase;

  if (!chapterId || !UUID_RE.test(chapterId)) return { ok: false, error: "Invalid chapter." };
  if (!assetId || !UUID_RE.test(assetId)) return { ok: false, error: "Invalid image." };

  const [{ data: chapter }, { data: asset }, { data: existing }] = await Promise.all([
    supabase
      .from("chapters")
      .select("id, title")
      .eq("id", chapterId)
      .eq("project_id", projectId)
      .maybeSingle(),
    supabase
      .from("assets")
      .select("id, filename, mime_type")
      .eq("id", assetId)
      .eq("project_id", projectId)
      .maybeSingle(),
    supabase
      .from("storyboard_cards")
      .select("id, mood_image_ids")
      .eq("project_id", projectId)
      .eq("chapter_id", chapterId)
      .maybeSingle(),
  ]);
  if (!chapter) return { ok: false, error: "That chapter is no longer in this project." };
  if (!asset || !isImageMime(asset.mime_type)) {
    return { ok: false, error: "That file is not an image in this project." };
  }

  const mood = (existing?.mood_image_ids ?? []) as string[];
  if (mood.includes(assetId)) return { ok: true };
  if (mood.length >= MOOD_LIMIT) {
    return { ok: false, error: `A mood board holds ${MOOD_LIMIT} images. Remove one first.` };
  }

  const { error } = await supabase.from("storyboard_cards").upsert(
    {
      project_id: projectId,
      chapter_id: chapterId,
      mood_image_ids: [...mood, assetId],
    },
    { onConflict: "chapter_id" },
  );
  if (error) return { ok: false, error: error.message };

  revalidateBoard(projectId);
  await logActivity({
    projectId,
    action: "storyboard.mood_added",
    targetType: "chapter",
    targetId: chapterId,
    summary: `Added ${asset.filename ?? "an image"} to the mood board for “${chapter.title}”`,
  });
  return { ok: true };
}

export async function removeMoodImage(
  projectId: string,
  chapterId: string,
  assetId: string,
): Promise<StoryboardActionResult> {
  const gate = await requireEditor(projectId);
  if (!gate.supabase) return { ok: false, error: gate.error };
  const supabase = gate.supabase;

  if (!chapterId || !UUID_RE.test(chapterId)) return { ok: false, error: "Invalid chapter." };
  if (!assetId || !UUID_RE.test(assetId)) return { ok: false, error: "Invalid image." };

  const { data: existing } = await supabase
    .from("storyboard_cards")
    .select("id, mood_image_ids")
    .eq("project_id", projectId)
    .eq("chapter_id", chapterId)
    .maybeSingle();
  if (!existing) return { ok: true };

  const mood = ((existing.mood_image_ids ?? []) as string[]).filter((id) => id !== assetId);
  const { error } = await supabase
    .from("storyboard_cards")
    .update({ mood_image_ids: mood })
    .eq("id", existing.id)
    .eq("project_id", projectId);
  if (error) return { ok: false, error: error.message };

  revalidateBoard(projectId);
  await logActivity({
    projectId,
    action: "storyboard.mood_removed",
    targetType: "chapter",
    targetId: chapterId,
    summary: "Removed a mood image",
  });
  return { ok: true };
}

export async function updateCardNotes(
  projectId: string,
  chapterId: string,
  notes: string | null,
): Promise<StoryboardActionResult> {
  const gate = await requireEditor(projectId);
  if (!gate.supabase) return { ok: false, error: gate.error };
  const supabase = gate.supabase;

  if (!chapterId || !UUID_RE.test(chapterId)) return { ok: false, error: "Invalid chapter." };
  if (notes !== null && typeof notes !== "string") return { ok: false, error: "Invalid notes." };

  const clean = (notes ?? "").trim().slice(0, NOTES_LIMIT) || null;

  const { data: chapter } = await supabase
    .from("chapters")
    .select("id, title")
    .eq("id", chapterId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!chapter) return { ok: false, error: "That chapter is no longer in this project." };

  const { error } = await supabase.from("storyboard_cards").upsert(
    { project_id: projectId, chapter_id: chapterId, notes: clean },
    { onConflict: "chapter_id" },
  );
  if (error) return { ok: false, error: error.message };

  revalidateBoard(projectId);
  await logActivity({
    projectId,
    action: "storyboard.notes_updated",
    targetType: "chapter",
    targetId: chapterId,
    summary: `Updated the storyboard notes for “${chapter.title}”`,
  });
  return { ok: true };
}

/**
 * Reconciles storyboard_cards with the current chapter tree: drops cards whose
 * chapter is gone, creates rows for new top-level chapters and normalises the
 * card order to the outline order.
 */
export async function syncCardsFromChapters(projectId: string): Promise<StoryboardActionResult> {
  const gate = await requireEditor(projectId);
  if (!gate.supabase) return { ok: false, error: gate.error };
  const supabase = gate.supabase;

  const [{ data: chapterData }, { data: cardData }] = await Promise.all([
    supabase
      .from("chapters")
      .select("id, parent_id, position")
      .eq("project_id", projectId)
      .order("position", { ascending: true }),
    supabase.from("storyboard_cards").select("id, chapter_id, position").eq("project_id", projectId),
  ]);

  const chapters = (chapterData ?? []) as Pick<ChapterRow, "id" | "parent_id" | "position">[];
  const cards = (cardData ?? []) as CardRow[];
  const chapterIds = new Set(chapters.map((c) => c.id));

  const orphanIds = cards.filter((c) => !chapterIds.has(c.chapter_id)).map((c) => c.id);
  if (orphanIds.length) {
    const { error } = await supabase.from("storyboard_cards").delete().in("id", orphanIds);
    if (error) return { ok: false, error: error.message };
  }

  const topLevel = chapters.filter((c) => !c.parent_id);
  const existing = new Set(cards.map((c) => c.chapter_id));
  const created = topLevel.filter((c) => !existing.has(c.id)).length;

  if (topLevel.length) {
    const { error } = await supabase.from("storyboard_cards").upsert(
      topLevel.map((chapter, position) => ({
        project_id: projectId,
        chapter_id: chapter.id,
        position,
      })),
      { onConflict: "chapter_id" },
    );
    if (error) return { ok: false, error: error.message };
  }

  revalidateBoard(projectId);
  await logActivity({
    projectId,
    action: "storyboard.synced",
    targetType: "storyboard",
    summary: `Synced the storyboard with the outline (${created} added, ${orphanIds.length} removed)`,
  });
  return { ok: true, data: { created, removed: orphanIds.length } };
}
