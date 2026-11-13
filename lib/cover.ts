/**
 * Cover Art Studio — shared types, presets and canvas render helpers.
 *
 * All measurements in a CoverConfig are expressed at the base canvas size
 * (1600 × 2400). `drawCover` scales everything to whatever target the caller
 * asks for, so the on-screen preview and the 3200 × 4800 print export render
 * from exactly the same config.
 */

export const COVER_BASE_WIDTH = 1600;
export const COVER_BASE_HEIGHT = 2400;
export const COVER_SCREEN_WIDTH = 1600;
export const COVER_SCREEN_HEIGHT = 2400;
export const COVER_PRINT_WIDTH = 3200;
export const COVER_PRINT_HEIGHT = 4800;

export const COVER_FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400;1,600&family=Fraunces:ital,opsz,wght@0,9..144,300..900;1,9..144,300..900&family=Inter:wght@300;400;500;600;700;800&family=Oswald:wght@300;400;500;600;700&display=swap";

export const COVER_FONTS = [
  {
    family: "Fraunces",
    label: "Fraunces",
    category: "Display serif",
    stack: '"Fraunces", "Iowan Old Style", Georgia, serif',
    weights: [300, 400, 600, 700, 900],
  },
  {
    family: "Cormorant Garamond",
    label: "Cormorant Garamond",
    category: "Literary serif",
    stack: '"Cormorant Garamond", Garamond, Georgia, serif',
    weights: [300, 400, 500, 600, 700],
  },
  {
    family: "Inter",
    label: "Inter",
    category: "Modern sans",
    stack: '"Inter", ui-sans-serif, system-ui, sans-serif',
    weights: [300, 400, 500, 600, 700, 800],
  },
  {
    family: "Oswald",
    label: "Oswald",
    category: "Condensed sans",
    stack: '"Oswald", "Arial Narrow", sans-serif',
    weights: [300, 400, 500, 600, 700],
  },
] as const;

export type CoverAlign = "left" | "center" | "right";
export type CoverTextKey = "title" | "subtitle" | "author";

export interface CoverTextBlock {
  text: string;
  font: string;
  weight: number;
  /** px at 1600-wide base canvas */
  size: number;
  color: string;
  /** extra letter spacing in px at base canvas */
  tracking: number;
  lineHeight: number;
  align: CoverAlign;
  /** 0–1, top edge of the text block as a fraction of cover height */
  y: number;
  uppercase: boolean;
  italic: boolean;
  visible: boolean;
  /** max text band width as a fraction of cover width */
  width: number;
}

export interface CoverBackground {
  kind: "color" | "image";
  color: string;
  url: string | null;
  assetId: string | null;
  /** 0–1 dark scrim over the background */
  overlay: number;
  /** 0–1 vertical crop focus for the background image */
  focus: number;
}

export interface CoverOrnaments {
  rule: boolean;
  frame: boolean;
  color: string;
  thickness: number;
}

export interface CoverConfig {
  version: 1;
  preset: string;
  background: CoverBackground;
  title: CoverTextBlock;
  subtitle: CoverTextBlock;
  author: CoverTextBlock;
  ornaments: CoverOrnaments;
}

export const COVER_TEXT_KEYS: CoverTextKey[] = ["title", "subtitle", "author"];

const BASE_BLOCK: CoverTextBlock = {
  text: "",
  font: "Fraunces",
  weight: 600,
  size: 110,
  color: "#f7f2e8",
  tracking: 0,
  lineHeight: 1.1,
  align: "center",
  y: 0.4,
  uppercase: false,
  italic: false,
  visible: true,
  width: 0.78,
};

function makeBlock(partial: Partial<CoverTextBlock>): CoverTextBlock {
  return { ...BASE_BLOCK, ...partial };
}

