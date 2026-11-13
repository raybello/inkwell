/**
 * Pure snapshot helpers shared by the canvas gallery, the board chrome and the
 * persistence layer. Deliberately free of tldraw imports so it can run on the server
 * (gallery previews) and inside the client bundle without pulling in the editor.
 *
 * tldraw snapshot shape (`editor.getSnapshot()`):
 *   { document: { store: Record<string, TLRecord>, schema }, session: { ...camera, pageId } }
 */

export type PreviewShape = {
  /** tldraw shape type */
  t: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** resolved hex colour */
  c: string;
  /** short text snippet for text-ish shapes */
  s?: string;
};

export type CanvasPreviewData = {
  v: 1;
  w: number;
  h: number;
  shapes: PreviewShape[];
};

const COLOR_MAP: Record<string, string> = {
  black: "#e2d7c6",
  grey: "#8d7f6f",
  "light-grey": "#a89a89",
  white: "#f4eee2",
  blue: "#6f93ba",
  "light-blue": "#9db9d2",
  green: "#7d9a7e",
  "light-green": "#a7bda3",
  red: "#b5715f",
  "light-red": "#ce9784",
  orange: "#c8814a",
  "light-orange": "#dda878",
  yellow: "#c9a45c",
  "light-yellow": "#dcc189",
  violet: "#8b6b8f",
  "light-violet": "#ab8fae",
};

export function previewColor(name: unknown, fallback = "#6b5d4f") {
  if (typeof name !== "string") return fallback;
  return COLOR_MAP[name] ?? fallback;
}

