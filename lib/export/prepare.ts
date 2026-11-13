import { tiptapToMarkdown, tiptapToHtml, markdownToTiptap } from "@/lib/markdown";
import type { Asset, Chapter, Note, Project } from "@/lib/types";
import { normalizeSceneBreaks, stripLeadingTitleHeading } from "./html-parse";
import { resolveStyle } from "./styles";
import type {
  ExportChapter,
  ExportDocument,
  ExportOptions,
  ExportScope,
  GenerateExportInput,
  StyleName,
} from "./types";

function markdownFallbackHtml(markdown: string): string {
  if (!markdown.trim()) return "";
  // Chapters created through the API may only have the markdown mirror; parse
  // it into TipTap JSON so every format gets headings, lists and images.
  return tiptapToHtml(markdownToTiptap(markdown));
}

function chapterHtml(chapter: Chapter): string {
  let html = "";
  try {
    html = tiptapToHtml(chapter.content);
  } catch {
    html = "";
  }
  if (!html.trim()) html = markdownFallbackHtml(chapter.content_md ?? "");
  return normalizeSceneBreaks(stripLeadingTitleHeading(html, chapter.title ?? ""));
}

function normaliseTitle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s\u00a0—–-]+/g, " ")
    .replace(/[^\w ]/g, "")
    .trim();
}

function chapterMarkdown(chapter: Chapter): string {
  let markdown = "";
  try {
    markdown = chapter.content_md?.trim() || tiptapToMarkdown(chapter.content).trim();
  } catch {
    markdown = chapter.content_md?.trim() ?? "";
  }
  if (!markdown) return "";
  // Drop a leading H1 that merely repeats the outline title.
  const heading = markdown.match(/^#\s+(.+)\n+/);
  if (heading && normaliseTitle(heading[1]) === normaliseTitle(chapter.title ?? "")) {
    markdown = markdown.slice(heading[0].length).trim();
  }
  return markdown;
}

function projectAuthor(project: Project, authorName?: string | null): string {
  const settingsAuthor = project.settings && typeof project.settings === "object" ? project.settings.author : null;
  if (typeof settingsAuthor === "string" && settingsAuthor.trim()) return settingsAuthor.trim();
  if (authorName && authorName.trim()) return authorName.trim();
  return "";
}

export function normaliseStyle(value: StyleName | string | null | undefined): StyleName {
  return resolveStyle(value).id;
}

export function buildExportDocument(input: GenerateExportInput): ExportDocument {
  const style = resolveStyle(input.style);
  const scope: ExportScope = input.scope === "chapter" ? "chapter" : "project";
  const options: ExportOptions = { ...(input.options ?? {}) };
  const language = (options.language ?? projectLanguage(input.project)) || "en";
  const now = input.now ?? new Date();

  const ordered = [...input.chapters].sort((a, b) => a.position - b.position);
  const selected =
    scope === "chapter" && input.chapterId
      ? ordered.filter((c) => c.id === input.chapterId)
      : scope === "chapter"
        ? ordered.slice(0, 1)
        : ordered;

  const chapters: ExportChapter[] = selected.map((chapter) => ({
    id: chapter.id,
    title: (chapter.title ?? "").trim() || "Untitled Chapter",
    synopsis: options.includeSynopses ? chapter.synopsis : null,
    markdown: chapterMarkdown(chapter),
    html: chapterHtml(chapter),
    content: chapter.content ?? null,
    position: chapter.position,
    parentId: chapter.parent_id,
    wordCount: chapter.word_count ?? 0,
    status: chapter.status,
  }));

  const author = options.author?.trim() || projectAuthor(input.project, input.authorName);
  const resolvedOptions = {
    ...options,
    includeCover: options.includeCover !== false,
    includeToc: options.includeToc !== false,
    includeSynopses: options.includeSynopses === true,
    dropCaps: options.dropCaps ?? style.dropCap,
    chapterBreaks: options.chapterBreaks !== false,
    language,
  };

  return {
    project: input.project,
    title: (input.project.title ?? "").trim() || "Untitled",
    subtitle: input.project.subtitle?.trim() || null,
    author,
    description: input.project.description?.trim() || null,
    genre: input.project.genre?.trim() || null,
    language,
    coverUrl: input.project.cover_image_url?.trim() || null,
    chapters,
    assets: (input.assets ?? []).map((asset: Asset) => ({
      id: asset.id,
      filename: asset.filename,
      url: asset.public_url,
      mimeType: asset.mime_type,
    })),
    notes: (input.notes ?? []).map((note: Note) => ({
      id: note.id,
      title: note.title,
      kind: note.kind,
      body: note.body,
      tags: note.tags ?? [],
    })),
    scope,
    style: style.id,
    options: resolvedOptions,
    identifier: `urn:uuid:${scope === "chapter" && selected[0] ? selected[0].id : input.project.id}`,
    createdAt: now,
    wordCount: chapters.reduce((sum, c) => sum + c.wordCount, 0),
  };
}

function projectLanguage(project: Project): string | null {
  const settings = project.settings;
  if (settings && typeof settings === "object" && typeof settings.language === "string") return settings.language;
  return null;
}

/** Filename-safe base name for an export, e.g. `the-salt-road` or `the-salt-road-chapter-one`. */
export function exportBaseName(doc: ExportDocument): string {
  const slug = (value: string) =>
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60) || "inkwell";
  if (doc.scope === "chapter" && doc.chapters[0]) {
    return `${slug(doc.title)}-${slug(doc.chapters[0].title)}`.slice(0, 90);
  }
  return slug(doc.title);
}
