import type { Chapter, Project } from "@/lib/types";
import { asDoc, blocksWithIds, toMarkdown } from "@/lib/api/content";

/** Public, stable field set for a project. Internal columns are not exposed. */
export function serializeProject(project: Project, extra: Record<string, unknown> = {}) {
  return {
    id: project.id,
    title: project.title,
    subtitle: project.subtitle,
    type: project.type,
    genre: project.genre,
    description: project.description,
    cover_image_url: project.cover_image_url,
    target_word_count: project.target_word_count ?? 0,
    publishing_target: project.publishing_target,
    tags: project.tags ?? [],
    status: project.status,
    is_public: project.is_public,
    settings: project.settings ?? {},
    created_at: project.created_at,
    updated_at: project.updated_at,
    ...extra,
  };
}

/** Compact chapter used in list/tree responses (no document body). */
export function serializeChapterSummary(chapter: Chapter, extra: Record<string, unknown> = {}) {
  return {
    id: chapter.id,
    project_id: chapter.project_id,
    parent_id: chapter.parent_id,
    title: chapter.title,
    synopsis: chapter.synopsis,
    status: chapter.status,
    position: chapter.position,
    word_count: chapter.word_count ?? 0,
    pov: chapter.pov,
    tags: chapter.tags ?? [],
    created_at: chapter.created_at,
    updated_at: chapter.updated_at,
    ...extra,
  };
}

/** Full chapter, including the TipTap document and numbered blocks. */
export function serializeChapter(chapter: Chapter) {
  const doc = asDoc(chapter.content);
  return {
    ...serializeChapterSummary(chapter),
    arc: chapter.arc,
    subplot: chapter.subplot,
    color: chapter.color,
    notes: chapter.notes,
    content: doc,
    content_md: chapter.content_md ?? toMarkdown(doc),
    blocks: blocksWithIds(doc),
  };
}

export function serializeAsset(asset: {
  id: string;
  filename: string;
  public_url: string | null;
  mime_type: string | null;
  size_bytes: number;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  source: string;
  tags: string[] | null;
  created_at: string;
}) {
  return {
    id: asset.id,
    filename: asset.filename,
    url: asset.public_url,
    mime_type: asset.mime_type,
    size_bytes: asset.size_bytes,
    width: asset.width,
    height: asset.height,
    alt_text: asset.alt_text,
    source: asset.source,
    tags: asset.tags ?? [],
    created_at: asset.created_at,
  };
}
