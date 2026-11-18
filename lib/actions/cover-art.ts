"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { getProjectContext } from "@/lib/data";
import { logActivity } from "@/lib/activity";
import { uploadProjectAsset } from "@/lib/storage";
import { defaultCoverDoc, normaliseCoverDoc, type CoverDoc, type CoverSide } from "@/lib/cover-art";

export type CoverActionResult = { ok: true; data?: Record<string, unknown> } | { ok: false; error: string };

type EditorGuard =
  | { ok: true; userId: string }
  | { ok: false; error: string };

async function assertEditor(projectId: string): Promise<EditorGuard> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  const ctx = await getProjectContext(projectId);
  if (!ctx.canEdit) return { ok: false, error: "You do not have permission to edit this project." };
  return { ok: true, userId: user.id };
}

/** Persists the editable layer document (both sides) without re-rendering. */
export async function saveCoverLayout(
  projectId: string,
  raw: unknown,
): Promise<CoverActionResult> {
  const guard = await assertEditor(projectId);
  if (!guard.ok) return { ok: false, error: guard.error };

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("title, subtitle, description, settings, cover_front, cover_back")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return { ok: false, error: "Project not found." };

  const author =
    (project.settings as Record<string, unknown> | null)?.author &&
    typeof (project.settings as Record<string, unknown>).author === "string"
      ? String((project.settings as Record<string, unknown>).author)
      : "";

  const fallback = defaultCoverDoc({
    title: project.title ?? "Untitled",
    subtitle: project.subtitle ?? null,
    author,
    description: project.description ?? null,
  });

  const doc = normaliseCoverDoc(raw, fallback);

  const { error } = await supabase
    .from("projects")
    .update({
      cover_front: doc.front,
      cover_back: doc.back,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/app/projects/${projectId}`);
  revalidatePath(`/app/projects/${projectId}/cover`);
  return { ok: true };
}

/**
 * Stores a rendered PNG for one side in the asset library, then points the
 * project at it. The front doubles as `cover_image_url`, which is what library
 * cards and every export format read.
 */
export async function saveRenderedCover(input: {
  projectId: string;
  side: CoverSide;
  /** base64 (no data: prefix) PNG at 2× cover size. */
  pngBase64: string;
  width: number;
  height: number;
  doc: unknown;
}): Promise<CoverActionResult> {
  const guard = await assertEditor(input.projectId);
  if (!guard.ok) return { ok: false, error: guard.error };

  if (!input.pngBase64) return { ok: false, error: "Nothing was rendered." };
  const bytes = Buffer.from(input.pngBase64, "base64");
  if (bytes.byteLength > 24 * 1024 * 1024) {
    return { ok: false, error: "The rendered cover is larger than 24 MB. Try a smaller background image." };
  }

  const supabase = await createClient();

  // Remember the render this one supersedes so re-rendering does not pile up
  // orphaned PNGs in the asset library and storage bucket.
  const { data: existing } = await supabase
    .from("projects")
    .select("cover_front_url, cover_back_url")
    .eq("id", input.projectId)
    .maybeSingle();
  const previousUrl =
    input.side === "front"
      ? (existing as { cover_front_url?: string | null } | null)?.cover_front_url
      : (existing as { cover_back_url?: string | null } | null)?.cover_back_url;

  const filename = `${input.side}-cover-${Date.now()}.png`;
  const file = new File([bytes], filename, { type: "image/png" });

  let asset;
  try {
    asset = await uploadProjectAsset({
      projectId: input.projectId,
      file,
      filename,
      contentType: "image/png",
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Upload failed." };
  }

  const patch: Record<string, unknown> = {
    cover_front: input.side === "front" ? normaliseCoverDoc(input.doc, input.doc as CoverDoc).front : undefined,
    cover_back: input.side === "back" ? normaliseCoverDoc(input.doc, input.doc as CoverDoc).back : undefined,
  };
  if (input.side === "front") {
    patch.cover_front_url = asset.public_url;
    patch.cover_image_url = asset.public_url;
  } else {
    patch.cover_back_url = asset.public_url;
  }
  for (const key of Object.keys(patch)) if (patch[key] === undefined) delete patch[key];

  const { error } = await supabase.from("projects").update(patch).eq("id", input.projectId);
  if (error) return { ok: false, error: error.message };

  // Drop the superseded render (row + storage object) once the new one is live.
  if (previousUrl && previousUrl !== asset.public_url) {
    const { data: stale } = await supabase
      .from("assets")
      .select("id, storage_path, filename")
      .eq("project_id", input.projectId)
      .eq("public_url", previousUrl)
      .like("filename", "%-cover-%")
      .maybeSingle();
    if (stale) {
      if (stale.storage_path) await supabase.storage.from("assets").remove([stale.storage_path]);
      await supabase.from("assets").delete().eq("id", stale.id);
    }
  }

  await logActivity({
    projectId: input.projectId,
    action: "cover.updated",
    targetType: "project",
    targetId: input.projectId,
    summary: `${input.side === "front" ? "Front" : "Back"} cover updated`,
  });

  revalidatePath(`/app/projects/${input.projectId}`);
  revalidatePath(`/app/projects/${input.projectId}/cover`);
  revalidatePath("/app");

  return {
    ok: true,
    data: {
      url: asset.public_url,
      assetId: asset.id,
      side: input.side,
      savedBy: guard.userId,
    },
  };
}

/** Clears a rendered cover (keeps the layer document so it can be re-rendered). */
export async function clearRenderedCover(
  projectId: string,
  side: CoverSide,
): Promise<CoverActionResult> {
  const guard = await assertEditor(projectId);
  if (!guard.ok) return { ok: false, error: guard.error };

  const supabase = await createClient();
  const patch =
    side === "front"
      ? { cover_front_url: null, cover_image_url: null }
      : { cover_back_url: null };
  const { error } = await supabase.from("projects").update(patch).eq("id", projectId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/app/projects/${projectId}/cover`);
  revalidatePath("/app");
  return { ok: true };
}