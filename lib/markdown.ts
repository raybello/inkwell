import { generateHTML } from "@tiptap/html";
import { baseExtensions } from "@/lib/editor/extensions";

export type TipTapDoc = {
  type: "doc";
  content?: Array<Record<string, unknown>>;
};

type Node = Record<string, unknown>;

const EMPTY_DOC: TipTapDoc = { type: "doc", content: [{ type: "paragraph" }] };

/**
 * TipTap JSON → Markdown.
 *
 * Hand-written rather than an HTML/turndown round-trip: server actions and
 * route handlers bundle differently, and the browser build of turndown has no
 * DOM there (it fails silently, which once produced empty markdown mirrors).
 * A direct serializer is deterministic and dependency-free.
 */

function textOf(node: Node): string {
  if (typeof node.text === "string") return node.text;
  const content = (node.content as Node[] | undefined) ?? [];
  return content.map(textOf).join("");
}

function markWrap(text: string, marks: Node[] | undefined): string {
  if (!text) return text;
  let out = text;
  for (const mark of marks ?? []) {
    const type = mark.type as string;
    const attrs = (mark.attrs as Record<string, unknown> | undefined) ?? {};
    switch (type) {
      case "bold":
        out = `**${out}**`;
        break;
      case "italic":
        out = `*${out}*`;
        break;
      case "strike":
        out = `~~${out}~~`;
        break;
      case "code":
        out = `\`${out}\``;
        break;
      case "highlight":
        out = `==${out}==`;
        break;
      case "underline":
        out = `<u>${out}</u>`;
        break;
      case "link": {
        const href = typeof attrs.href === "string" ? attrs.href : "";
        out = href ? `[${out}](${href})` : out;
        break;
      }
      default:
        break;
    }
  }
  return out;
}

function inline(nodes: Node[] | undefined): string {
  return (nodes ?? [])
    .map((node) => {
      if (node.type === "text") return markWrap(String(node.text ?? ""), node.marks as Node[] | undefined);
      if (node.type === "hardBreak") return "  \n";
      if (node.type === "image") {
        const attrs = (node.attrs as Record<string, unknown> | undefined) ?? {};
        const alt = typeof attrs.alt === "string" ? attrs.alt : "";
        const src = typeof attrs.src === "string" ? attrs.src : "";
        return src ? `![${alt}](${src})` : "";
      }
      return inline(node.content as Node[] | undefined);
    })
    .join("");
}

function block(node: Node, depth = 0): string {
  const type = node.type as string;
  const attrs = (node.attrs as Record<string, unknown> | undefined) ?? {};
  const content = (node.content as Node[] | undefined) ?? [];
  const pad = "  ".repeat(depth);

  switch (type) {
    case "paragraph": {
      const body = inline(content).trim();
      return body ? `${pad}${body}` : "";
    }
    case "heading": {
      const level = Math.min(4, Math.max(1, Number(attrs.level ?? 1)));
      const body = inline(content).trim();
      return body ? `${pad}${"#".repeat(level)} ${body}` : "";
    }
    case "blockquote": {
      const inner = content.map((child) => block(child, depth)).filter(Boolean).join("\n\n");
      if (!inner) return "";
      return inner
        .split("\n")
        .map((line) => `${pad}> ${line}`)
        .join("\n");
    }
    case "codeBlock": {
      const language = typeof attrs.language === "string" ? attrs.language : "";
      return `${pad}\`\`\`${language}\n${textOf(node)}\n${pad}\`\`\``;
    }
    case "horizontalRule":
      return `${pad}---`;
    case "bulletList":
    case "orderedList":
    case "taskList": {
      const ordered = type === "orderedList";
      const start = Number(attrs.start ?? 1);
      return content
        .map((item, index) => {
          const itemAttrs = (item.attrs as Record<string, unknown> | undefined) ?? {};
          const marker =
            type === "taskList"
              ? `- [${itemAttrs.checked ? "x" : " "}]`
              : ordered
                ? `${start + index}.`
                : "-";
          const inner = (item.content as Node[] | undefined) ?? [];
          const [first, ...rest] = inner;
          const head = first ? block(first, 0).trim() : "";
          const tail = rest.map((child) => block(child, depth + 1)).filter(Boolean).join("\n");
          return `${pad}${marker} ${head}${tail ? `\n${tail}` : ""}`.trimEnd();
        })
        .join("\n");
    }
    case "listItem":
      return content.map((child) => block(child, depth)).filter(Boolean).join("\n\n");
    case "table": {
      const rows = content.map((row) =>
        ((row.content as Node[] | undefined) ?? []).map((cell) => {
          const cellContent = (cell.content as Node[] | undefined) ?? [];
          const cellText = cellContent.map((child) => inline((child.content as Node[] | undefined) ?? [])).join(" ");
          return cellText.replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ").trim();
        }),
      );
      if (!rows.length) return "";
      const width = Math.max(...rows.map((r) => r.length));
      const padRow = (r: string[]) => [...r, ...Array(Math.max(0, width - r.length)).fill("")];
      const header = padRow(rows[0]);
      const lines = [
        `| ${header.join(" | ")} |`,
        `| ${header.map(() => "---").join(" | ")} |`,
        ...rows.slice(1).map((r) => `| ${padRow(r).join(" | ")} |`),
      ];
      return lines.join("\n");
    }
    case "image": {
      const alt = typeof attrs.alt === "string" ? attrs.alt : "";
      const src = typeof attrs.src === "string" ? attrs.src : "";
      return src ? `![${alt}](${src})` : "";
    }
    default: {
      const inner = content.map((child) => block(child, depth)).filter(Boolean).join("\n\n");
      return inner || inline(content).trim();
    }
  }
}

