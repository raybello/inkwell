import {
  findElements,
  parseHtml,
  textContent,
  type HtmlElement,
  type HtmlNode,
} from "./html-parse";

export interface InlineStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  code?: boolean;
  link?: string;
}

export interface InlineRun {
  text: string;
  style: InlineStyle;
}

export type Align = "left" | "center" | "right" | "justify";

export type Block =
  | { kind: "heading"; level: number; runs: InlineRun[]; align?: Align }
  | { kind: "paragraph"; runs: InlineRun[]; quote?: boolean; align?: Align }
  | { kind: "list"; ordered: boolean; items: InlineRun[][] }
  | { kind: "code"; text: string }
  | { kind: "hr" }
  | { kind: "image"; src: string; alt: string; caption?: string }
  | { kind: "table"; rows: TableRow[] };

export interface TableRow {
  header: boolean;
  cells: InlineRun[][];
}

function inlineRuns(nodes: HtmlNode[], style: InlineStyle = {}): InlineRun[] {
  const runs: InlineRun[] = [];
  const push = (text: string, s: InlineStyle) => {
    if (!text) return;
    const last = runs[runs.length - 1];
    if (last && sameStyle(last.style, s)) last.text += text;
    else runs.push({ text, style: s });
  };

  const walk = (list: HtmlNode[], current: InlineStyle) => {
    for (const node of list) {
      if (node.type === "text") {
        push(node.text.replace(/\s+/g, " "), current);
        continue;
      }
      switch (node.tag) {
        case "br":
          push("\n", current);
          break;
        case "strong":
        case "b":
          walk(node.children, { ...current, bold: true });
          break;
        case "em":
        case "i":
          walk(node.children, { ...current, italic: true });
          break;
        case "u":
          walk(node.children, { ...current, underline: true });
          break;
        case "s":
        case "del":
        case "strike":
          walk(node.children, { ...current, strike: true });
          break;
        case "code":
          walk(node.children, { ...current, code: true });
          break;
        case "mark":
          walk(node.children, current);
          break;
        case "a": {
          const href = node.attrs.href;
          walk(node.children, href ? { ...current, link: href } : current);
          break;
        }
        case "img":
          break;
        default:
          walk(node.children, current);
      }
    }
  };

  walk(nodes, style);
  return trimRuns(runs);
}

function sameStyle(a: InlineStyle, b: InlineStyle): boolean {
  return (
    !!a.bold === !!b.bold &&
    !!a.italic === !!b.italic &&
    !!a.underline === !!b.underline &&
    !!a.strike === !!b.strike &&
    !!a.code === !!b.code &&
    (a.link ?? "") === (b.link ?? "")
  );
}

/** Collapse whitespace at the start/end of the run list while keeping inner spacing. */
function trimRuns(runs: InlineRun[]): InlineRun[] {
  const copy = runs.map((r) => ({ text: r.text, style: r.style }));
  while (copy.length && !copy[0].text.trim()) copy.shift();
  while (copy.length && !copy[copy.length - 1].text.trim()) copy.pop();
  if (copy.length) copy[0].text = copy[0].text.replace(/^\s+/, "");
  if (copy.length) copy[copy.length - 1].text = copy[copy.length - 1].text.replace(/\s+$/, "");
  return copy.filter((r) => r.text.length > 0);
}

function alignOf(el: HtmlElement): Align | undefined {
  const value = el.attrs["data-align"] ?? el.attrs.align;
  if (value === "center" || value === "right" || value === "justify" || value === "left") return value;
  const style = el.attrs.style ?? "";
  const m = style.match(/text-align:\s*(left|center|right|justify)/i);
  return m ? (m[1].toLowerCase() as Align) : undefined;
}

function imageBlock(el: HtmlElement, caption?: string): Block | null {
  const src = el.attrs.src;
  if (!src) return null;
  return { kind: "image", src, alt: el.attrs.alt ?? "", caption };
}

function listBlock(el: HtmlElement): Block[] {
  const ordered = el.tag === "ol";
  const items: InlineRun[][] = [];
  for (const child of el.children) {
    if (child.type !== "element" || child.tag !== "li") continue;
    const nested: HtmlElement[] = [];
    const inlineNodes: HtmlNode[] = [];
    for (const grand of child.children) {
      if (grand.type === "element" && (grand.tag === "ul" || grand.tag === "ol")) nested.push(grand);
      else inlineNodes.push(grand);
    }
    const runs = inlineRuns(inlineNodes);
    if (runs.length) items.push(runs);
    for (const sub of nested) {
      // Flatten nested lists into indented items, keeping the document readable in PDF.
      const nestedBlocks = listBlock(sub);
      for (const nb of nestedBlocks) {
        if (nb.kind === "list") items.push(...nb.items.map((it) => [{ text: "– ", style: {} }, ...it]));
      }
    }
  }
  const blocks: Block[] = [];
  if (items.length) blocks.push({ kind: "list", ordered, items });
  return blocks;
}

