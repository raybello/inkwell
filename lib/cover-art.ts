/**
 * Cover art documents and the canvas renderer.
 *
 * One document covers both sides of the book:
 *
 *   { version, front: SideDoc, back: SideDoc }
 *
 * Every coordinate is normalised (0–1) against the 1600 × 2400 cover canvas, so
 * the same document renders at screen size, at 2× print size, and in the small
 * editor preview without any per-size maths elsewhere.
 *
 * The editor draws with these exact functions, which means what you see while
 * dragging is what gets exported — there is no DOM/canvas drift.
 */

export const COVER_WIDTH = 1600;
export const COVER_HEIGHT = 2400;
export const COVER_RATIO = COVER_HEIGHT / COVER_WIDTH;

export const COVER_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900&family=Inter:wght@300..800&family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Space+Grotesk:wght@300..700&display=swap";

export const COVER_FONT_OPTIONS = [
  { id: "fraunces", label: "Fraunces (literary serif)", stack: '"Fraunces", Georgia, serif' },
  { id: "playfair", label: "Playfair Display (dramatic serif)", stack: '"Playfair Display", Didot, serif' },
  { id: "inter", label: "Inter (clean sans)", stack: '"Inter", system-ui, sans-serif' },
  { id: "space", label: "Space Grotesk (modern sans)", stack: '"Space Grotesk", ui-sans-serif, sans-serif' },
  { id: "georgia", label: "Georgia (system serif)", stack: 'Georgia, "Times New Roman", serif' },
] as const;

export type CoverFontId = (typeof COVER_FONT_OPTIONS)[number]["id"];
export type CoverSide = "front" | "back";
export type CoverAlign = "left" | "center" | "right";
export type LayerType = "text" | "image" | "shape";

export interface CoverBackground {
  kind: "color" | "image";
  color: string;
  imageUrl: string | null;
  /** 0–1, multiplies the colour over the image for legibility. */
  scrim: number;
  scrimColor: string;
}

export interface BaseLayer {
  id: string;
  type: LayerType;
  /** Normalised position of the layer's top-left corner (before rotation). */
  x: number;
  y: number;
  /** Normalised width (0–1 of the canvas width). */
  width: number;
  opacity: number;
  /** Degrees, clockwise, about the layer's centre. */
  rotation: number;
  /** Multiplier applied on top of width/height (images and shapes). */
  scale: number;
  locked?: boolean;
}

export interface TextLayer extends BaseLayer {
  type: "text";
  text: string;
  font: CoverFontId;
  size: number; // px at 1600 wide
  weight: number;
  italic: boolean;
  uppercase: boolean;
  letterSpacing: number; // px at 1600 wide
  lineHeight: number; // multiplier
  color: string;
  align: CoverAlign;
}

export interface ImageLayer extends BaseLayer {
  type: "image";
  url: string;
  /** Normalised height; width is derived from the image's aspect ratio when omitted. */
  height: number;
  fit: "cover" | "contain";
  radius: number;
  alt?: string;
}

export interface ShapeLayer extends BaseLayer {
  type: "shape";
  shape: "rect" | "line";
  height: number;
  color: string;
  radius: number;
  borderWidth: number;
  filled: boolean;
}

export type CoverLayer = TextLayer | ImageLayer | ShapeLayer;

export interface CoverSideDoc {
  background: CoverBackground;
  layers: CoverLayer[];
}

export interface CoverDoc {
  version: 1;
  front: CoverSideDoc;
  back: CoverSideDoc;
}

