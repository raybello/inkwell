"use server";

import { revalidatePath } from "next/cache";
import { getProjectContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { deleteProjectAsset } from "@/lib/storage";
import { logActivity } from "@/lib/activity";
import { tiptapToMarkdown, EMPTY_DOC, type TipTapDoc } from "@/lib/markdown";
import type { Asset, Chapter } from "@/lib/types";

export interface AssetActionResult {
  ok: boolean;
  error?: string;
  data?: unknown;
}

async function ctxFor(projectId: string) {
  if (!projectId) return null;
  try {
    return await getProjectContext(projectId);
  } catch {
    return null;
  }
}

function revalidateAssets(projectId: string) {
  revalidatePath(`/app/projects/${projectId}/assets`);
  revalidatePath(`/app/projects/${projectId}/assets/cover`);
  revalidatePath(`/app/projects/${projectId}`);
}

function sanitizeAlt(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, 300);
  return trimmed || null;
}

async function sanitizeTags(value: unknown): Promise<string[]> {
  const raw = Array.isArray(value) ? value.map(String) : typeof value === "string" ? value.split(",") : [];
  const tags = raw
    .map((tag) => tag.trim().toLowerCase().replace(/\s+/g, "-"))
    .filter(Boolean)
    .map((tag) => tag.slice(0, 24));
  return Array.from(new Set(tags)).slice(0, 12);
}

export async function deleteAssetAction(assetId: string): Promise<AssetActionResult> {
  const supabase = await createClient();
  const { data: asset } = await supabase.from("assets").select("*").eq("id", assetId).maybeSingle();
  if (!asset) return { ok: false, error: "Asset not found." };

  const record = asset as Asset;
  const ctx = await ctxFor(record.project_id);
  if (!ctx) return { ok: false, error: "Project not found." };
  if (!ctx.canEdit) return { ok: false, error: "You do not have permission to delete assets." };

  try {
    await deleteProjectAsset(assetId);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not delete the asset." };
  }

  await logActivity({
    projectId: record.project_id,
    action: "asset.deleted",
    targetType: "asset",
    targetId: assetId,
    summary: `Removed ${record.filename}`,
  });

  revalidateAssets(record.project_id);
  return { ok: true };
}

export async function updateAssetAction(
  assetId: string,
  patch: { altText?: string | null; tags?: string[] | string },
): Promise<AssetActionResult> {
  const supabase = await createClient();
  const { data: asset } = await supabase.from("assets").select("*").eq("id", assetId).maybeSingle();
  if (!asset) return { ok: false, error: "Asset not found." };

  const record = asset as Asset;
  const ctx = await ctxFor(record.project_id);
  if (!ctx) return { ok: false, error: "Project not found." };
  if (!ctx.canEdit) return { ok: false, error: "You do not have permission to edit assets." };

  const update: Record<string, unknown> = {};
  if ("altText" in patch) update.alt_text = sanitizeAlt(patch.altText);
  if ("tags" in patch) update.tags = await sanitizeTags(patch.tags);

  if (!Object.keys(update).length) return { ok: true };

  const { error } = await supabase.from("assets").update(update).eq("id", assetId);
  if (error) return { ok: false, error: error.message };

  await logActivity({
    projectId: record.project_id,
    action: "asset.updated",
    targetType: "asset",
    targetId: assetId,
    summary: `Updated details for ${record.filename}`,
  });

  revalidateAssets(record.project_id);
  return { ok: true };
}

export interface InsertImageInput {
  chapterId: string;
  /** Direct image URL. Ignored when assetId is supplied. */
  src?: string;
  assetId?: string;
  alt?: string | null;
  title?: string | null;
  caption?: string | null;
}

/**
 * Appends an image block (plus optional centred caption) to a chapter's TipTap
 * document and keeps `content_md` in sync so word counts stay correct.
 * Used by the editor, storyboard and research streams.
 */
export async function insertImageToChapter(
  input: InsertImageInput,
): Promise<AssetActionResult & { data?: { chapterId: string; src: string } }> {
  const chapterId = (input.chapterId ?? "").trim();
  if (!chapterId) return { ok: false, error: "Missing chapter." };

  const supabase = await createClient();
  const { data: chapterRow } = await supabase.from("chapters").select("*").eq("id", chapterId).maybeSingle();
  if (!chapterRow) return { ok: false, error: "Chapter not found." };
  const chapter = chapterRow as Chapter;

  const ctx = await ctxFor(chapter.project_id);
  if (!ctx) return { ok: false, error: "Project not found." };
  if (!ctx.canEdit) return { ok: false, error: "You do not have permission to edit this chapter." };

  let src = (input.src ?? "").trim();
  let alt = sanitizeAlt(input.alt);
  if (input.assetId) {
    const { data: assetRow } = await supabase.from("assets").select("*").eq("id", input.assetId).maybeSingle();
    if (!assetRow) return { ok: false, error: "Asset not found." };
    const asset = assetRow as Asset;
    if (asset.project_id !== chapter.project_id) return { ok: false, error: "That asset belongs to another project." };
    src = asset.public_url ?? "";
    alt = alt ?? asset.alt_text ?? asset.filename;
  }

  if (!src) return { ok: false, error: "Provide an image URL or asset." };

  const existing =
    chapter.content && typeof chapter.content === "object" && (chapter.content as TipTapDoc).type === "doc"
      ? (chapter.content as TipTapDoc)
      : EMPTY_DOC;

  const nodes: Array<Record<string, unknown>> = [
    ...(existing.content ?? []),
    {
      type: "image",
      attrs: { src, alt: alt ?? "", title: input.title?.trim() || null },
    },
  ];

  const caption = input.caption?.trim();
  if (caption) {
    nodes.push({
      type: "paragraph",
      attrs: { textAlign: "center" },
      content: [{ type: "text", text: caption.slice(0, 400), marks: [{ type: "italic" }] }],
    });
  }

  const doc: TipTapDoc = { type: "doc", content: nodes };
  const markdown = tiptapToMarkdown(doc);

  const { error } = await supabase
    .from("chapters")
    .update({ content: doc, content_md: markdown })
    .eq("id", chapterId);
  if (error) return { ok: false, error: error.message };

  await logActivity({
    projectId: chapter.project_id,
    action: "asset.inserted",
    targetType: "chapter",
    targetId: chapterId,
    summary: `Inserted an image into ${chapter.title}`,
  });

  revalidatePath(`/app/projects/${chapter.project_id}/editor/${chapterId}`);
  revalidatePath(`/app/projects/${chapter.project_id}`);
  revalidateAssets(chapter.project_id);

  return { ok: true, data: { chapterId, src } };
}
