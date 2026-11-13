"use server";

import { revalidatePath } from "next/cache";
import { getProjectContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity";
import type { Asset } from "@/lib/types";

export interface CoverActionResult {
  ok: boolean;
  error?: string;
  data?: { url: string | null };
}

async function ctxFor(projectId: string) {
  if (!projectId) return null;
  try {
    return await getProjectContext(projectId);
  } catch {
    return null;
  }
}

function revalidateProject(projectId: string) {
  revalidatePath(`/app/projects/${projectId}/assets`);
  revalidatePath(`/app/projects/${projectId}/assets/cover`);
  revalidatePath(`/app/projects/${projectId}`);
  revalidatePath("/app");
}

async function applyCover(
  projectId: string,
  url: string | null,
  summary: string,
): Promise<CoverActionResult> {
  const ctx = await ctxFor(projectId);
  if (!ctx) return { ok: false, error: "Project not found." };
  if (!ctx.canEdit) return { ok: false, error: "You do not have permission to change the cover." };

  const supabase = await createClient();
  const { error } = await supabase.from("projects").update({ cover_image_url: url }).eq("id", projectId);
  if (error) return { ok: false, error: error.message };

  await logActivity({
    projectId,
    action: "project.cover.updated",
    targetType: "project",
    targetId: projectId,
    summary,
  });

  revalidateProject(projectId);
  return { ok: true, data: { url } };
}

/** Sets `projects.cover_image_url` to an uploaded asset after verifying it belongs to the project. */
export async function setProjectCoverAction(input: {
  projectId: string;
  assetId?: string;
  url?: string;
}): Promise<CoverActionResult> {
  const projectId = (input.projectId ?? "").trim();
  const assetId = (input.assetId ?? "").trim();

  if (assetId) {
    const supabase = await createClient();
    const { data } = await supabase.from("assets").select("*").eq("id", assetId).maybeSingle();
    if (!data) return { ok: false, error: "Asset not found." };
    const asset = data as Asset;
    if (asset.project_id !== projectId) return { ok: false, error: "That asset belongs to another project." };
    const url = asset.public_url;
    if (!url) return { ok: false, error: "That asset has no public URL." };
    return applyCover(projectId, url, `Set ${asset.filename} as the project cover`);
  }

  const url = (input.url ?? "").trim();
  if (!/^https:\/\//i.test(url)) return { ok: false, error: "Cover images must use an https URL." };
  return applyCover(projectId, url, "Updated the project cover");
}

/** Convenience for asset-library tiles that only know the asset id. */
export async function setCoverFromAssetAction(assetId: string): Promise<CoverActionResult> {
  const id = (assetId ?? "").trim();
  if (!id) return { ok: false, error: "Missing asset." };
  const supabase = await createClient();
  const { data } = await supabase.from("assets").select("*").eq("id", id).maybeSingle();
  if (!data) return { ok: false, error: "Asset not found." };
  const asset = data as Asset;
  if (!asset.public_url) return { ok: false, error: "That asset has no public URL." };
  return applyCover(asset.project_id, asset.public_url, `Set ${asset.filename} as the project cover`);
}

export async function clearProjectCoverAction(projectId: string): Promise<CoverActionResult> {
  return applyCover(projectId, null, "Removed the project cover");
}