let idCounter = 0;
export function layerId(prefix = "layer") {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

export function fontStack(id: CoverFontId | string): string {
  return COVER_FONT_OPTIONS.find((f) => f.id === id)?.stack ?? COVER_FONT_OPTIONS[0].stack;
}

export function defaultSideDoc(side: CoverSide, input: {
  title: string;
  subtitle: string | null;
  author: string;
  description: string | null;
}): CoverSideDoc {
  const background: CoverBackground = {
    kind: "color",
    color: side === "front" ? "#17150f" : "#12100c",
    imageUrl: null,
    scrim: 0.35,
    scrimColor: "#0b0a08",
  };

  if (side === "back") {
    const body = input.description?.trim() || "Back cover copy — add the blurb, a quote, or your author bio.";
    return {
      background: { ...background, color: "#14110d" },
      layers: [
        {
          id: layerId("text"),
          type: "text",
          text: body,
          x: 0.12,
          y: 0.16,
          width: 0.76,
          opacity: 1,
          rotation: 0,
          scale: 1,
          font: "fraunces",
          size: 46,
          weight: 400,
          italic: false,
          uppercase: false,
          letterSpacing: 0,
          lineHeight: 1.55,
          color: "#e9dfcd",
          align: "left",
        },
        {
          id: layerId("text"),
          type: "text",
          text: input.author || "Author name",
          x: 0.12,
          y: 0.82,
          width: 0.76,
          opacity: 0.9,
          rotation: 0,
          scale: 1,
          font: "inter",
          size: 30,
          weight: 500,
          italic: false,
          uppercase: true,
          letterSpacing: 6,
          lineHeight: 1.3,
          color: "#c8b79c",
          align: "left",
        },
      ],
    };
  }

  return {
    background,
    layers: [
      {
        id: layerId("text"),
        type: "text",
        text: input.title,
        x: 0.1,
        y: 0.62,
        width: 0.8,
        opacity: 1,
          rotation: 0,
          scale: 1,
        font: "fraunces",
        size: 132,
        weight: 600,
        italic: false,
        uppercase: false,
        letterSpacing: -2,
        lineHeight: 1.05,
        color: "#f4ead7",
        align: "left",
      },
      ...(input.subtitle
        ? [
            {
              id: layerId("text"),
              type: "text" as const,
              text: input.subtitle,
              x: 0.1,
              y: 0.78,
              width: 0.8,
              opacity: 0.92,
          rotation: 0,
          scale: 1,
              font: "fraunces" as const,
              size: 52,
              weight: 400,
              italic: true,
              uppercase: false,
              letterSpacing: 0,
              lineHeight: 1.3,
              color: "#d9c9b2",
              align: "left" as const,
            },
          ]
        : []),
      {
        id: layerId("text"),
        type: "text",
        text: (input.author || "Author name").toUpperCase(),
        x: 0.1,
        y: 0.9,
        width: 0.8,
        opacity: 1,
          rotation: 0,
          scale: 1,
        font: "inter",
        size: 34,
        weight: 500,
        italic: false,
        uppercase: true,
        letterSpacing: 8,
        lineHeight: 1.2,
        color: "#c9b795",
        align: "left",
      },
    ],
  };
}

export function defaultCoverDoc(input: {
  title: string;
  subtitle: string | null;
  author: string;
  description: string | null;
}): CoverDoc {
  return {
    version: 1,
    front: defaultSideDoc("front", input),
    back: defaultSideDoc("back", input),
  };
}

function clamp01(n: unknown, fallback: number): number {
  const v = typeof n === "number" && Number.isFinite(n) ? n : fallback;
  return Math.min(1, Math.max(0, v));
}

function num(value: unknown, fallback: number, min = -Infinity, max = Infinity): number {
  const v = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, v));
}