function num(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function richTextLines(richText: unknown): string {
  if (!richText || typeof richText !== "object") return "";
  const doc = richText as { content?: unknown[] };
  if (!Array.isArray(doc.content)) return "";
  const out: string[] = [];
  for (const block of doc.content) {
    const b = block as { type?: string; content?: unknown[] };
    if (b?.type === "text" && typeof (b as { text?: string }).text === "string") {
      out.push((b as { text: string }).text);
      continue;
    }
    if (!Array.isArray(b?.content)) continue;
    let line = "";
    for (const inline of b.content) {
      const i = inline as { type?: string; text?: string };
      if (typeof i?.text === "string") line += i.text;
    }
    if (line.trim()) out.push(line);
  }
  return out.join("\n").trim();
}

/** Flattens tldraw rich text (or a legacy `props.text` string) into plain text. */
export function shapeText(props: Record<string, unknown> | null | undefined): string {
  if (!props) return "";
  if (typeof props.text === "string" && props.text.trim()) return props.text.trim();
  return richTextLines(props.richText);
}

/** The rich-text document object tldraw expects, built without importing the editor. */
export function plainRichText(text: string) {
  return {
    type: "doc",
    content: text
      .split(/\n+/)
      .filter((line) => line.length > 0)
      .map((line) => ({
        type: "paragraph",
        content: [{ type: "text", text: line }],
      })),
  };
}

type RawShape = {
  type?: string;
  typeName?: string;
  x?: number;
  y?: number;
  props?: Record<string, unknown>;
};

function shapeSize(shape: RawShape): { w: number; h: number } {
  const props = (shape.props ?? {}) as Record<string, unknown>;
  const type = shape.type ?? "";
  const w = num(props.w, 0);
  const h = num(props.h, 0);
  if (w > 0 && h > 0) return { w, h };
  if (type === "text") {
    const text = shapeText(props);
    const longest = Math.max(1, ...text.split("\n").map((l) => l.length));
    return { w: Math.min(420, Math.max(60, longest * 9)), h: Math.max(28, text.split("\n").length * 26) };
  }
  if (type === "arrow" || type === "line" || type === "draw") {
    const start = props.start as { x?: number } | undefined;
    const end = props.end as { x?: number; y?: number } | undefined;
    const sx = num(start?.x, 0);
    const sy = num((props.start as { y?: number })?.y, 0);
    const ex = num(end?.x, 0);
    const ey = num(end?.y, 0);
    return { w: Math.abs(ex - sx) || 12, h: Math.abs(ey - sy) || 12 };
  }
  if (type === "frame") return { w: 320, h: 220 };
  if (type === "note" || type === "geo") return { w: 180, h: 140 };
  return { w: 140, h: 100 };
}

type UnknownRecord = Record<string, unknown>;

/**
 * Stored canvases can arrive in a few shapes: our `{document, session}` snapshot, a raw
 * tldraw store snapshot `{store, schema}`, or a `{tldraw: ...}` wrapper written by
 * earlier seeds. Unwrap them all so nothing is lost on first open.
 */
function unwrap(content: unknown): UnknownRecord | null {
  if (!content || typeof content !== "object") return null;
  const outer = content as UnknownRecord;
  const inner = outer.tldraw;
  if (inner && typeof inner === "object") return inner as UnknownRecord;
  return outer;
}

export function snapshotStore(content: unknown): Record<string, unknown> | null {
  const raw = unwrap(content);
  if (!raw) return null;
  const doc = raw.document as { store?: Record<string, unknown> } | undefined;
  const store = doc?.store ?? (raw.store as Record<string, unknown> | undefined);
  return store && typeof store === "object" ? store : null;
}

/** Coerces stored content into a `{document, session}` snapshot `editor.loadSnapshot` accepts. */
export function normalizeSnapshot(content: unknown): { document: unknown; session?: unknown } | null {
  const raw = unwrap(content);
  if (!raw) return null;
  const doc = raw.document as { store?: Record<string, unknown> } | undefined;
  if (doc?.store) {
    return raw.session ? { document: doc, session: raw.session } : { document: doc };
  }
  if (raw.store) return { document: raw };
  return null;
}

/** Extracts a compact, render-friendly shape list from a stored canvas snapshot. */
export function previewFromSnapshot(content: unknown, limit = 80): CanvasPreviewData | null {
  const store = snapshotStore(content);
  if (!store) return null;

  const shapes: PreviewShape[] = [];
  for (const record of Object.values(store)) {
    if (!record || typeof record !== "object") continue;
    const s = record as RawShape;
    if (s.typeName !== "shape") continue;
    if (s.props?.isLocked === true) continue;
    const size = shapeSize(s);
    if (!(size.w > 0) || !(size.h > 0)) continue;
    const text = shapeText(s.props);
    shapes.push({
      t: s.type ?? "geo",
      x: Math.round(num(s.x)),
      y: Math.round(num(s.y)),
      w: Math.round(Math.min(size.w, 4000)),
      h: Math.round(Math.min(size.h, 4000)),
      c: previewColor(s.props?.color),
      ...(text ? { s: text.slice(0, 80) } : {}),
    });
    if (shapes.length >= limit * 4) break;
  }
  if (!shapes.length) return null;

  // Sample evenly when a board is very busy — previews stay small and legible.
  const sampled = shapes.length > limit ? shapes.filter((_, i) => i % Math.ceil(shapes.length / limit) === 0) : shapes;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of sampled) {
    minX = Math.min(minX, s.x);
    minY = Math.min(minY, s.y);
    maxX = Math.max(maxX, s.x + s.w);
    maxY = Math.max(maxY, s.y + s.h);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null;

  return {
    v: 1,
    w: Math.max(1, Math.round(maxX - minX)),
    h: Math.max(1, Math.round(maxY - minY)),
    shapes: sampled.map((s) => ({ ...s, x: s.x - Math.round(minX), y: s.y - Math.round(minY) })),
  };
}

const THUMB_PREFIX = "data:application/json;charset=utf-8,";

/** Serialises a preview into `canvases.thumbnail_url`, or null when it would be too big. */
export function encodePreview(content: unknown, maxLength = 5200): string | null {
  const data = previewFromSnapshot(content);
  if (!data) return null;
  const encoded = THUMB_PREFIX + encodeURIComponent(JSON.stringify(data));
  return encoded.length <= maxLength ? encoded : null;
}

/** Reads the persisted preview data URL, if any. */
export function decodePreview(thumbnailUrl: string | null | undefined): CanvasPreviewData | null {
  if (!thumbnailUrl || !thumbnailUrl.startsWith("data:application/json")) return null;
  try {
    const [, payload] = thumbnailUrl.split(",", 2);
    const parsed = JSON.parse(decodeURIComponent(payload)) as CanvasPreviewData;
    if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.shapes)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Best available preview: the saved thumbnail, else a live read of the snapshot. */
export function canvasPreview(content: unknown, thumbnailUrl?: string | null): CanvasPreviewData | null {
  return decodePreview(thumbnailUrl) ?? previewFromSnapshot(content);
}

export function shapeCount(content: unknown): number {
  const store = snapshotStore(content);
  if (!store) return 0;
  let count = 0;
  for (const record of Object.values(store)) {
    if (record && typeof record === "object" && (record as RawShape).typeName === "shape") count += 1;
  }
  return count;
}