export function defaultCoverConfig(input: {
  title: string;
  subtitle?: string | null;
  author?: string | null;
}): CoverConfig {
  return {
    version: 1,
    preset: "literary",
    background: {
      kind: "color",
      color: "#1d2a26",
      url: null,
      assetId: null,
      overlay: 0.22,
      focus: 0.5,
    },
    title: makeBlock({
      text: input.title,
      font: "Fraunces",
      weight: 600,
      size: 116,
      color: "#f4ecdd",
      lineHeight: 1.08,
      y: 0.36,
      width: 0.8,
    }),
    subtitle: makeBlock({
      text: input.subtitle ?? "",
      font: "Cormorant Garamond",
      weight: 400,
      size: 52,
      color: "#cdbfa9",
      tracking: 1,
      lineHeight: 1.3,
      italic: true,
      y: 0.59,
      width: 0.72,
      visible: !!input.subtitle?.trim(),
    }),
    author: makeBlock({
      text: input.author ?? "",
      font: "Inter",
      weight: 400,
      size: 28,
      color: "#cdbfa9",
      tracking: 11,
      uppercase: true,
      y: 0.845,
      width: 0.72,
      visible: !!input.author?.trim(),
    }),
    ornaments: { rule: true, frame: false, color: "#c8814a", thickness: 3 },
  };
}

export interface CoverPreset {
  id: string;
  name: string;
  description: string;
  config: CoverConfig;
}

export const COVER_PRESETS: CoverPreset[] = [
  {
    id: "minimalist",
    name: "Minimalist",
    description: "Quiet type, generous air",
    config: {
      version: 1,
      preset: "minimalist",
      background: { kind: "color", color: "#f1e9db", url: null, assetId: null, overlay: 0, focus: 0.5 },
      title: makeBlock({
        text: "The Salt Road",
        font: "Fraunces",
        weight: 400,
        size: 112,
        color: "#1b1815",
        tracking: -1,
        lineHeight: 1.06,
        align: "center",
        y: 0.34,
        width: 0.74,
      }),
      subtitle: makeBlock({
        text: "A novel",
        font: "Inter",
        weight: 400,
        size: 26,
        color: "#7a6b5b",
        tracking: 7,
        uppercase: true,
        y: 0.57,
        width: 0.7,
      }),
      author: makeBlock({
        text: "Ray Bello",
        font: "Inter",
        weight: 500,
        size: 26,
        color: "#1b1815",
        tracking: 9,
        uppercase: true,
        y: 0.86,
        width: 0.7,
      }),
      ornaments: { rule: false, frame: false, color: "#1b1815", thickness: 2 },
    },
  },
  {
    id: "literary",
    name: "Literary",
    description: "Serif, deep colour, hairline rule",
    config: {
      version: 1,
      preset: "literary",
      background: { kind: "color", color: "#1d2a26", url: null, assetId: null, overlay: 0.22, focus: 0.5 },
      title: makeBlock({
        text: "The Salt Road",
        font: "Cormorant Garamond",
        weight: 600,
        size: 138,
        color: "#f4ecdd",
        lineHeight: 1.04,
        align: "center",
        y: 0.33,
        width: 0.8,
      }),
      subtitle: makeBlock({
        text: "A novel of passage",
        font: "Cormorant Garamond",
        weight: 400,
        size: 52,
        color: "#cdbfa9",
        tracking: 1,
        italic: true,
        y: 0.57,
        width: 0.72,
      }),
      author: makeBlock({
        text: "Ray Bello",
        font: "Inter",
        weight: 400,
        size: 26,
        color: "#cdbfa9",
        tracking: 11,
        uppercase: true,
        y: 0.85,
        width: 0.72,
      }),
      ornaments: { rule: true, frame: false, color: "#c8814a", thickness: 3 },
    },
  },
  {
    id: "modern",
    name: "Modern",
    description: "Left-aligned, heavy sans, accent kicker",
    config: {
      version: 1,
      preset: "modern",
      background: { kind: "color", color: "#12100e", url: null, assetId: null, overlay: 0.18, focus: 0.5 },
      title: makeBlock({
        text: "The Salt Road",
        font: "Inter",
        weight: 800,
        size: 152,
        color: "#f7f2e8",
        tracking: -3,
        lineHeight: 0.96,
        align: "left",
        y: 0.2,
        uppercase: true,
        width: 0.84,
      }),
      subtitle: makeBlock({
        text: "A novel",
        font: "Inter",
        weight: 500,
        size: 30,
        color: "#c8814a",
        tracking: 8,
        uppercase: true,
        align: "left",
        y: 0.45,
        width: 0.84,
      }),
      author: makeBlock({
        text: "Ray Bello",
        font: "Inter",
        weight: 400,
        size: 28,
        color: "#b7a693",
        tracking: 6,
        uppercase: true,
        align: "left",
        y: 0.9,
        width: 0.84,
      }),
      ornaments: { rule: true, frame: false, color: "#c8814a", thickness: 4 },
    },
  },
  {
    id: "thriller",
    name: "Thriller",
    description: "Condensed caps, high contrast",
    config: {
      version: 1,
      preset: "thriller",
      background: { kind: "color", color: "#0a0a0a", url: null, assetId: null, overlay: 0.38, focus: 0.5 },
      title: makeBlock({
        text: "The Salt Road",
        font: "Oswald",
        weight: 700,
        size: 196,
        color: "#faf7f2",
        tracking: -2,
        lineHeight: 0.92,
        align: "center",
        y: 0.2,
        uppercase: true,
        width: 0.88,
      }),
      subtitle: makeBlock({
        text: "Some roads do not let you leave",
        font: "Oswald",
        weight: 400,
        size: 38,
        color: "#c94b3f",
        tracking: 5,
        uppercase: true,
        align: "center",
        y: 0.5,
        width: 0.8,
      }),
      author: makeBlock({
        text: "Ray Bello",
        font: "Inter",
        weight: 600,
        size: 26,
        color: "#efe6d9",
        tracking: 10,
        uppercase: true,
        align: "center",
        y: 0.88,
        width: 0.8,
      }),
      ornaments: { rule: false, frame: false, color: "#c94b3f", thickness: 3 },
    },
  },
];

