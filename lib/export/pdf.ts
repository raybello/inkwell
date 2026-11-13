import {
  PDFDocument,
  PDFName,
  PDFString,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from "pdf-lib";
import { htmlToBlocks, blockText, type Block, type InlineRun } from "./blocks";
import { resolveStyle, type StyleTemplate } from "./styles";
import type { ExportDocument, ImageMap } from "./types";
import { openerLabel, sanitizeForPdf } from "./util";

type FontKey =
  | "body"
  | "bodyBold"
  | "bodyItalic"
  | "bodyBoldItalic"
  | "head"
  | "headBold"
  | "mono"
  | "monoBold";

type Fonts = Record<FontKey, PDFFont>;

interface RgbValue {
  r: number;
  g: number;
  b: number;
}

interface TextSegment {
  text: string;
  font: FontKey;
  size: number;
  color: RgbValue;
  link?: string;
}

type DrawOp =
  | { kind: "text"; x: number; baseline: number; segments: TextSegment[] }
  | { kind: "image"; x: number; y: number; width: number; height: number; image: PDFImage }
  | { kind: "rect"; x: number; y: number; width: number; height: number; color: RgbValue }
  | { kind: "line"; x1: number; y1: number; x2: number; y2: number; color: RgbValue; thickness: number }
  | { kind: "link"; x: number; y: number; width: number; height: number; url?: string; targetBodyPage?: number };

interface PageModel {
  ops: DrawOp[];
  showHeader: boolean;
  showFooter: boolean;
  label: string | null;
  isBody: boolean;
}

interface PageSize {
  width: number;
  height: number;
  name: string;
}

const PAGE_SIZES: Record<string, PageSize> = {
  "6x9": { width: 432, height: 648, name: "6 × 9 in" },
  a5: { width: 419.53, height: 595.28, name: "A5" },
  a4: { width: 595.28, height: 841.89, name: "A4" },
};

interface Margins {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

interface Word {
  text: string;
  font: FontKey;
  size: number;
  color: RgbValue;
  link?: string;
  space: boolean;
  width: number;
  hardBreak?: boolean;
}

interface Line {
  words: Word[];
  width: number;
}

interface FlowOptions {
  page: PageSize;
  margins: Margins;
  style: StyleTemplate;
  measure: (font: FontKey, size: number, text: string) => number;
}

class Flow {
  readonly pages: PageModel[] = [];
  readonly opts: FlowOptions;
  current: PageModel | null = null;
  y = 0;

  constructor(opts: FlowOptions) {
    this.opts = opts;
  }

  get width(): number {
    return this.opts.page.width - this.opts.margins.left - this.opts.margins.right;
  }

  get left(): number {
    return this.opts.margins.left;
  }

  get right(): number {
    return this.opts.page.width - this.opts.margins.right;
  }

  get contentTop(): number {
    return this.opts.margins.top;
  }

  get contentBottom(): number {
    return this.opts.page.height - this.opts.margins.bottom;
  }

  get remaining(): number {
    return this.current ? this.contentBottom - this.y : 0;
  }

  newPage(opts?: { showHeader?: boolean; showFooter?: boolean; isBody?: boolean }): PageModel {
    const page: PageModel = {
      ops: [],
      showHeader: opts?.showHeader ?? true,
      showFooter: opts?.showFooter ?? true,
      label: null,
      isBody: opts?.isBody ?? true,
    };
    this.pages.push(page);
    this.current = page;
    this.y = this.contentTop;
    return page;
  }

  ensurePage(): PageModel {
    if (!this.current) this.newPage();
    return this.current as PageModel;
  }

  /** Make sure `height` points fit; returns true when a new page was started. */
  space(height: number): boolean {
    this.ensurePage();
    if (this.y + height > this.contentBottom + 0.01) {
      this.newPage();
      return true;
    }
    return false;
  }

  add(op: DrawOp): void {
    this.ensurePage().ops.push(op);
  }

  measure(font: FontKey, size: number, text: string): number {
    return this.opts.measure(font, size, text);
  }
}

function color(hex: string): RgbValue {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const int = Number.parseInt(full.slice(0, 6), 16) || 0;
  return { r: ((int >> 16) & 255) / 255, g: ((int >> 8) & 255) / 255, b: (int & 255) / 255 };
}

function sameRgb(a: RgbValue, b: RgbValue): boolean {
  return a.r === b.r && a.g === b.g && a.b === b.b;
}

function fontFor(run: InlineRun, size: number): { font: FontKey; size: number } {
  if (run.style.code) return { font: run.style.bold ? "monoBold" : "mono", size: size * 0.88 };
  const font: FontKey =
    run.style.bold && run.style.italic
      ? "bodyBoldItalic"
      : run.style.bold
        ? "bodyBold"
        : run.style.italic
          ? "bodyItalic"
          : "body";
  return { font, size };
}

function wordsFor(
  runs: InlineRun[],
  size: number,
  style: StyleTemplate,
  measure: (font: FontKey, size: number, text: string) => number,
): Word[] {
  const words: Word[] = [];
  for (const run of runs) {
    const parts = run.text.split(/(\n)/);
    for (const part of parts) {
      if (part === "\n") {
        words.push({ text: "", font: "body", size, color: color(style.colors.ink), space: false, width: 0, hardBreak: true });
        continue;
      }
      const tokens = part.split(/(\s+)/).filter((t) => t.length > 0);
      for (const token of tokens) {
        const isSpace = /^\s+$/.test(token);
        const text = isSpace ? " " : sanitizeForPdf(token);
        if (!text) continue;
        const f = fontFor(run, size);
        words.push({
          text,
          font: f.font,
          size: f.size,
          color: color(run.style.link ? style.colors.accent : style.colors.ink),
          link: run.style.link,
          space: isSpace,
          width: measure(f.font, f.size, text),
        });
      }
    }
  }
  return words;
}

function wrapWords(words: Word[], maxWidth: number): Line[] {
  const lines: Line[] = [];
  let current: Word[] = [];
  let width = 0;

  const flush = () => {
    while (current.length && current[current.length - 1].space) {
      width -= current[current.length - 1].width;
      current.pop();
    }
    lines.push({ words: current, width });
    current = [];
    width = 0;
  };

  for (const word of words) {
    if (word.hardBreak) {
      flush();
      continue;
    }
    if (word.space) {
      if (!current.length) continue;
      current.push(word);
      width += word.width;
      continue;
    }
    if (word.width > maxWidth) {
      if (current.length) flush();
      const chars = [...word.text];
      let chunk = "";
      let chunkWidth = 0;
      for (const ch of chars) {
        const w = Math.max(0.01, word.width / chars.length);
        if (chunkWidth + w > maxWidth && chunk) {
          lines.push({ words: [{ ...word, text: chunk, width: chunkWidth }], width: chunkWidth });
          chunk = "";
          chunkWidth = 0;
        }
        chunk += ch;
        chunkWidth += w;
      }
      if (chunk) {
        current.push({ ...word, text: chunk, width: chunkWidth });
        width += chunkWidth;
      }
      continue;
    }
    if (width + word.width > maxWidth && current.length) flush();
    current.push(word);
    width += word.width;
  }
  if (current.length) flush();
  if (!lines.length) lines.push({ words: [], width: 0 });
  return lines;
}

/** Split a plain string into measured word tokens so long titles wrap on spaces, not letters. */
function textWords(
  text: string,
  font: FontKey,
  size: number,
  colorValue: RgbValue,
  measure: (font: FontKey, size: number, text: string) => number,
): Word[] {
  return text
    .split(/(\s+)/)
    .filter(Boolean)
    .map((part) => {
      const isSpace = /^\s+$/.test(part);
      const value = isSpace ? " " : sanitizeForPdf(part);
      return {
        text: value,
        font,
        size,
        color: colorValue,
        space: isSpace,
        width: measure(font, size, value),
      };
    })
    .filter((word) => word.text.length > 0);
}

interface ParagraphOptions {
  x?: number;
  width?: number;
  size: number;
  lineHeight: number;
  align?: "left" | "center" | "right" | "justify";
  firstLineIndent?: number;
  justify?: boolean;
  after?: number;
  before?: number;
  lineIndents?: number[];
}

/** Flow wrapped lines across pages with orphan/widow control. */
function drawParagraph(flow: Flow, lines: Line[], opts: ParagraphOptions): void {
  const x = opts.x ?? flow.left;
  const width = opts.width ?? flow.width;
  const align = opts.align ?? "left";
  const justify = opts.justify ?? false;

  if (opts.before) {
    flow.y += opts.before;
  }

  let index = 0;
  while (index < lines.length) {
    if (!flow.current) flow.newPage();
    const available = flow.remaining;
    let fit = Math.max(0, Math.floor((available - 0.5) / opts.lineHeight));
    const remaining = lines.length - index;
    // Orphan: a paragraph must not leave a single line stranded at a page foot.
    if (fit === 0 || (index === 0 && fit === 1 && remaining > 1)) {
      flow.newPage();
      fit = Math.max(1, Math.floor(flow.remaining / opts.lineHeight));
    }
    let count = Math.min(remaining, fit);
    // Widow: never start a page with a single trailing line.
    if (remaining - count === 1) {
      if (index === 0 && remaining <= 4) {
        // A short paragraph would leave a widow; move the whole paragraph.
        flow.newPage();
        continue;
      }
      if (count > 2) count -= 1;
    }
    if (count <= 0) {
      flow.newPage();
      continue;
    }

    for (let n = 0; n < count; n += 1) {
      const line = lines[index + n];
      const isLast = index + n === lines.length - 1;
      const indent = (index + n === 0 ? opts.firstLineIndent ?? 0 : 0) + (opts.lineIndents?.[index + n] ?? 0);
      let startX = x + indent;
      const availableWidth = width - indent;
      if (align === "center") startX = x + (width - line.width) / 2;
      if (align === "right") startX = x + width - line.width;

      const baseline = flow.y + opts.size * 0.82;
      const spaceCount = line.words.filter((w) => w.space).length;
      const extra = justify && !isLast && spaceCount > 0 ? Math.max(0, (availableWidth - line.width) / spaceCount) : 0;

      let cursor = startX;
      const segments: TextSegment[] = [];
      for (const word of line.words) {
        if (word.link) {
          flow.add({
            kind: "link",
            x: cursor,
            y: flow.y + opts.lineHeight * 0.12,
            width: word.width,
            height: opts.lineHeight * 0.8,
            url: word.link,
          });
        }
        const last = segments[segments.length - 1];
        if (last && last.font === word.font && last.size === word.size && sameRgb(last.color, word.color) && last.link === word.link) {
          last.text += word.text;
        } else if (word.text) {
          segments.push({ text: word.text, font: word.font, size: word.size, color: word.color, link: word.link });
        }
        cursor += word.width + (word.space ? extra : 0);
      }
      if (segments.length) flow.add({ kind: "text", x: startX, baseline, segments });
      flow.y += opts.lineHeight;
    }

    index += count;
    if (index < lines.length) flow.newPage();
  }

  if (opts.after) flow.y += opts.after;
}

function truncateToWidth(flow: Flow, text: string, font: FontKey, size: number, maxWidth: number): string {
  if (flow.measure(font, size, text) <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && flow.measure(font, size, `${out}\u2026`) > maxWidth) out = out.slice(0, -1);
  return `${out.trimEnd()}\u2026`;
}

function drawRule(flow: Flow, opts: { ornament: boolean; color: RgbValue; align?: "left" | "center" }): void {
  flow.space(26);
  flow.y += 6;
  if (opts.ornament) {
    const size = 12;
    const text = "\u00b7   \u00b7   \u00b7";
    const w = flow.measure("body", size, text);
    flow.add({
      kind: "text",
      x: flow.left + (flow.width - w) / 2,
      baseline: flow.y + 11,
      segments: [{ text, font: "body", size, color: opts.color }],
    });
  } else {
    const x = opts.align === "left" ? flow.left : flow.left + (flow.width - 36) / 2;
    flow.add({ kind: "line", x1: x, y1: flow.y + 8, x2: x + 36, y2: flow.y + 8, color: opts.color, thickness: 0.7 });
  }
  flow.y += 22;
}

function drawTable(flow: Flow, block: Extract<Block, { kind: "table" }>, style: StyleTemplate): void {
  const columns = Math.max(...block.rows.map((r) => r.cells.length));
  if (!columns) return;
  const colWidth = flow.width / columns;
  const pad = 4;
  const fontSize = 8.5;
  const lineHeight = 11;
  const ink = color(style.colors.ink);
  const rule = color(style.colors.rule);

  for (const row of block.rows) {
    const cellLines = row.cells.map((cell) =>
      wrapWords(wordsFor(cell, fontSize, style, (f, s, t) => flow.measure(f, s, t)), colWidth - pad * 2),
    );
    const rows = Math.max(...cellLines.map((l) => l.length));
    const height = rows * lineHeight + pad * 2;
    if (flow.remaining < height + 10) flow.newPage();
    const top = flow.y;
    flow.add({ kind: "line", x1: flow.left, y1: top, x2: flow.right, y2: top, color: rule, thickness: 0.5 });
    cellLines.forEach((lines, col) => {
      const x = flow.left + col * colWidth + pad;
      lines.forEach((line, li) => {
        let cursor = x;
        for (const word of line.words) {
          if (!word.text) continue;
          flow.add({
            kind: "text",
            x: cursor,
            baseline: top + pad + li * lineHeight + fontSize * 0.82,
            segments: [
              {
                text: word.text,
                font: row.header ? "headBold" : word.font === "headBold" ? "bodyBold" : word.font,
                size: fontSize,
                color: ink,
              },
            ],
          });
          cursor += word.width;
        }
      });
    });
    flow.y = top + height;
  }
  flow.add({ kind: "line", x1: flow.left, y1: flow.y, x2: flow.right, y2: flow.y, color: rule, thickness: 0.5 });
  flow.y += 8;
}

async function embedImage(pdf: PDFDocument, entry: { bytes: Uint8Array; ext: string } | undefined): Promise<PDFImage | null> {
  if (!entry) return null;
  try {
    if (entry.ext === "png") return await pdf.embedPng(entry.bytes);
    if (entry.ext === "jpg") return await pdf.embedJpg(entry.bytes);
    return null;
  } catch {
    return null;
  }
}

async function drawImageBlock(flow: Flow, src: string, alt: string, images: ImageMap, pdf: PDFDocument, cache: Map<string, PDFImage | null>): Promise<void> {
  const fetched = images.get(src);
  const image = cache.has(src) ? cache.get(src) ?? null : await embedImage(pdf, fetched);
  if (!cache.has(src)) cache.set(src, image);

  if (!image) {
    if (alt) {
      const text = sanitizeForPdf(alt);
      const lines = wrapWords(
        textWords(text, "bodyItalic", 9, color("#7a6b5b"), (f, sz, t) => flow.measure(f, sz, t)),
        flow.width,
      );
      drawParagraph(flow, lines, { size: 9, lineHeight: 13, align: "center", after: 10 });
    }
    return;
  }

  if (flow.remaining < 120) flow.newPage();
  const maxWidth = flow.width;
  const maxHeight = flow.remaining - 24;
  const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
  const width = image.width * scale;
  const height = image.height * scale;
  flow.add({ kind: "image", x: flow.left + (flow.width - width) / 2, y: flow.y + 10, width, height, image });
  flow.y += height + 18;
}

/** Chapters are laid out in their own flow so the TOC can know page numbers first. */
async function layoutBody(
  flow: Flow,
  doc: ExportDocument,
  images: ImageMap,
  pdf: PDFDocument,
  imageCache: Map<string, PDFImage | null>,
  mode: "print" | "screen",
): Promise<number[]> {
  const style = resolveStyle(doc.style);
  const starts: number[] = [];

  for (let chapterIndex = 0; chapterIndex < doc.chapters.length; chapterIndex += 1) {
    const chapter = doc.chapters[chapterIndex];
    if (chapterIndex === 0 || mode === "print" || doc.options.chapterBreaks !== false) {
      starts.push(flow.pages.length);
      flow.newPage({ showHeader: false, showFooter: true, isBody: true });
    } else {
      flow.space(80);
      starts.push(flow.pages.length - 1);
      if (flow.current) flow.current.showHeader = true;
    }
    const ink = color(style.colors.ink);
    const muted = color(style.colors.muted);
    const accent = color(style.colors.accent);

    flow.y = flow.contentTop + (flow.opts.page.height > 700 ? 76 : 50);

    if (style.openerLabel) {
      const label = sanitizeForPdf(openerLabel(chapter.title, chapterIndex)).toUpperCase();
      if (label) {
        const size = 8;
        const w = flow.measure("body", size, label) + label.length * 1.5;
        flow.add({
          kind: "text",
          x: style.heading.align === "center" ? flow.left + (flow.width - w) / 2 : flow.left,
          baseline: flow.y + size,
          segments: [{ text: label, font: "body", size, color: muted }],
        });
        flow.y += size + 16;
      }
    }

    const titleSize = Math.min(style.heading.h1, flow.width / 9);
    const titleFont: FontKey = style.sansHeadings || style.heading.weight >= 600 ? "headBold" : "head";
    const titleText = sanitizeForPdf(style.heading.transform === "uppercase" ? chapter.title.toUpperCase() : chapter.title);
    const titleWords = textWords(titleText, titleFont, titleSize, ink, (f, sz, t) => flow.measure(f, sz, t));
    for (const line of wrapWords(titleWords, flow.width - 16)) {
      const lineText = line.words.map((word) => word.text).join("");
      const x = style.heading.align === "center" ? flow.left + (flow.width - line.width) / 2 : flow.left;
      flow.add({
        kind: "text",
        x,
        baseline: flow.y + titleSize * 0.85,
        segments: [{ text: lineText, font: titleFont, size: titleSize, color: ink }],
      });
      flow.y += titleSize * 1.14;
    }
    flow.y += 6;

    if (style.chapterRule !== "none") {
      drawRule(flow, { ornament: style.chapterRule === "ornament", color: color(style.colors.muted), align: style.heading.align });
    }

    if (chapter.synopsis) {
      const size = 9.5;
      const text = sanitizeForPdf(chapter.synopsis.trim());
      const words = textWords(text, "bodyItalic", size, muted, (f, sz, t) => flow.measure(f, sz, t));
      for (const line of wrapWords(words, Math.min(flow.width - 30, 300))) {
        if (!line.words.length) continue;
        const x = flow.left + (flow.width - line.width) / 2;
        flow.add({
          kind: "text",
          x,
          baseline: flow.y + size * 0.82,
          segments: [{ text: line.words.map((w) => w.text).join(""), font: "bodyItalic", size, color: muted }],
        });
        flow.y += size * 1.45;
      }
    }
    flow.y += 18;

    const bodySize = style.bodySizePt;
    const lineHeight = bodySize * (style.paragraph.justify ? 1.44 : 1.52);
    const blocks = htmlToBlocks(chapter.html);
    const hasBody = blocks.some(
      (block) => block.kind === "image" || block.kind === "table" || blockText(block).trim().length > 0,
    );
    let firstParagraph = true;

    for (const block of blocks) {
      switch (block.kind) {
        case "paragraph": {
          if (!block.runs.length) {
            flow.y += bodySize * 0.5;
            break;
          }
          const paragraphRuns = block.quote
            ? block.runs.map((run) => ({ ...run, style: { ...run.style, italic: true } }))
            : block.runs;
          const words = wordsFor(paragraphRuns, bodySize, style, (f, s, t) => flow.measure(f, s, t));
          const quoteOffset = block.quote ? 16 : 0;
          const maxWidth = flow.width - quoteOffset;
          let lines = wrapWords(words, maxWidth);

          let lineIndents: number[] | undefined;
          let drop: { letter: string; size: number; width: number } | null = null;
          if (firstParagraph && doc.options.dropCaps && style.dropCap && lines.length > 1) {
            const firstWord = words[0];
            const chars = [...firstWord.text];
            const letter = chars.shift() ?? "";
            if (letter && /[A-Za-z\u00c0-\u00ff]/.test(letter)) {
              const rest = chars.join("");
              firstWord.text = rest;
              firstWord.width = flow.measure(firstWord.font, firstWord.size, rest);
              lines = wrapWords(words, maxWidth);
              const capSize = bodySize * 2.5;
              const capWidth = flow.measure(style.sansHeadings ? "headBold" : "head", capSize, letter);
              if (lines.length > 1) {
                lineIndents = [capWidth + 6, capWidth + 6];
                drop = { letter, size: capSize, width: capWidth };
              }
            }
          }

          const before = firstParagraph ? 0 : style.paragraph.spacing;
          if (before) flow.y += before;
          if (drop) {
            flow.add({
              kind: "text",
              x: flow.left + quoteOffset,
              baseline: flow.y + lineHeight + bodySize * 0.82,
              segments: [{ text: drop.letter, font: style.sansHeadings ? "headBold" : "head", size: drop.size, color: accent }],
            });
          }
          drawParagraph(flow, lines, {
            x: flow.left + quoteOffset,
            width: maxWidth,
            size: bodySize,
            lineHeight,
            align: block.quote ? "left" : (block.align ?? (style.paragraph.justify ? "justify" : "left")),
            justify: !block.quote && style.paragraph.justify,
            firstLineIndent: firstParagraph ? 0 : style.paragraph.firstLineIndent,
            after: style.paragraph.spacing,
            lineIndents,
          });
          firstParagraph = false;
          break;
        }
        case "heading": {
          const sizes: Record<number, number> = { 1: style.heading.h1, 2: style.heading.h2, 3: style.heading.h3, 4: style.heading.h4 };
          const size = sizes[block.level] ?? style.heading.h3;
          const lh = size * 1.3;
          const words = wordsFor(block.runs, size, style, (f, s, t) => flow.measure(f, s, t));
          const lines = wrapWords(words, flow.width);
          flow.space(size * 1.2 + lh * lines.length + bodySize * 2);
          flow.y += size * 1.1;
          for (const line of lines) {
            flow.add({
              kind: "text",
              x: flow.left,
              baseline: flow.y + size * 0.84,
              segments: [{ text: line.words.map((word) => word.text).join(""), font: "headBold", size, color: ink }],
            });
            flow.y += lh;
          }
          flow.y += 6;
          break;
        }
        case "list": {
          block.items.forEach((item, i) => {
            const marker = block.ordered ? `${i + 1}.` : "\u2022";
            const markerWidth = flow.measure("body", bodySize, `${marker}  `);
            const words = wordsFor(item, bodySize, style, (f, s, t) => flow.measure(f, s, t));
            const lines = wrapWords(words, flow.width - markerWidth);
            if (flow.remaining < lineHeight * 2) flow.newPage();
            flow.add({
              kind: "text",
              x: flow.left,
              baseline: flow.y + bodySize * 0.82,
              segments: [{ text: marker, font: "body", size: bodySize, color: ink }],
            });
            drawParagraph(flow, lines, { x: flow.left + markerWidth, width: flow.width - markerWidth, size: bodySize, lineHeight, after: 3 });
          });
          flow.y += style.paragraph.spacing;
          break;
        }
        case "code": {
          const size = bodySize * 0.82;
          const lh = size * 1.35;
          const lines = block.text.split("\n").flatMap((raw) =>
            wrapWords(
              raw
                .split(/(\s+)/)
                .filter(Boolean)
                .map((token) => {
                  const isSpace = /^\s+$/.test(token);
                  const text = isSpace ? " " : sanitizeForPdf(token);
                  return { text, font: "mono" as FontKey, size, color: ink, space: isSpace, width: flow.measure("mono", size, text) };
                })
                .filter((w) => w.text),
              flow.width - 24,
            ),
          );
          const totalHeight = lines.length * lh + 12;
          flow.space(Math.min(totalHeight, 120));
          const startY = flow.y;
          flow.add({ kind: "rect", x: flow.left, y: startY, width: flow.width, height: totalHeight, color: color("#f1ece2") });
          flow.y += 6;
          for (const line of lines) {
            let cursor = flow.left + 10;
            for (const word of line.words) {
              if (!word.text) continue;
              flow.add({ kind: "text", x: cursor, baseline: flow.y + size * 0.8, segments: [{ text: word.text, font: "mono", size, color: ink }] });
              cursor += word.width;
            }
            flow.y += lh;
            if (flow.remaining < lh) flow.newPage();
          }
          flow.y += 12;
          break;
        }
        case "hr": {
          drawRule(flow, { ornament: true, color: muted });
          break;
        }
        case "image": {
          await drawImageBlock(flow, block.src, block.caption || block.alt, images, pdf, imageCache);
          break;
        }
        case "table": {
          drawTable(flow, block, style);
          break;
        }
      }
    }

    if (!hasBody) {
      flow.add({
        kind: "text",
        x: flow.left,
        baseline: flow.y + bodySize,
        segments: [{ text: "(This chapter is empty.)", font: "bodyItalic", size: bodySize * 0.9, color: muted }],
      });
    }
  }

  return starts;
}

async function layoutFront(
  flow: Flow,
  doc: ExportDocument,
  images: ImageMap,
  pdf: PDFDocument,
  imageCache: Map<string, PDFImage | null>,
  chapterStarts: number[],
  internalLinks: boolean,
): Promise<{ cover: number; title: number; toc: number }> {
  const style = resolveStyle(doc.style);
  const ink = color(style.colors.ink);
  const muted = color(style.colors.muted);
  const pageW = flow.opts.page.width;
  const pageH = flow.opts.page.height;

  let cover = 0;
  const coverImage = doc.options.includeCover && doc.coverUrl ? images.get(doc.coverUrl) : undefined;
  if (coverImage) {
    flow.newPage({ showHeader: false, showFooter: false, isBody: false });
    let image = imageCache.get(doc.coverUrl ?? "") ?? null;
    if (!imageCache.has(doc.coverUrl ?? "")) {
      image = await embedImage(pdf, coverImage);
      imageCache.set(doc.coverUrl ?? "", image);
    }
    if (image) {
      const maxW = pageW - flow.opts.margins.left * 2;
      const maxH = pageH - flow.opts.margins.top * 3;
      const scale = Math.min(maxW / image.width, maxH / image.height);
      const w = image.width * scale;
      const h = image.height * scale;
      flow.add({ kind: "image", x: (pageW - w) / 2, y: (pageH - h) / 2, width: w, height: h, image });
    }
    cover = 1;
  }

  flow.newPage({ showHeader: false, showFooter: false, isBody: false });
  const titleSize = Math.min(34, (flow.width / 10) * 1.4);
  const titleText = sanitizeForPdf(doc.title);
  const titleWords = textWords(titleText, "headBold", titleSize, ink, (f, sz, t) => flow.measure(f, sz, t));
  flow.y = pageH * 0.3;
  for (const line of wrapWords(titleWords, flow.width - 16)) {
    flow.add({
      kind: "text",
      x: flow.left + (flow.width - line.width) / 2,
      baseline: flow.y + titleSize * 0.85,
      segments: [{ text: line.words.map((word) => word.text).join(""), font: "headBold", size: titleSize, color: ink }],
    });
    flow.y += titleSize * 1.2;
  }
  if (doc.subtitle) {
    const size = 13;
    const text = sanitizeForPdf(doc.subtitle);
    const w = flow.measure("bodyItalic", size, text);
    flow.y += 14;
    flow.add({
      kind: "text",
      x: flow.left + (flow.width - w) / 2,
      baseline: flow.y + size,
      segments: [{ text, font: "bodyItalic", size, color: muted }],
    });
    flow.y += size + 12;
  }
  flow.y += 34;
  flow.add({
    kind: "line",
    x1: flow.left + flow.width / 2 - 18,
    y1: flow.y,
    x2: flow.left + flow.width / 2 + 18,
    y2: flow.y,
    color: color(style.colors.rule),
    thickness: 0.8,
  });
  flow.y += 30;
  if (doc.author) {
    const size = 10;
    const text = doc.author.toUpperCase();
    const w = flow.measure("body", size, text) + text.length * 1.2;
    flow.add({
      kind: "text",
      x: flow.left + (flow.width - w) / 2,
      baseline: flow.y + size,
      segments: [{ text, font: "body", size, color: ink }],
    });
  }
  const imprint = "INKWELL STUDIO";
  const imprintSize = 7;
  const imprintW = flow.measure("body", imprintSize, imprint);
  flow.add({
    kind: "text",
    x: flow.left + (flow.width - imprintW) / 2,
    baseline: pageH - flow.opts.margins.bottom - 4,
    segments: [{ text: imprint, font: "body", size: imprintSize, color: muted }],
  });

  let toc = 0;
  if (doc.options.includeToc && doc.chapters.length > 1) {
    const entrySize = 10.5;
    const entryHeight = 21;
    const perPage = Math.max(1, Math.floor((flow.contentBottom - flow.contentTop - 80) / entryHeight));
    const totalPages = Math.ceil(doc.chapters.length / perPage);
    for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
      flow.newPage({ showHeader: false, showFooter: false, isBody: false });
      const heading = "CONTENTS";
      const hs = 9;
      const hw = flow.measure("body", hs, heading) + heading.length * 2;
      flow.add({
        kind: "text",
        x: flow.left + (flow.width - hw) / 2,
        baseline: flow.contentTop + 28,
        segments: [{ text: heading, font: "body", size: hs, color: muted }],
      });
      flow.y = flow.contentTop + 68;
      const slice = doc.chapters.slice(pageIndex * perPage, pageIndex * perPage + perPage);
      slice.forEach((chapter, j) => {
        const index = pageIndex * perPage + j;
        const title = truncateToWidth(flow, sanitizeForPdf(chapter.title), "body", entrySize, flow.width - 70);
        const baseline = flow.y + entrySize * 0.85;
        flow.add({ kind: "text", x: flow.left, baseline, segments: [{ text: title, font: "body", size: entrySize, color: ink }] });
        const pageLabel = String((chapterStarts[index] ?? 0) + 1);
        const pw = flow.measure("body", 9.5, pageLabel);
        flow.add({ kind: "text", x: flow.right - pw, baseline, segments: [{ text: pageLabel, font: "body", size: 9.5, color: muted }] });
        const titleW = flow.measure("body", entrySize, title);
        const dotStart = flow.left + titleW + 8;
        const dotEnd = flow.right - pw - 8;
        const dot = "\u00b7";
        const dw = flow.measure("body", 8, `${dot} `);
        const count = Math.min(160, Math.floor((dotEnd - dotStart) / Math.max(1, dw)));
        if (count > 0) {
          flow.add({
            kind: "text",
            x: dotStart,
            baseline,
            segments: [{ text: Array.from({ length: count }, () => dot).join(" "), font: "body", size: 8, color: color(style.colors.rule) }],
          });
        }
        if (internalLinks) {
          flow.add({ kind: "link", x: flow.left, y: flow.y - 2, width: flow.width, height: entryHeight, targetBodyPage: chapterStarts[index] ?? 0 });
        }
        flow.y += entryHeight;
      });
      toc += 1;
    }
  }

  return { cover, title: 1, toc };
}

function drawHeaderAndFooter(
  pdfPage: PDFPage,
  model: PageModel,
  fonts: Fonts,
  style: StyleTemplate,
  doc: ExportDocument,
  pageSize: PageSize,
  margins: Margins,
): void {
  const muted = color(style.colors.muted);
  if (model.showHeader) {
    let text = sanitizeForPdf(doc.title.toUpperCase());
    if (text) {
      const size = 7;
      while (text.length > 12 && fonts.body.widthOfTextAtSize(text, size) > pageSize.width - margins.left - margins.right - 8) {
        text = `${text.slice(0, Math.max(8, text.length - 3)).trimEnd()}\u2026`;
      }
      const w = fonts.body.widthOfTextAtSize(text, size);
      pdfPage.drawText(text, {
        x: (pageSize.width - w) / 2,
        y: pageSize.height - margins.top * 0.52,
        size,
        font: fonts.body,
        color: rgb(muted.r, muted.g, muted.b),
      });
    }
  }
  if (model.showFooter && model.label) {
    const size = 8.5;
    const w = fonts.body.widthOfTextAtSize(model.label, size);
    pdfPage.drawText(model.label, {
      x: (pageSize.width - w) / 2,
      y: Math.max(14, margins.bottom * 0.42),
      size,
      font: fonts.body,
      color: rgb(muted.r, muted.g, muted.b),
    });
  }
}

interface RenderOptions {
  internalLinks: boolean;
  /** Index of the first body page in the final PDF (for TOC destinations). */
  frontOffset: number;
}

function renderPages(
  pdf: PDFDocument,
  pages: PageModel[],
  fonts: Fonts,
  style: StyleTemplate,
  doc: ExportDocument,
  pageSize: PageSize,
  margins: Margins,
  opts: RenderOptions,
): void {
  const pdfPages = pages.map(() => pdf.addPage([pageSize.width, pageSize.height]));

  pages.forEach((model, pageIndex) => {
    const pdfPage = pdfPages[pageIndex];
    for (const op of model.ops) {
      if (op.kind === "text") {
        let x = op.x;
        for (const segment of op.segments) {
          if (!segment.text) continue;
          pdfPage.drawText(segment.text, {
            x,
            y: pageSize.height - op.baseline,
            size: segment.size,
            font: fonts[segment.font],
            color: rgb(segment.color.r, segment.color.g, segment.color.b),
          });
          x += fonts[segment.font].widthOfTextAtSize(segment.text, segment.size);
        }
      } else if (op.kind === "image") {
        pdfPage.drawImage(op.image, { x: op.x, y: pageSize.height - op.y - op.height, width: op.width, height: op.height });
      } else if (op.kind === "rect") {
        pdfPage.drawRectangle({
          x: op.x,
          y: pageSize.height - op.y - op.height,
          width: op.width,
          height: op.height,
          color: rgb(op.color.r, op.color.g, op.color.b),
        });
      } else if (op.kind === "line") {
        pdfPage.drawLine({
          start: { x: op.x1, y: pageSize.height - op.y1 },
          end: { x: op.x2, y: pageSize.height - op.y2 },
          thickness: op.thickness,
          color: rgb(op.color.r, op.color.g, op.color.b),
        });
      }
    }

    for (const op of model.ops) {
      if (op.kind !== "link") continue;
      const rect: [number, number, number, number] = [op.x, pageSize.height - op.y - op.height, op.x + op.width, pageSize.height - op.y];

      if (op.url) {
        const annot = pdf.context.obj({
          Type: "Annot",
          Subtype: "Link",
          Rect: rect,
          Border: [0, 0, 0],
          A: { Type: "Action", S: "URI", URI: PDFString.of(op.url) },
        } as never);
        pdfPage.node.addAnnot(pdf.context.register(annot));
        continue;
      }
      if (opts.internalLinks && op.targetBodyPage !== undefined) {
        const target = pdfPages[opts.frontOffset + op.targetBodyPage];
        if (!target) continue;
        const annot = pdf.context.obj({
          Type: "Annot",
          Subtype: "Link",
          Rect: rect,
          Border: [0, 0, 0],
          Dest: [target.ref, PDFName.of("Fit")],
        } as never);
        pdfPage.node.addAnnot(pdf.context.register(annot));
      }
    }

    drawHeaderAndFooter(pdfPage, model, fonts, style, doc, pageSize, margins);
  });
}

export async function generatePdf(doc: ExportDocument, images: ImageMap, mode: "print" | "screen"): Promise<Uint8Array> {
  const style = resolveStyle(doc.style);
  const sizeName = mode === "print" ? doc.options.pageSize ?? "6x9" : "a4";
  const pageSize = PAGE_SIZES[sizeName] ?? PAGE_SIZES["6x9"];

  const pdf = await PDFDocument.create();
  pdf.setTitle(doc.title);
  if (doc.author) pdf.setAuthor(doc.author);
  const subject = doc.genre || doc.description || "";
  if (subject) pdf.setSubject(subject);
  pdf.setCreator("Inkwell Studio");
  pdf.setProducer("Inkwell Studio");
  pdf.setLanguage(doc.language);
  pdf.setCreationDate(doc.createdAt);
  pdf.setModificationDate(doc.createdAt);

  const fonts: Fonts = {
    body: await pdf.embedFont(StandardFonts.TimesRoman),
    bodyBold: await pdf.embedFont(StandardFonts.TimesRomanBold),
    bodyItalic: await pdf.embedFont(StandardFonts.TimesRomanItalic),
    bodyBoldItalic: await pdf.embedFont(StandardFonts.TimesRomanBoldItalic),
    head: style.sansHeadings ? await pdf.embedFont(StandardFonts.Helvetica) : await pdf.embedFont(StandardFonts.TimesRoman),
    headBold: style.sansHeadings ? await pdf.embedFont(StandardFonts.HelveticaBold) : await pdf.embedFont(StandardFonts.TimesRomanBold),
    mono: await pdf.embedFont(StandardFonts.Courier),
    monoBold: await pdf.embedFont(StandardFonts.CourierBold),
  };

  const margins: Margins = mode === "print" ? { top: 56, bottom: 60, left: 52, right: 46 } : { top: 66, bottom: 66, left: 72, right: 72 };
  const cache = new Map<string, number>();
  const measure = (font: FontKey, size: number, text: string): number => {
    if (!text) return 0;
    const key = `${font}|${size.toFixed(2)}|${text}`;
    const hit = cache.get(key);
    if (hit !== undefined) return hit;
    const value = fonts[font].widthOfTextAtSize(text, size);
    cache.set(key, value);
    return value;
  };

  const imageCache = new Map<string, PDFImage | null>();
  const bodyFlow = new Flow({ page: pageSize, margins, style, measure });
  const chapterStarts = await layoutBody(bodyFlow, doc, images, pdf, imageCache, mode);
  bodyFlow.pages.forEach((page, i) => {
    page.label = String(i + 1);
    page.isBody = true;
  });

  const frontFlow = new Flow({ page: pageSize, margins, style, measure });
  const front = await layoutFront(frontFlow, doc, images, pdf, imageCache, chapterStarts, mode === "screen");
  const frontPages = front.cover + front.title + front.toc;

  const allPages = [...frontFlow.pages, ...bodyFlow.pages];
  renderPages(pdf, allPages, fonts, style, doc, pageSize, margins, {
    internalLinks: mode === "screen",
    frontOffset: frontPages,
  });

  const bytes = await pdf.save();
  return bytes;
}

/** Human-readable trim size for the export UI. */
export function pageSizeLabel(name: string | undefined, mode: "print" | "screen"): string {
  if (mode === "screen") return PAGE_SIZES.a4.name;
  return PAGE_SIZES[name ?? "6x9"]?.name ?? PAGE_SIZES["6x9"].name;
}