function str(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function bool(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function normaliseSide(raw: unknown, fallback: CoverSideDoc): CoverSideDoc {
  if (!raw || typeof raw !== "object") return fallback;
  const obj = raw as Record<string, unknown>;
  const bgRaw = (obj.background ?? {}) as Record<string, unknown>;
  const background: CoverBackground = {
    kind: bgRaw.kind === "image" ? "image" : "color",
    color: str(bgRaw.color, fallback.background.color),
    imageUrl: typeof bgRaw.imageUrl === "string" && bgRaw.imageUrl ? bgRaw.imageUrl : null,
    scrim: clamp01(bgRaw.scrim, fallback.background.scrim),
    scrimColor: str(bgRaw.scrimColor, fallback.background.scrimColor),
  };

  const rawLayers = Array.isArray(obj.layers) ? obj.layers : fallback.layers;
  const layers: CoverLayer[] = [];
  for (const entry of rawLayers.slice(0, 60)) {
    if (!entry || typeof entry !== "object") continue;
    const l = entry as Record<string, unknown>;
    const base = {
      id: str(l.id, layerId()),
      x: clamp01(l.x, 0.1),
      y: clamp01(l.y, 0.1),
      width: Math.max(0.02, Math.min(1, typeof l.width === "number" ? l.width : 0.5)),
      opacity: Math.max(0, Math.min(1, typeof l.opacity === "number" ? l.opacity : 1)),
      rotation: num(l.rotation, 0, -180, 180),
      scale: num(l.scale, 1, 0.05, 6),
      locked: bool(l.locked),
    };
    if (l.type === "text") {
      layers.push({
        ...base,
        type: "text",
        text: typeof l.text === "string" ? l.text : "",
        font: (COVER_FONT_OPTIONS.find((f) => f.id === l.font)?.id ?? "fraunces") as CoverFontId,
        size: num(l.size, 48, 8, 400),
        weight: num(l.weight, 400, 100, 900),
        italic: bool(l.italic),
        uppercase: bool(l.uppercase),
        letterSpacing: num(l.letterSpacing, 0, -20, 60),
        lineHeight: num(l.lineHeight, 1.3, 0.8, 3),
        color: str(l.color, "#f4ead7"),
        align: l.align === "center" || l.align === "right" ? l.align : "left",
      });
    } else if (l.type === "image") {
      if (typeof l.url !== "string" || !l.url) continue;
      layers.push({
        ...base,
        type: "image",
        url: l.url,
        height: Math.max(0.02, Math.min(1, typeof l.height === "number" ? l.height : 0.3)),
        fit: l.fit === "contain" ? "contain" : "cover",
        radius: num(l.radius, 0, 0, 200),
        alt: typeof l.alt === "string" ? l.alt : undefined,
      });
    } else if (l.type === "shape") {
      layers.push({
        ...base,
        type: "shape",
        shape: l.shape === "line" ? "line" : "rect",
        height: Math.max(0.001, Math.min(1, typeof l.height === "number" ? l.height : 0.01)),
        color: str(l.color, "#c8814a"),
        radius: num(l.radius, 0, 0, 200),
        borderWidth: num(l.borderWidth, 0, 0, 40),
        filled: bool(l.filled, true),
      });
    }
  }

  return { background, layers: layers.length ? layers : [] };
}

export function normaliseCoverDoc(raw: unknown, fallback: CoverDoc): CoverDoc {
  if (!raw || typeof raw !== "object") return fallback;
  const obj = raw as Record<string, unknown>;
  return {
    version: 1,
    front: normaliseSide(obj.front, fallback.front),
    back: normaliseSide(obj.back, fallback.back),
  };
}

/* ------------------------------------------------------------------ images */

const imageCache = new Map<string, HTMLImageElement>();

export function loadImage(url: string): Promise<HTMLImageElement | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  const cached = imageCache.get(url);
  if (cached?.complete && cached.naturalWidth > 0) return Promise.resolve(cached);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    let done = false;
    const finish = (value: HTMLImageElement | null) => {
      if (done) return;
      done = true;
      resolve(value);
    };
    img.onload = () => {
      imageCache.set(url, img);
      finish(img);
    };
    img.onerror = () => finish(null);
    img.src = url;
    setTimeout(() => finish(null), 12000);
  });
}

/** Synchronous cache lookup — drawing must never await mid-paint. */
export function peekImage(url: string): HTMLImageElement | null {
  const cached = imageCache.get(url);
  return cached && cached.complete && cached.naturalWidth > 0 ? cached : null;
}

export function coverImageUrls(side: CoverSideDoc): string[] {
  const urls = new Set<string>();
  if (side.background.kind === "image" && side.background.imageUrl) urls.add(side.background.imageUrl);
  for (const layer of side.layers) if (layer.type === "image") urls.add(layer.url);
  return [...urls];
}

export async function preloadSideImages(side: CoverSideDoc): Promise<void> {
  const urls = new Set<string>();
  if (side.background.kind === "image" && side.background.imageUrl) urls.add(side.background.imageUrl);
  for (const layer of side.layers) if (layer.type === "image") urls.add(layer.url);
  await Promise.all([...urls].map(loadImage));
}

export async function ensureCoverFonts(doc: CoverDoc): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  const families = new Set<string>();
  for (const side of [doc.front, doc.back]) {
    for (const layer of side.layers) {
      if (layer.type === "text") families.add(fontStack(layer.font));
    }
  }
  const timeout = new Promise<void>((resolve) => setTimeout(resolve, 2500));
  await Promise.race([
    Promise.all(
      [...families].map((family) => document.fonts.load(`400 48px ${family}`).catch(() => null)),
    ).then(() => document.fonts.ready.catch(() => null)),
    timeout,
  ]);
}

/* ------------------------------------------------------------------- text */

export interface TextMetricsResult {
  lines: string[];
  lineHeightPx: number;
  height: number;
}

