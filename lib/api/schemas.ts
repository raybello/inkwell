import { z } from "zod";

const trimmed = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).nullish();

export const uuidSchema = z.string().uuid("Expected a UUID.");

/* ------------------------------------------------------------------ projects */

export const projectTypeSchema = z.enum(["book", "ebook", "article", "blog", "custom"]);

export const createProjectSchema = z.object({
  title: trimmed(200),
  subtitle: optionalText(300),
  type: projectTypeSchema.default("book"),
  genre: optionalText(120),
  description: optionalText(5000),
  cover_image_url: z.string().url().max(2000).nullish(),
  target_word_count: z.number().int().min(0).max(10_000_000).optional(),
  publishing_target: optionalText(200),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  settings: z.record(z.unknown()).optional(),
});

export const updateProjectSchema = z
  .object({
    title: trimmed(200).optional(),
    subtitle: optionalText(300),
    type: projectTypeSchema.optional(),
    genre: optionalText(120),
    description: optionalText(5000),
    cover_image_url: z.string().url().max(2000).nullish(),
    target_word_count: z.number().int().min(0).max(10_000_000).optional(),
    publishing_target: optionalText(200),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
    settings: z.record(z.unknown()).optional(),
    status: z.enum(["draft", "in_progress", "complete", "archived"]).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update.",
  });

/* ------------------------------------------------------------------ chapters */

export const chapterStatusSchema = z.enum(["draft", "in_progress", "complete", "needs_review"]);

const tipTapDocSchema = z
  .object({ type: z.literal("doc"), content: z.array(z.record(z.unknown())).optional() })
  .passthrough();

export const createChapterSchema = z
  .object({
    title: trimmed(300).default("Untitled Chapter"),
    parent_id: uuidSchema.nullish(),
    synopsis: optionalText(5000),
    status: chapterStatusSchema.optional(),
    position: z.number().int().min(0).max(10_000).optional(),
    pov: optionalText(120),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
    notes: optionalText(20_000),
    content: tipTapDocSchema.optional(),
    content_md: z.string().max(500_000).optional(),
  })
  .refine((value) => !(value.content && value.content_md !== undefined), {
    message: "Send either `content` (TipTap JSON) or `content_md` (Markdown), not both.",
  });

export const updateChapterSchema = z
  .object({
    title: trimmed(300).optional(),
    parent_id: uuidSchema.nullish(),
    synopsis: optionalText(5000),
    status: chapterStatusSchema.optional(),
    position: z.number().int().min(0).max(10_000).optional(),
    pov: optionalText(120),
    arc: optionalText(300),
    subplot: optionalText(300),
    color: optionalText(40),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
    notes: optionalText(20_000),
    content: tipTapDocSchema.optional(),
    content_md: z.string().max(500_000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update.",
  })
  .refine((value) => !(value.content && value.content_md !== undefined), {
    message: "Send either `content` (TipTap JSON) or `content_md` (Markdown), not both.",
  });

export const appendBlockSchema = z.object({
  text: z.string().min(1, "Text is required.").max(50_000),
  format: z.enum(["plain", "markdown"]).optional(),
  as: z.enum(["paragraph", "heading1", "heading2", "heading3", "blockquote"]).optional(),
});

export const updateBlockSchema = z
  .object({
    text: z.string().max(50_000).optional(),
    attrs: z.record(z.unknown()).optional(),
    type: z.enum(["paragraph", "heading", "blockquote", "codeBlock"]).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide `text`, `attrs` or `type`.",
  });

export const reorderChaptersSchema = z.object({
  order: z
    .array(
      z.object({
        id: uuidSchema,
        position: z.number().int().min(0).max(10_000).optional(),
        parent_id: uuidSchema.nullish(),
      }),
    )
    .min(1)
    .max(1000),
});

/* ------------------------------------------------------------------- assets */

export const ALLOWED_ASSET_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "video/mp4",
  "application/pdf",
] as const;

export const MAX_ASSET_BYTES = 25 * 1024 * 1024;

/* ---------------------------------------------------------------- storyboard */

export const pinStoryboardSchema = z.object({
  asset_id: uuidSchema,
});

/* ------------------------------------------------------------------ canvases */

export const canvasElementSchema = z.object({
  type: z.enum(["note", "image", "shape", "text"]),
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().positive().max(20_000).optional(),
  height: z.number().finite().positive().max(20_000).optional(),
  text: z.string().max(10_000).optional(),
  asset_id: uuidSchema.nullish(),
  url: z.string().url().max(2000).nullish(),
  color: z.string().max(40).optional(),
  meta: z.record(z.unknown()).optional(),
});

/* -------------------------------------------------------------------- export */

export const exportFormatSchema = z.enum([
  "markdown",
  "docx",
  "epub",
  "pdf",
  "pdf_screen",
  "html",
  "json",
]);

export const createExportSchema = z.object({
  format: exportFormatSchema,
  style_template: z.string().trim().min(1).max(60).default("literary"),
  scope: z.enum(["project", "chapter"]).default("project"),
  chapter_id: uuidSchema.nullish(),
  options: z.record(z.unknown()).optional(),
});

/* ------------------------------------------------------------------------ ai */

export const aiActionSchema = z.enum([
  "rephrase",
  "improve",
  "expand",
  "shorten",
  "tone",
  "translate",
  "summarise",
  "continue",
  "outline",
  "chat",
]);

export const aiGenerateApiSchema = z.object({
  action: aiActionSchema.default("continue"),
  prompt: z.string().max(20_000).optional(),
  selection: z.string().max(20_000).optional(),
  target: z.string().max(120).optional(),
  model: z.string().max(120).optional(),
  chapter_id: uuidSchema.nullish(),
});

export const aiImageSchema = z.object({
  prompt: z.string().trim().min(1).max(4000),
  size: z.enum(["1024x1024", "1024x1536", "1536x1024"]).optional(),
  model: z.string().max(120).optional(),
});

/* --------------------------------------------------- session AI (editor UI) */

export const sessionGenerateSchema = z.object({
  projectId: uuidSchema,
  chapterId: uuidSchema.nullish(),
  action: aiActionSchema,
  selection: z.string().max(20_000).optional(),
  target: z.string().max(120).optional(),
  model: z.string().max(120).optional(),
});

export const sessionChatSchema = z.object({
  projectId: uuidSchema,
  chapterId: uuidSchema.nullish(),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(8_000),
      }),
    )
    .min(1)
    .max(40),
  model: z.string().max(120).optional(),
});

/* ---------------------------------------------------------------------- misc */

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
});

export function zodDetails(error: z.ZodError): { field: string; message: string }[] {
  return error.issues.map((issue) => ({
    field: issue.path.length ? issue.path.join(".") : "(body)",
    message: issue.message,
  }));
}