/** Convert an HTML fragment into layout blocks. */
export function htmlToBlocks(html: string): Block[] {
  const nodes = parseHtml(html);
  const blocks: Block[] = [];
  let pendingInline: HtmlNode[] = [];

  const flushInline = () => {
    if (!pendingInline.length) return;
    const runs = inlineRuns(pendingInline);
    if (runs.length) blocks.push({ kind: "paragraph", runs });
    pendingInline = [];
  };

  const visit = (list: HtmlNode[]) => {
    for (const node of list) {
      if (node.type === "text") {
        if (node.text.trim()) pendingInline.push(node);
        continue;
      }
      const tag = node.tag;
      switch (tag) {
        case "p": {
          flushInline();
          const runs = inlineRuns(node.children);
          const align = alignOf(node);
          if (runs.length) blocks.push({ kind: "paragraph", runs, ...(align ? { align } : {}) });
          else blocks.push({ kind: "paragraph", runs: [] });
          break;
        }
        case "h1":
        case "h2":
        case "h3":
        case "h4":
        case "h5":
        case "h6": {
          flushInline();
          const level = Math.min(4, Number.parseInt(tag.slice(1), 10));
          const runs = inlineRuns(node.children);
          if (runs.length) blocks.push({ kind: "heading", level, runs, ...(alignOf(node) ? { align: alignOf(node) } : {}) });
          break;
        }
        case "blockquote": {
          flushInline();
          const paragraphs = node.children.filter((c): c is HtmlElement => c.type === "element" && c.tag === "p");
          if (paragraphs.length) {
            for (const p of paragraphs) {
              const runs = inlineRuns(p.children);
              if (runs.length) blocks.push({ kind: "paragraph", runs, quote: true });
            }
          } else {
            const runs = inlineRuns(node.children);
            if (runs.length) blocks.push({ kind: "paragraph", runs, quote: true });
          }
          break;
        }
        case "ul":
        case "ol":
          flushInline();
          blocks.push(...listBlock(node));
          break;
        case "pre": {
          flushInline();
          blocks.push({ kind: "code", text: textContent(node).replace(/^\n+|\n+$/g, "") });
          break;
        }
        case "hr":
          flushInline();
          blocks.push({ kind: "hr" });
          break;
        case "img": {
          flushInline();
          const img = imageBlock(node);
          if (img) blocks.push(img);
          break;
        }
        case "figure": {
          flushInline();
          const img = findElements(node.children, "img")[0];
          const caption = findElements(node.children, "figcaption").map(textContent).join(" ").trim();
          if (img) {
            const block = imageBlock(img, caption || undefined);
            if (block) blocks.push(block);
          } else {
            visit(node.children);
          }
          break;
        }
        case "table": {
          flushInline();
          const rows: TableRow[] = [];
          for (const tr of findElements(node.children, "tr")) {
            const cells: InlineRun[][] = [];
            let header = false;
            for (const cell of tr.children) {
              if (cell.type !== "element" || (cell.tag !== "td" && cell.tag !== "th")) continue;
              if (cell.tag === "th") header = true;
              cells.push(inlineRuns(cell.children));
            }
            if (cells.length) rows.push({ header, cells });
          }
          if (rows.length) blocks.push({ kind: "table", rows });
          break;
        }
        case "div":
        case "section":
        case "article":
        case "main":
        case "header":
        case "footer":
          flushInline();
          visit(node.children);
          break;
        case "dl":
        case "dl-item":
        case "dd":
        case "dt":
          flushInline();
          visit(node.children);
          break;
        case "script":
        case "style":
          break;
        default:
          pendingInline.push(node);
      }
    }
  };

  visit(nodes);
  flushInline();
  return blocks;
}

export function blockText(block: Block): string {
  switch (block.kind) {
    case "heading":
    case "paragraph":
      return block.runs.map((r) => r.text).join("");
    case "list":
      return block.items.map((it) => it.map((r) => r.text).join("")).join("\n");
    case "code":
      return block.text;
    case "image":
      return block.alt;
    case "table":
      return block.rows.map((row) => row.cells.map((c) => c.map((r) => r.text).join("")).join(" ")).join("\n");
    default:
      return "";
  }
}

/** Strip inline markup to a plain-text paragraph string (used for metadata). */
export function htmlToPlainText(html: string): string {
  return htmlToBlocks(html)
    .map(blockText)
    .filter(Boolean)
    .join("\n\n");
}
