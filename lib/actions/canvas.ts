"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getProjectContext } from "@/lib/data";
import { logActivity } from "@/lib/activity";
import { uploadProjectAsset } from "@/lib/storage";

export type CanvasActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const NAME_MAX = 120;
const THUMB_MAX = 6000;
const SNAPSHOT_MAX = 12 * 1024 * 1024;
const TEXT_MAX = 20000;

function cleanName(raw: unknown) {
  const name = typeof raw === "string" ? raw.replace(/\s+/g, " ").trim() : "";
  return name.slice(0, NAME_MAX);
}

async function canvasProject(canvasId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("canvases")
    .select("id, project_id, name")
    .eq("id", canvasId)
    .maybeSingle();
  return data as { id: string; project_id: string; name: string } | null;
}

/** Creates a named canvas and returns its id so the client can open it immediately. */
export async function createCanvas(
  projectId: string,
  name: string,
): Promise<CanvasActionResult<{ id: string; name: string }>> {
  const title = cleanName(name) || "Untitled canvas";
  const ctx = await getProjectContext(projectId);
  if (!ctx.canEdit) return { ok: false, error: "You do not have permission to add canvases." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("canvases")
    .insert({
      project_id: projectId,
      name: title,
      created_by: ctx.profile?.id ?? null,
      content: null,
    })
    .select("id, name")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "Could not create the canvas." };

  await logActivity({
    projectId,
    action: "canvas.created",
    targetType: "canvas",
    targetId: data.id,
    summary: `Created canvas “${data.name}”`,
  });

  revalidatePath(`/app/projects/${projectId}/canvas`);
  revalidatePath(`/app/projects/${projectId}`);
  return { ok: true, data: { id: data.id, name: data.name } };
}

