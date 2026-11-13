import type { Asset, Chapter, Note, Project } from "@/lib/types";

export type ExportFormat =
  | "markdown"
  | "docx"
  | "epub"
  | "pdf"
  | "pdf_screen"
  | "html"
  | "json";

export type StyleName = "literary" | "modern" | "minimal";
export type PageSizeName = "6x9" | "a5" | "a4";
export type ExportScope = "project" | "chapter";

export interface ExportOptions {
  /** Include the project cover image where the format supports it. */
  includeCover?: boolean;
  /** Include a generated table of contents. */
  includeToc?: boolean;
  /** Include chapter synopses as epigraphs / intro paragraphs. */
  includeSynopses?: boolean;
  /** Trim size for print PDF (screen mode always uses A4 unless overridden). */
  pageSize?: PageSizeName;
  /** Drop caps on chapter openers (print PDF / EPUB / HTML). */
  dropCaps?: boolean;
  /** Start every chapter on a new page in screen PDFs. */
  chapterBreaks?: boolean;
  /** Override the author imprint. */
  author?: string;
  language?: string;
}

export interface ExportChapter {
  id: string;
  title: string;
  synopsis: string | null;
  /** Markdown mirror, always present (possibly empty). */
  markdown: string;
  /** Sanitised-ish HTML fragment rendered from TipTap JSON. */
  html: string;
  /** Raw TipTap JSON, preserved for the JSON backup format. */
  content: unknown;
  position: number;
  parentId: string | null;
  wordCount: number;
  status: Chapter["status"];
}

export interface ExportAsset {
  id: string;
  filename: string;
  url: string | null;
  mimeType: string | null;
}

export interface ExportNote {
  id: string;
  title: string;
  kind: Note["kind"];
  body: string | null;
  tags: string[];
}

export interface ExportDocument {
  project: Project;
  title: string;
  subtitle: string | null;
  author: string;
  description: string | null;
  genre: string | null;
  language: string;
  coverUrl: string | null;
  /** Rendered back cover PNG, embedded at the end where the format allows. */
  backCoverUrl: string | null;
  chapters: ExportChapter[];
  assets: ExportAsset[];
  notes: ExportNote[];
  scope: ExportScope;
  style: StyleName;
  options: Required<
    Pick<ExportOptions, "includeCover" | "includeToc" | "includeSynopses" | "dropCaps" | "chapterBreaks" | "language">
  > &
    ExportOptions;
  /** Deterministic urn:uuid derived from the project id, used for EPUB dc:identifier. */
  identifier: string;
  createdAt: Date;
  wordCount: number;
}

export interface GenerateExportInput {
  project: Project;
  chapters: Chapter[];
  format: ExportFormat;
  style?: StyleName | string | null;
  options?: ExportOptions | null;
  scope?: ExportScope;
  chapterId?: string | null;
  assets?: Asset[];
  notes?: Note[];
  authorName?: string | null;
  now?: Date;
}

export interface GeneratedExport {
  bytes: Uint8Array;
  filename: string;
  contentType: string;
}

export interface FetchedImage {
  url: string;
  bytes: Uint8Array;
  mime: string;
  ext: "png" | "jpg" | "gif" | "webp" | "svg";
  width?: number;
  height?: number;
}

export type ImageMap = Map<string, FetchedImage>;

export const FORMAT_META: Record<
  ExportFormat,
  { label: string; ext: string; contentType: string; blurb: string }
> = {
  epub: {
    label: "EPUB 3",
    ext: "epub",
    contentType: "application/epub+zip",
    blurb: "Reflowable e-book for Kindle, Apple Books and Kobo — embedded images and a real TOC.",
  },
  pdf: {
    label: "PDF — Print",
    ext: "pdf",
    contentType: "application/pdf",
    blurb: "Typeset pages with running heads, page numbers and a print-ready trim size.",
  },
  pdf_screen: {
    label: "PDF — Screen",
    ext: "pdf",
    contentType: "application/pdf",
    blurb: "A4 reading copy with a clickable table of contents.",
  },
  docx: {
    label: "DOCX",
    ext: "docx",
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    blurb: "Standard manuscript format — double-spaced, 12 pt serif, title page.",
  },
  markdown: {
    label: "Markdown",
    ext: "md",
    contentType: "text/markdown; charset=utf-8",
    blurb: "Portable plain text with YAML front matter, ready for any static site.",
  },
  html: {
    label: "HTML",
    ext: "html",
    contentType: "text/html; charset=utf-8",
    blurb: "A single self-contained web page with embedded styles and a linked TOC.",
  },
  json: {
    label: "JSON",
    ext: "json",
    contentType: "application/json; charset=utf-8",
    blurb: "Complete project backup — chapters, assets and notes, for APIs and archives.",
  },
};

export const FORMAT_ORDER: ExportFormat[] = ["epub", "pdf", "pdf_screen", "docx", "markdown", "html", "json"];
