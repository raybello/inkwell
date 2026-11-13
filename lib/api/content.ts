import { markdownToTiptap, tiptapToMarkdown } from "@/lib/markdown";
import type { Chapter, ChapterNode } from "@/lib/types";

export type DocNode = Record<string, unknown> & {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: unknown;
};

export interface TipTapDoc {
  type: "doc";
  content: DocNode[];
}

export const EMPTY_TIPTAP: TipTapDoc = { type: "doc", content: [{ type: "paragraph" }] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Coerce whatever is stored in `chapters.content` into a safe doc shape. */
export function asDoc(value: unknown): TipTapDoc {
  if (!isRecord(value)) return { type: "doc", content: [] };
  const content = Array.isArray(value.content) ? (value.content.filter(isRecord) as DocNode[]) : [];
  return { type: "doc", content };
}

export function textNode(text: string): DocNode {
  return { type: "text", text };
}

export function paragraphNode(text: string): DocNode {
  return { type: "paragraph", content: text ? [textNode(text)] : [] };
}

/** Build block nodes from a plain text or markdown payload. */
export function nodesFromText(text: string, format: "plain" | "markdown" = "plain"): DocNode[] {
  if (format === "markdown") {
    return asDoc(markdownToTiptap(text)).content;
  }
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => paragraphNode(block.replace(/\n/g, " ")));
}

export function styledNode(text: string, as: "paragraph" | "heading1" | "heading2" | "heading3" | "blockquote"): DocNode {
  switch (as) {
    case "heading1":
      return { type: "heading", attrs: { level: 1 }, content: [textNode(text)] };
    case "heading2":
      return { type: "heading", attrs: { level: 2 }, content: [textNode(text)] };
    case "heading3":
      return { type: "heading", attrs: { level: 3 }, content: [textNode(text)] };
    case "blockquote":
      return { type: "blockquote", content: [{ type: "paragraph", content: [textNode(text)] }] };
    default:
      return paragraphNode(text);
  }
}

export function insertNodes(doc: unknown, nodes: DocNode[], where: "start" | "end"): TipTapDoc {
  const base = asDoc(doc);
  return {
    type: "doc",
    content: where === "start" ? [...nodes, ...base.content] : [...base.content, ...nodes],
  };
}

/**
 * Resolve a block reference. TipTap nodes are not guaranteed to carry ids, so
 * `bid` may be either a zero-based index (as returned by the API when reading a
 * chapter) or an `attrs.id` / `attrs.blockId` if the client wrote one.
 */
export function findBlock(doc: TipTapDoc, bid: string): number {
  if (/^\d+$/.test(bid)) {
    const index = Number(bid);
    if (index >= 0 && index < doc.content.length) return index;
  }
  return doc.content.findIndex((node) => {
    const attrs = isRecord(node.attrs) ? node.attrs : {};
    return attrs.id === bid || attrs.blockId === bid;
  });
}

export function replaceBlock(doc: TipTapDoc, index: number, patch: { text?: string; attrs?: Record<string, unknown>; type?: string }): TipTapDoc {
  const original = doc.content[index];
  const type = patch.type ?? (typeof original.type === "string" ? original.type : "paragraph");
  const attrs = { ...(isRecord(original.attrs) ? original.attrs : {}), ...(patch.attrs ?? {}) };

  let content = original.content;
  if (patch.text !== undefined) {
    if (type === "blockquote") {
      content = [{ type: "paragraph", content: patch.text ? [textNode(patch.text)] : [] }];
    } else if (type === "paragraph" || type === "heading") {
      content = patch.text ? [textNode(patch.text)] : [];
    } else {
      content = patch.text ? [textNode(patch.text)] : [];
    }
  }

  const next: DocNode = { type, content };
  if (Object.keys(attrs).length) next.attrs = attrs;

  const out = [...doc.content];
  out[index] = next;
  return { type: "doc", content: out };
}

/** Numbered, flattened view of a document's blocks — stable `bid` for PATCH. */
export function blocksWithIds(doc: TipTapDoc) {
  return doc.content.map((node, index) => ({
    bid: String(index),
    type: typeof node.type === "string" ? node.type : "unknown",
    attrs: isRecord(node.attrs) ? node.attrs : undefined,
    text: blockPlainText(node),
  }));
}

export function blockPlainText(node: DocNode): string {
  const out: string[] = [];
  const walk = (n: unknown) => {
    if (!isRecord(n)) return;
    if (typeof n.text === "string") out.push(n.text);
    if (Array.isArray(n.content)) n.content.forEach(walk);
    if (["paragraph", "heading", "blockquote", "listItem"].includes(String(n.type))) out.push("\n");
  };
  walk(node);
  return out.join("").replace(/\n+$/, "").trim();
}

export function toMarkdown(doc: unknown): string {
  return tiptapToMarkdown(doc);
}

export function buildChapterTree(chapters: Chapter[]): ChapterNode[] {
  const map = new Map<string, ChapterNode>();
  for (const chapter of chapters) map.set(chapter.id, { ...chapter, children: [] });
  const roots: ChapterNode[] = [];
  for (const chapter of chapters) {
    const node = map.get(chapter.id);
    if (!node) continue;
    if (chapter.parent_id && map.has(chapter.parent_id)) {
      map.get(chapter.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const byPosition = (a: ChapterNode, b: ChapterNode) =>
    a.position - b.position || a.created_at.localeCompare(b.created_at);
  const sortRecursive = (nodes: ChapterNode[]) => {
    nodes.sort(byPosition);
    nodes.forEach((node) => sortRecursive(node.children));
  };
  sortRecursive(roots);
  return roots;
}