export async function renameCanvas(
  canvasId: string,
  name: string,
): Promise<CanvasActionResult<{ name: string }>> {
  const title = cleanName(name);
  if (!title) return { ok: false, error: "Give the canvas a name." };

  const canvas = await canvasProject(canvasId);
  if (!canvas) return { ok: false, error: "Canvas not found." };

  const ctx = await getProjectContext(canvas.project_id);
  if (!ctx.canEdit) return { ok: false, error: "You do not have permission to rename this canvas." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("canvases")
    .update({ name: title, updated_at: new Date().toISOString() })
    .eq("id", canvasId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/app/projects/${canvas.project_id}/canvas`);
  revalidatePath(`/app/projects/${canvas.project_id}/canvas/${canvasId}`);
  return { ok: true, data: { name: title } };
}

export async function deleteCanvas(canvasId: string): Promise<CanvasActionResult> {
  const canvas = await canvasProject(canvasId);
  if (!canvas) return { ok: false, error: "Canvas not found." };

  const ctx = await getProjectContext(canvas.project_id);
  if (!ctx.canEdit) return { ok: false, error: "You do not have permission to delete this canvas." };

  const supabase = await createClient();
  const { error } = await supabase.from("canvases").delete().eq("id", canvasId);
  if (error) return { ok: false, error: error.message };

  await logActivity({
    projectId: canvas.project_id,
    action: "canvas.deleted",
    targetType: "canvas",
    targetId: canvasId,
    summary: `Deleted canvas “${canvas.name}”`,
  });

  revalidatePath(`/app/projects/${canvas.project_id}/canvas`);
  revalidatePath(`/app/projects/${canvas.project_id}`);
  return { ok: true, data: undefined };
}

/**
 * Persists a tldraw snapshot (document + session page state) and the compact JSON
 * preview. Called from the board's debounced autosave, ⌘S and teardown handlers, so it
 * must stay cheap and never throw — the client turns failures into a save indicator.
 */
export async function saveCanvasContent(
  canvasId: string,
  snapshot: string | Record<string, unknown>,
  thumbnailUrl?: string | null,
): Promise<CanvasActionResult<{ savedAt: string }>> {
  // New clients send the snapshot as JSON text. Objects are still accepted so a
  // tab running an older bundle keeps working.
  let content: Record<string, unknown>;
  if (typeof snapshot === "string") {
    if (snapshot.length < 2) return { ok: false, error: "Empty snapshot." };
    if (snapshot.length > SNAPSHOT_MAX) {
      return { ok: false, error: "This canvas is too large to save. Remove some images and try again." };
    }
    try {
      const parsed = JSON.parse(snapshot) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return { ok: false, error: "Malformed snapshot." };
      }
      content = parsed as Record<string, unknown>;
    } catch {
      return { ok: false, error: "Malformed snapshot." };
    }
  } else if (snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)) {
    content = snapshot;
  } else {
    return { ok: false, error: "Empty snapshot." };
  }

  const canvas = await canvasProject(canvasId);
  if (!canvas) return { ok: false, error: "Canvas not found." };

  const ctx = await getProjectContext(canvas.project_id);
  if (!ctx.canEdit) return { ok: false, error: "View-only access." };

  // Only keep previews that are small enough to live in a text column.
  let thumb: string | null = null;
  if (typeof thumbnailUrl === "string" && thumbnailUrl.startsWith("data:application/json")) {
    thumb = thumbnailUrl.length <= THUMB_MAX ? thumbnailUrl : null;
  }

  const savedAt = new Date().toISOString();
  const supabase = await createClient();
  const { error } = await supabase
    .from("canvases")
    .update({ content, thumbnail_url: thumb, updated_at: savedAt })
    .eq("id", canvasId);

  if (error) return { ok: false, error: error.message };

  // No revalidatePath here: autosave runs every few seconds and would otherwise
  // invalidate the gallery on every keystroke. Its pages are force-dynamic.
  return { ok: true, data: { savedAt } };
}

export type ClipMode = "note" | "storyboard";

/**
 * "Clip to project": turns a canvas selection into a chapter note or appends it to a
 * chapter's storyboard notes. Text is already flattened client-side (text/note/geo shapes).
 */
export async function clipSelection(input: {
  canvasId: string;
  mode: ClipMode;
  title: string;
  text: string;
  chapterId?: string | null;
  shapeCount: number;
}): Promise<CanvasActionResult<{ id: string; label: string }>> {
  const canvas = await canvasProject(input.canvasId);
  if (!canvas) return { ok: false, error: "Canvas not found." };

  const ctx = await getProjectContext(canvas.project_id);
  if (!ctx.canEdit) return { ok: false, error: "You do not have permission to clip from this canvas." };

  const title = cleanName(input.title) || `${canvas.name} clip`;
  const text = typeof input.text === "string" ? input.text.trim().slice(0, TEXT_MAX) : "";
  const shapeCount = Math.max(0, Math.min(9999, Math.round(Number(input.shapeCount) || 0)));
  if (!text && !shapeCount) return { ok: false, error: "Select something on the canvas first." };

  const supabase = await createClient();
  const meta = {
    source: "canvas" as const,
    canvas_id: canvas.id,
    canvas_name: canvas.name,
    shape_count: shapeCount,
    clipped_at: new Date().toISOString(),
  };

  if (input.mode === "note") {
    const { data, error } = await supabase
      .from("notes")
      .insert({
        project_id: canvas.project_id,
        kind: "note",
        title,
        body: text || `${shapeCount} canvas item${shapeCount === 1 ? "" : "s"}.`,
        data: meta,
        created_by: ctx.profile?.id ?? null,
      })
      .select("id")
      .single();

    if (error || !data) return { ok: false, error: error?.message ?? "Could not save the note." };

    await logActivity({
      projectId: canvas.project_id,
      action: "canvas.clipped",
      targetType: "note",
      targetId: data.id,
      summary: `Clipped “${canvas.name}” to project notes`,
    });

    revalidatePath(`/app/projects/${canvas.project_id}`);
    revalidatePath(`/app/projects/${canvas.project_id}/canvas/${canvas.id}`);
    return { ok: true, data: { id: data.id, label: "Chapter note created" } };
  }

  const chapterId = typeof input.chapterId === "string" ? input.chapterId : "";
  if (!chapterId) return { ok: false, error: "Choose a chapter for the storyboard card." };

  const { data: chapter } = await supabase
    .from("chapters")
    .select("id, title")
    .eq("id", chapterId)
    .eq("project_id", canvas.project_id)
    .maybeSingle();
  if (!chapter) return { ok: false, error: "That chapter is not part of this project." };

  const block = [
    `Canvas clip — ${canvas.name} · ${shapeCount} item${shapeCount === 1 ? "" : "s"}`,
    text,
  ]
    .filter(Boolean)
    .join("\n");

  const { data: existing } = await supabase
    .from("storyboard_cards")
    .select("id, notes")
    .eq("chapter_id", chapterId)
    .maybeSingle();

  if (existing) {
    const notes = existing.notes ? `${existing.notes}\n\n---\n\n${block}` : block;
    const { error } = await supabase
      .from("storyboard_cards")
      .update({ notes, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };

    await logActivity({
      projectId: canvas.project_id,
      action: "canvas.clipped",
      targetType: "storyboard_card",
      targetId: existing.id,
      summary: `Clipped “${canvas.name}” to the storyboard`,
    });

    revalidatePath(`/app/projects/${canvas.project_id}/storyboard`);
    return { ok: true, data: { id: existing.id, label: "Added to storyboard notes" } };
  }

  const { data: last } = await supabase
    .from("storyboard_cards")
    .select("position")
    .eq("project_id", canvas.project_id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("storyboard_cards")
    .insert({
      project_id: canvas.project_id,
      chapter_id: chapterId,
      position: (last?.position ?? -1) + 1,
      notes: block,
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "Could not create the storyboard card." };

  await logActivity({
    projectId: canvas.project_id,
    action: "canvas.clipped",
    targetType: "storyboard_card",
    targetId: data.id,
    summary: `Clipped “${canvas.name}” to ${chapter.title}`,
  });

  revalidatePath(`/app/projects/${canvas.project_id}/storyboard`);
  return { ok: true, data: { id: data.id, label: "Storyboard card created" } };
}

/**
 * Uploads a picked image into the project's assets bucket (reusing the shared storage
 * helper) and returns its public URL + intrinsic size so the board can place a shape.
 */
export async function uploadCanvasImage(
  formData: FormData,
): Promise<CanvasActionResult<{ url: string; w: number; h: number; name: string; mimeType: string }>> {
  const projectId = String(formData.get("projectId") ?? "");
  const file = formData.get("file");
  if (!projectId || !(file instanceof File)) return { ok: false, error: "No image was provided." };
  if (!file.type.startsWith("image/")) return { ok: false, error: "Only image files can be added to a canvas." };
  if (file.size > 12 * 1024 * 1024) return { ok: false, error: "Images must be under 12 MB." };

  const ctx = await getProjectContext(projectId);
  if (!ctx.canEdit) return { ok: false, error: "You do not have permission to add images." };

  const w = Number(formData.get("w")) || 0;
  const h = Number(formData.get("h")) || 0;

  try {
    const asset = await uploadProjectAsset({
      projectId,
      file,
      filename: file.name || "canvas-image",
      contentType: file.type,
    });

    if (asset?.id && w > 0 && h > 0) {
      const supabase = await createClient();
      await supabase.from("assets").update({ width: w, height: h }).eq("id", asset.id);
    }

    if (!asset?.public_url) return { ok: false, error: "Upload finished but no URL was returned." };

    return {
      ok: true,
      data: { url: asset.public_url, w, h, name: file.name || "canvas-image", mimeType: file.type },
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Upload failed." };
  }
}