export function getCoverPreset(id: string): CoverPreset | undefined {
  return COVER_PRESETS.find((p) => p.id === id);
}

/** Applies a preset's styling while preserving the author's own text and background image. */
export function applyCoverPreset(current: CoverConfig, id: string): CoverConfig {
  const preset = getCoverPreset(id);
  if (!preset) return current;

  return {
    ...current,
    preset: preset.id,
    background: {
      ...current.background,
      kind: current.background.url ? "image" : preset.config.background.kind,
      color: preset.config.background.color,
      overlay: preset.config.background.overlay,
    },
    title: { ...preset.config.title, text: current.title.text, visible: current.title.visible },
    subtitle: { ...preset.config.subtitle, text: current.subtitle.text, visible: current.subtitle.visible },
    author: { ...preset.config.author, text: current.author.text, visible: current.author.visible },
    ornaments: { ...preset.config.ornaments },
  };
}

/** Defensive normaliser for configs read back from localStorage. */
export function normalizeCoverConfig(raw: unknown, fallback: CoverConfig): CoverConfig {
  if (!raw || typeof raw !== "object") return fallback;
  const value = raw as Partial<CoverConfig>;

  const mergeBlock = (key: CoverTextKey): CoverTextBlock => {
    const candidate: Partial<CoverTextBlock> | undefined =
      value[key] && typeof value[key] === "object" ? (value[key] as Partial<CoverTextBlock>) : undefined;
    const base = fallback[key];
    if (!candidate) return base;

    const align: CoverAlign =
      candidate.align === "left" || candidate.align === "center" || candidate.align === "right"
        ? candidate.align
        : base.align;
    const font =
      typeof candidate.font === "string" && COVER_FONTS.some((item) => item.family === candidate.font)
        ? candidate.font
        : base.font;

    return {
      text: typeof candidate.text === "string" ? candidate.text.slice(0, 220) : base.text,
      font,
      weight: clampNumber(candidate.weight, 100, 900, base.weight),
      size: clampNumber(candidate.size, 14, 280, base.size),
      color: isHexColor(candidate.color) ? candidate.color : base.color,
      tracking: clampNumber(candidate.tracking, -20, 60, base.tracking),
      lineHeight: clampNumber(candidate.lineHeight, 0.7, 2.2, base.lineHeight),
      align,
      y: clampNumber(candidate.y, 0, 0.98, base.y),
      uppercase: typeof candidate.uppercase === "boolean" ? candidate.uppercase : base.uppercase,
      italic: typeof candidate.italic === "boolean" ? candidate.italic : base.italic,
      visible: typeof candidate.visible === "boolean" ? candidate.visible : base.visible,
      width: clampNumber(candidate.width, 0.2, 1, base.width),
    };
  };

  const bg = value.background && typeof value.background === "object" ? value.background : null;
  const orn = value.ornaments && typeof value.ornaments === "object" ? value.ornaments : null;
  return {
    version: 1,
    preset: typeof value.preset === "string" ? value.preset : fallback.preset,
    background: bg
      ? {
          kind: bg.kind === "image" ? "image" : "color",
          color: isHexColor(bg.color) ? bg.color : fallback.background.color,
          url: typeof bg.url === "string" ? bg.url : null,
          assetId: typeof bg.assetId === "string" ? bg.assetId : null,
          overlay: clampNumber(bg.overlay, 0, 1, fallback.background.overlay),
          focus: clampNumber(bg.focus, 0, 1, fallback.background.focus),
        }
      : fallback.background,
    title: mergeBlock("title"),
    subtitle: mergeBlock("subtitle"),
    author: mergeBlock("author"),
    ornaments: orn
      ? {
          rule: !!orn.rule,
          frame: !!orn.frame,
          color: isHexColor(orn.color) ? orn.color : fallback.ornaments.color,
          thickness: clampNumber(orn.thickness, 1, 12, fallback.ornaments.thickness),
        }
      : fallback.ornaments,
  };
}

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function fontStackFor(family: string): string {
  const found = COVER_FONTS.find((f) => f.family === family);
  return found ? found.stack : `"${family}", Georgia, serif`;
}