export function wrapText(
  ctx: CanvasRenderingContext2D,
  layer: TextLayer,
  maxWidth: number,
  scale = 1,
): TextMetricsResult {
  const text = layer.uppercase ? layer.text.toUpperCase() : layer.text;
  const size = layer.size * scale;
  const lineHeight = size * layer.lineHeight;
  const paragraphs = text.split(/\n+/);
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth || !current) {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }

  return { lines, lineHeightPx: lineHeight, height: lines.length * lineHeight };
}

/* ----------------------------------------------------------------- drawing */

export interface DrawOptions {
  scale?: number;
  /** Draws the project title as a placeholder when text is empty (editor only). */
  placeholder?: boolean;
}

export async function drawCoverSide(
  ctx: CanvasRenderingContext2D,
  side: CoverSideDoc,
  options: DrawOptions = {},
): Promise<void> {
  const scale = options.scale ?? 1;
  const width = COVER_WIDTH * scale;
  const height = COVER_HEIGHT * scale;

  // Preload every image up front: awaiting inside the draw loop lets two paints
  // interleave on one context and leak transforms into each other.
  await preloadSideImages(side);

  ctx.save();
  ctx.clearRect(0, 0, width, height);

  // Background
  ctx.fillStyle = side.background.color;
  ctx.fillRect(0, 0, width, height);

  if (side.background.kind === "image" && side.background.imageUrl) {
    const img = peekImage(side.background.imageUrl);
    if (img) {
      drawCoverFit(ctx, img, 0, 0, width, height, "cover");
    }
    if (side.background.scrim > 0) {
      ctx.save();
      ctx.globalAlpha = side.background.scrim;
      ctx.fillStyle = side.background.scrimColor;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    }
  }

  for (const layer of side.layers) {
    ctx.save();
    ctx.globalAlpha = layer.opacity;

    const rotation = ((layer.rotation ?? 0) * Math.PI) / 180;
    const scalar = Math.max(0.05, layer.scale ?? 1);
    const originX = layer.x * width;
    const originY = layer.y * height;
    const baseWidth = layer.width * width;

    if (layer.type === "text") {
      const w = baseWidth * scalar;
      const size = layer.size * scale * scalar;
      ctx.font = `${layer.italic ? "italic " : ""}${layer.weight} ${size}px ${fontStack(layer.font)}`;
      ctx.fillStyle = layer.color;
      ctx.textBaseline = "top";
      (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing =
        `${layer.letterSpacing * scale * scalar}px`;
      ctx.textAlign = "left";
      const { lines, lineHeightPx } = wrapText(
        ctx,
        { ...layer, size: layer.size * scalar, letterSpacing: layer.letterSpacing * scalar },
        w,
        scale,
      );
      const h = Math.max(lineHeightPx, lines.length * lineHeightPx);
      ctx.translate(originX + baseWidth / 2, originY + h / 2);
      ctx.rotate(rotation);
      ctx.translate(-baseWidth / 2, -h / 2);
      lines.forEach((line, index) => {
        const lineWidth = ctx.measureText(line).width;
        const anchorX =
          layer.align === "center" ? (baseWidth - lineWidth) / 2 : layer.align === "right" ? baseWidth - lineWidth : 0;
        ctx.fillText(line, anchorX, index * lineHeightPx);
      });
    } else {
      const baseHeight = layer.height * height;
      const w = baseWidth * scalar;
      const h = baseHeight * scalar;
      ctx.translate(originX + baseWidth / 2, originY + baseHeight / 2);
      ctx.rotate(rotation);
      ctx.translate(-w / 2, -h / 2);

      if (layer.type === "image") {
        const img = peekImage(layer.url);
        ctx.beginPath();
        roundRect(ctx, 0, 0, w, h, layer.radius * scale);
        ctx.clip();
        if (img) {
          drawCoverFit(ctx, img, 0, 0, w, h, layer.fit);
        } else {
          ctx.fillStyle = "rgba(255,255,255,0.06)";
          ctx.fillRect(0, 0, w, h);
        }
      } else if (layer.shape === "line") {
        ctx.fillStyle = layer.color;
        ctx.fillRect(0, 0, w, Math.max(scale, layer.borderWidth * scale));
      } else {
        ctx.beginPath();
        roundRect(ctx, 0, 0, w, h, layer.radius * scale);
        if (layer.borderWidth > 0) {
          ctx.strokeStyle = layer.color;
          ctx.lineWidth = layer.borderWidth * scale;
          if (layer.filled) {
            ctx.globalAlpha = layer.opacity * 0.15;
            ctx.fillStyle = layer.color;
            ctx.fill();
            ctx.globalAlpha = layer.opacity;
          }
          ctx.stroke();
        } else {
          ctx.fillStyle = layer.color;
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  ctx.restore();
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

export function drawCoverFit(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  fit: "cover" | "contain",
) {
  const ratio = img.naturalWidth / img.naturalHeight || 1;
  const boxRatio = w / h;
  let dw = w;
  let dh = h;
  if (fit === "cover") {
    if (ratio > boxRatio) dw = h * ratio;
    else dh = w / ratio;
  } else {
    if (ratio > boxRatio) dh = w / ratio;
    else dw = h * ratio;
  }
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

/* --------------------------------------------------------------- rendering */

export async function renderCoverSide(
  doc: CoverDoc,
  side: CoverSide,
  scale = 2,
): Promise<Blob> {
  await ensureCoverFonts(doc);
  await preloadSideImages(doc[side]);

  const canvas = document.createElement("canvas");
  canvas.width = COVER_WIDTH * scale;
  canvas.height = COVER_HEIGHT * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable in this browser.");
  await drawCoverSide(ctx, doc[side], { scale });

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not render the cover"))),
      "image/png",
    );
  });
}

/**
 * True when a normalised canvas point falls inside a layer, taking rotation and
 * scale into account. `heightNorm` is the measured height for text layers.
 */
export function pointInLayer(
  layer: CoverLayer,
  heightNorm: number,
  nx: number,
  ny: number,
): boolean {
  const centreX = (layer.x + layer.width / 2) * COVER_WIDTH;
  const centreY = (layer.y + heightNorm / 2) * COVER_HEIGHT;
  const dx = nx * COVER_WIDTH - centreX;
  const dy = ny * COVER_HEIGHT - centreY;
  const angle = (-(layer.rotation ?? 0) * Math.PI) / 180;
  const rx = dx * Math.cos(angle) - dy * Math.sin(angle);
  const ry = dx * Math.sin(angle) + dy * Math.cos(angle);
  const scalar = layer.scale ?? 1;
  return Math.abs(rx) <= (layer.width * COVER_WIDTH * scalar) / 2 &&
    Math.abs(ry) <= (heightNorm * COVER_HEIGHT * scalar) / 2;
}

/** Layer bounds in normalised units, used for hit-testing and selection outlines. */
export function layerBounds(layer: CoverLayer, textHeights: Record<string, number> = {}) {
  const height =
    layer.type === "text"
      ? textHeights[layer.id] ?? layer.size / COVER_HEIGHT * 1.4
      : layer.type === "image"
        ? layer.height
        : layer.height;
  return { x: layer.x, y: layer.y, width: layer.width, height: Math.max(0.004, height) };
}

export function newTextLayer(partial: Partial<TextLayer> = {}): TextLayer {
  return {
    id: layerId("text"),
    type: "text",
    text: "Double-click to edit",
    x: 0.15,
    y: 0.45,
    width: 0.7,
    opacity: 1,
    rotation: 0,
    scale: 1,
    font: "fraunces",
    size: 64,
    weight: 500,
    italic: false,
    uppercase: false,
    letterSpacing: 0,
    lineHeight: 1.2,
    color: "#f4ead7",
    align: "left",
    ...partial,
  };
}

export function newImageLayer(url: string, partial: Partial<ImageLayer> = {}): ImageLayer {
  return {
    id: layerId("image"),
    type: "image",
    url,
    x: 0.1,
    y: 0.1,
    width: 0.8,
    height: 0.3,
    fit: "cover",
    radius: 0,
    opacity: 1,
    rotation: 0,
    scale: 1,
    ...partial,
  };
}

export function newShapeLayer(partial: Partial<ShapeLayer> = {}): ShapeLayer {
  return {
    id: layerId("shape"),
    type: "shape",
    shape: "line",
    x: 0.12,
    y: 0.55,
    width: 0.24,
    height: 0.002,
    color: "#c8814a",
    radius: 0,
    borderWidth: 3,
    filled: false,
    opacity: 1,
    rotation: 0,
    scale: 1,
    ...partial,
  };
}
