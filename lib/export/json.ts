import type { ExportDocument } from "./types";

/** Machine-readable snapshot of everything a caller needs to recreate the book. */
export function generateJson(doc: ExportDocument): Uint8Array {
  const payload = {
    generator: "Inkwell Studio",
    schema_version: 1,
    exported_at: doc.createdAt.toISOString(),
    scope: doc.scope,
    style: doc.style,
    options: doc.options,
    identifier: doc.identifier,
    word_count: doc.wordCount,
    project: doc.project,
    chapters: doc.chapters.map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      synopsis: chapter.synopsis,
      position: chapter.position,
      parent_id: chapter.parentId,
      status: chapter.status,
      word_count: chapter.wordCount,
      content_md: chapter.markdown,
      content: chapter.content,
      html: chapter.html,
    })),
    assets: doc.assets.map((asset) => ({
      id: asset.id,
      filename: asset.filename,
      public_url: asset.url,
      mime_type: asset.mimeType,
    })),
    notes: doc.notes.map((note) => ({
      id: note.id,
      title: note.title,
      kind: note.kind,
      body: note.body,
      tags: note.tags,
    })),
  };

  return new TextEncoder().encode(JSON.stringify(payload, null, 2));
}