export function coverFontString(block: CoverTextBlock, scale = 1): string {
  const size = Math.max(1, Math.round(block.size * scale));
  return `${block.italic ? "italic " : ""}${block.weight} ${size}px ${fontStackFor(block.font)}`;
}

function measureTracked(ctx: CanvasRenderingContext2D, text: string, tracking: number): number {
  let width = 0;
  for (const char of text) width += ctx.measureText(char).width + tracking;
  return Math.max(0, width - (text.length ? tracking : 0));
}

function wrapTracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  tracking: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && measureTracked(ctx, candidate, tracking) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawTrackedLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  bandLeft: number,
  bandWidth: number,
  top: number,
  tracking: number,
  align: CoverAlign,
): void {
  const total = measureTracked(ctx, text, tracking);
  let x = bandLeft;
  if (align === "center") x = bandLeft + (bandWidth - total) / 2;
  else if (align === "right") x = bandLeft + bandWidth - total;

  for (const char of text) {
    ctx.fillText(char, x, top);
    x += ctx.measureText(char).width + tracking;
  }
}

function drawBlock(
  ctx: CanvasRenderingContext2D,
  block: CoverTextBlock,
  width: number,
  height: number,
  scale: number,
): number {
  if (!block.visible) return height * block.y;
  const text = block.text.trim();
  if (!text) return height * block.y;

  const size = Math.max(1, block.size * scale);
  const tracking = block.tracking * scale;
  const band = width * Math.min(1, Math.max(0.2, block.width));
  const left = (width - band) / 2;
  const top = height * block.y;

  ctx.save();
  ctx.font = coverFontString(block, scale);
  ctx.fillStyle = block.color;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";

  const rendered = block.uppercase ? text.toUpperCase() : text;
  const lines = wrapTracked(ctx, rendered, band, tracking);
  lines.forEach((line, i) => {
    drawTrackedLine(ctx, line, left, band, top + i * size * block.lineHeight, tracking, block.align);
  });
  ctx.restore();
  return top;
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
  focus: number,
): void {
  const iw = image.naturalWidth || image.width;
  const ih = image.naturalHeight || image.height;
  if (!iw || !ih) return;
  const imageRatio = iw / ih;
  const canvasRatio = width / height;
  let dw: number;
  let dh: number;
  if (imageRatio > canvasRatio) {
    dh = height;
    dw = height * imageRatio;
  } else {
    dw = width;
    dh = width / imageRatio;
  }
  const dx = (width - dw) / 2;
  const dy = (height - dh) * Math.min(1, Math.max(0, focus));
  ctx.drawImage(image, dx, dy, dw, dh);
}