export function tiptapToMarkdown(doc: unknown): string {
  if (!doc || typeof doc !== "object") return "";
  const root = doc as Node;
  const content = (root.content as Node[] | undefined) ?? [];
  return content
    .map((node) => block(node))
    .filter((chunk) => chunk.trim().length > 0)
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function tiptapToHtml(doc: unknown): string {
  if (!doc || typeof doc !== "object") return "";
  try {
    return generateHTML(doc as never, baseExtensions as never);
  } catch (error) {
    console.error("[markdown] html render failed", error);
    return "";
  }
}

/** Minimal HTML → markdown for pasted content. No DOM required. */
export function htmlToMarkdown(html: string): string {
  if (!html) return "";
  const text = html
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(
      /<\s*h([1-4])[^>]*>([\s\S]*?)<\s*\/\s*h\1\s*>/gi,
      (_m, level: string, body: string) => `\n\n${"#".repeat(Number(level))} ${body.trim()}\n\n`,
    )
    .replace(/<\s*li[^>]*>([\s\S]*?)<\s*\/\s*li\s*>/gi, (_m, body: string) => `\n- ${body.trim()}`)
    .replace(/<\s*blockquote[^>]*>([\s\S]*?)<\s*\/\s*blockquote\s*>/gi, (_m, body: string) =>
      `\n\n${body
        .trim()
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n")}\n\n`,
    )
    .replace(/<\s*\/\s*(p|div|section|article|ul|ol|table|tr)\s*>/gi, "\n\n")
    .replace(/<\s*(strong|b)\s*>([\s\S]*?)<\s*\/\s*\1\s*>/gi, "**$2**")
    .replace(/<\s*(em|i)\s*>([\s\S]*?)<\s*\/\s*\1\s*>/gi, "*$2*")
    .replace(/<\s*code\s*>([\s\S]*?)<\s*\/\s*code\s*>/gi, "`$1`")
    .replace(/<\s*a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\s*\/\s*a\s*>/gi, "[$2]($1)")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
  return text.trim();
}

export function plainText(doc: unknown): string {
  if (!doc || typeof doc !== "object") return "";
  const out: string[] = [];
  const walk = (node: Node) => {
    if (node.type === "text" && typeof node.text === "string") out.push(node.text);
    const content = node.content as Node[] | undefined;
    if (Array.isArray(content)) content.forEach(walk);
    if (["paragraph", "heading", "blockquote", "listItem", "tableRow"].includes(String(node.type)))
      out.push("\n");
  };
  walk(doc as Node);
  return out.join("").replace(/\n{3,}/g, "\n\n").trim();
}

export function countWords(text: string | null | undefined): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** Naive but predictable markdown → TipTap JSON, used by the API for plain text input. */
export function markdownToTiptap(markdown: string): TipTapDoc {
  if (!markdown?.trim()) return EMPTY_DOC;
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const content: Array<Record<string, unknown>> = [];
  let paragraph: string[] = [];
  let inCode = false;
  let codeLines: string[] = [];
  let listItems: string[] = [];
  let listType: "bulletList" | "orderedList" | null = null;

  const flushParagraph = () => {
    if (paragraph.length) {
      const text = paragraph.join(" ").trim();
      if (text) content.push({ type: "paragraph", content: inlineNodes(text) });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (listItems.length && listType) {
      content.push({
        type: listType,
        content: listItems.map((item) => ({
          type: "listItem",
          content: [{ type: "paragraph", content: inlineNodes(item) }],
        })),
      });
    }
    listItems = [];
    listType = null;
  };
  const flushCode = () => {
    if (codeLines.length) {
      content.push({
        type: "codeBlock",
        attrs: { language: null },
        content: [{ type: "text", text: codeLines.join("\n") }],
      });
    }
    codeLines = [];
  };

  for (const raw of lines) {
    const line = raw;
    if (line.trimStart().startsWith("```")) {
      if (inCode) {
        flushCode();
        inCode = false;
      } else {
        flushParagraph();
        flushList();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeLines.push(line);
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flushParagraph();
      flushList();
      content.push({
        type: "heading",
        attrs: { level: heading[1].length },
        content: inlineNodes(heading[2]),
      });
      continue;
    }
    if (/^>\s?/.test(line)) {
      flushParagraph();
      flushList();
      content.push({
        type: "blockquote",
        content: [{ type: "paragraph", content: inlineNodes(line.replace(/^>\s?/, "")) }],
      });
      continue;
    }
    if (/^[-*+]\s+/.test(line)) {
      flushParagraph();
      if (listType && listType !== "bulletList") flushList();
      listType = "bulletList";
      listItems.push(line.replace(/^[-*+]\s+/, ""));
      continue;
    }
    if (/^\d+[.)]\s+/.test(line)) {
      flushParagraph();
      if (listType && listType !== "orderedList") flushList();
      listType = "orderedList";
      listItems.push(line.replace(/^\d+[.)]\s+/, ""));
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
      flushParagraph();
      flushList();
      content.push({ type: "horizontalRule" });
      continue;
    }
    const image = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (image) {
      flushParagraph();
      flushList();
      content.push({ type: "image", attrs: { src: image[2], alt: image[1], title: null } });
      continue;
    }
    paragraph.push(line.trim());
  }
  flushParagraph();
  flushList();
  if (inCode) flushCode();

  if (!content.length) return EMPTY_DOC;
  return { type: "doc", content };
}

function inlineNodes(text: string): Array<Record<string, unknown>> {
  const nodes: Array<Record<string, unknown>> = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|`[^`]+`|~~[^~]+~~)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    if (match.index > last) nodes.push({ type: "text", text: text.slice(last, match.index) });
    const token = match[0];
    if (token.startsWith("**")) nodes.push({ type: "text", text: token.slice(2, -2), marks: [{ type: "bold" }] });
    else if (token.startsWith("~~")) nodes.push({ type: "text", text: token.slice(2, -2), marks: [{ type: "strike" }] });
    else if (token.startsWith("`")) nodes.push({ type: "text", text: token.slice(1, -1), marks: [{ type: "code" }] });
    else if (token.startsWith("_")) nodes.push({ type: "text", text: token.slice(1, -1), marks: [{ type: "italic" }] });
    else nodes.push({ type: "text", text: token.slice(1, -1), marks: [{ type: "italic" }] });
    last = match.index + token.length;
  }
  if (last < text.length) nodes.push({ type: "text", text: text.slice(last) });
  return nodes.length ? nodes : [{ type: "text", text }];
}

export { EMPTY_DOC };