function adjustHex(hex: string, amount: number): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return hex;
  const raw = parseInt(match[1], 16);
  const channel = (shift: number) => {
    const value = (raw >> shift) & 0xff;
    return Math.min(255, Math.max(0, Math.round(value + amount * 255)));
  };
  return `#${[16, 8, 0].map((shift) => channel(shift).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Renders a cover. The same function powers the live preview, the screen PNG
 * and the 2× print PNG, so what the author sees is what ships.
 */
export function drawCover(
  ctx: CanvasRenderingContext2D,
  config: CoverConfig,
  image: HTMLImageElement | null,
  width: number = COVER_BASE_WIDTH,
  height: number = COVER_BASE_HEIGHT,
): void {
  const scale = width / COVER_BASE_WIDTH;
  const bg = config.background;

  ctx.save();
  ctx.clearRect(0, 0, width, height);

  ctx.fillStyle = bg.color || "#12100e";
  ctx.fillRect(0, 0, width, height);

  if (bg.kind === "image") {
    if (image) {
      drawImageCover(ctx, image, width, height, bg.focus);
    } else {
      // fallback: a soft directional wash so the cover never looks broken
      const fallback = ctx.createLinearGradient(0, 0, width, height);
      fallback.addColorStop(0, adjustHex(bg.color || "#12100e", 0.06));
      fallback.addColorStop(0.55, bg.color || "#12100e");
      fallback.addColorStop(1, adjustHex(bg.color || "#12100e", -0.12));
      ctx.fillStyle = fallback;
      ctx.fillRect(0, 0, width, height);
    }
  }

  // vignette for depth
  const vignette = ctx.createRadialGradient(
    width / 2,
    height * 0.44,
    Math.min(width, height) * 0.2,
    width / 2,
    height * 0.5,
    Math.max(width, height) * 0.78,
  );
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.34)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  if (bg.overlay > 0) {
    ctx.fillStyle = `rgba(0,0,0,${Math.min(1, Math.max(0, bg.overlay))})`;
    ctx.fillRect(0, 0, width, height);
  }

  if (config.ornaments.frame) {
    const inset = 58 * scale;
    ctx.strokeStyle = config.ornaments.color;
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = Math.max(1, 2 * scale);
    ctx.strokeRect(inset, inset, width - inset * 2, height - inset * 2);
    ctx.globalAlpha = 1;
  }

  const titleTop = drawBlock(ctx, config.title, width, height, scale);
  drawBlock(ctx, config.subtitle, width, height, scale);
  drawBlock(ctx, config.author, width, height, scale);

  if (config.ornaments.rule) {
    const thickness = Math.max(1, config.ornaments.thickness * scale);
    const band = width * Math.min(1, Math.max(0.2, config.title.width));
    const bandLeft = (width - band) / 2;
    const length = Math.min(120 * scale, band * 0.32);
    let x = bandLeft + (band - length) / 2;
    if (config.title.align === "left") x = bandLeft;
    else if (config.title.align === "right") x = bandLeft + band - length;
    const y = Math.max(28 * scale, titleTop - 46 * scale);
    ctx.fillStyle = config.ornaments.color;
    ctx.fillRect(x, y, length, thickness);
  }

  ctx.restore();
}

export function canUseCanvas(): boolean {
  return typeof document !== "undefined";
}

export function loadCoverImage(url: string | null, timeoutMs = 12000): Promise<HTMLImageElement | null> {
  if (!url || typeof window === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    let settled = false;
    const finish = (value: HTMLImageElement | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(value);
    };
    const timer = window.setTimeout(() => finish(null), timeoutMs);
    image.onload = () => finish(image);
    image.onerror = () => finish(null);
    image.src = url;
  });
}

/** Loads the four Google families at the weights actually used, then waits for paint. */
export async function ensureCoverFonts(config: CoverConfig): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) return;
  const blocks = [config.title, config.subtitle, config.author];
  try {
    await Promise.all(
      blocks.map((block) =>
        document.fonts
          .load(`${block.italic ? "italic " : ""}${block.weight} 72px "${block.font}"`)
          .catch(() => null),
      ),
    );
    await document.fonts.ready;
  } catch {
    // fall back to whatever the browser has
  }
}

export async function renderCoverBlob(
  config: CoverConfig,
  image: HTMLImageElement | null,
  width = COVER_PRINT_WIDTH,
  height = COVER_PRINT_HEIGHT,
): Promise<Blob> {
  const build = (source: HTMLImageElement | null) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is unavailable in this browser.");
    drawCover(ctx, config, source, width, height);
    return { canvas, ctx };
  };

  const encode = (canvas: HTMLCanvasElement) =>
    new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not encode PNG."))), "image/png");
    });

  const first = build(image);
  try {
    return await encode(first.canvas);
  } catch {
    // A cross-origin background tainted the canvas. A tainted canvas can never
    // be read again, so render a fresh one on the colour fallback instead.
    const fallback = build(null);
    return encode(fallback.canvas);
  }
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function coverFilename(title: string, suffix: string): string {
  const slug =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 48) || "cover";
  return `${slug}-${suffix}.png`;
}
