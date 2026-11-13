/**
 * A small, tolerant HTML fragment parser + serialiser.
 *
 * TipTap emits a predictable subset of HTML, but it can still contain unclosed
 * void elements (`<img>`, `<br>`), raw `&` characters and entities. We parse it
 * into a tree so the PDF/DOCX/EPUB generators never have to regex their way
 * through markup. No DOM dependency: this runs in Node and in server actions.
 */

export type HtmlElement = {
  type: "element";
  tag: string;
  attrs: Record<string, string>;
  children: HtmlNode[];
};

export type HtmlText = { type: "text"; text: string };

export type HtmlNode = HtmlElement | HtmlText;

const VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const RAW_TEXT_TAGS = new Set(["script", "style"]);
const BLOCK_TAGS = new Set([
  "address", "article", "aside", "blockquote", "div", "dl", "dd", "dt", "fieldset", "figcaption", "figure",
  "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr", "li", "main", "nav", "ol", "p",
  "pre", "section", "table", "tbody", "td", "tfoot", "th", "thead", "tr", "ul",
]);

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: "\u00a0",
  mdash: "\u2014", ndash: "\u2013", hellip: "\u2026", middot: "\u00b7", bull: "\u2022",
  lsquo: "\u2018", rsquo: "\u2019", ldquo: "\u201c", rdquo: "\u201d",
  laquo: "\u00ab", raquo: "\u00bb", copy: "\u00a9", reg: "\u00ae", trade: "\u2122",
  deg: "\u00b0", times: "\u00d7", divide: "\u00f7", frac12: "\u00bd", frac14: "\u00bc", frac34: "\u00be",
  ensp: "\u2002", emsp: "\u2003", thinsp: "\u2009", zwnj: "\u200c", zwj: "\u200d",
  sect: "\u00a7", para: "\u00b6", dagger: "\u2020", Dagger: "\u2021", permil: "\u2030",
  euro: "\u20ac", pound: "\u00a3", yen: "\u00a5", cent: "\u00a2", plusmn: "\u00b1",
  agrave: "\u00e0", aacute: "\u00e1", acirc: "\u00e2", atilde: "\u00e3", auml: "\u00e4", aring: "\u00e5", aelig: "\u00e6", ccedil: "\u00e7",
  egrave: "\u00e8", eacute: "\u00e9", ecirc: "\u00ea", euml: "\u00eb",
  igrave: "\u00ec", iacute: "\u00ed", icirc: "\u00ee", iuml: "\u00ef",
  ntilde: "\u00f1", ograve: "\u00f2", oacute: "\u00f3", ocirc: "\u00f4", otilde: "\u00f5", ouml: "\u00f6", oslash: "\u00f8",
  ugrave: "\u00f9", uacute: "\u00fa", ucirc: "\u00fb", uuml: "\u00fc", yacute: "\u00fd", yuml: "\u00ff", szlig: "\u00df",
  Agrave: "\u00c0", Aacute: "\u00c1", Acirc: "\u00c2", Auml: "\u00c4", Aring: "\u00c5", AElig: "\u00c6", Ccedil: "\u00c7",
  Egrave: "\u00c8", Eacute: "\u00c9", Ecirc: "\u00ca", Euml: "\u00cb",
  Igrave: "\u00cc", Iacute: "\u00cd", Icirc: "\u00ce", Iuml: "\u00cf",
  Ntilde: "\u00d1", Ograve: "\u00d2", Oacute: "\u00d3", Ocirc: "\u00d4", Otilde: "\u00d5", Ouml: "\u00d6", Oslash: "\u00d8",
  Ugrave: "\u00d9", Uacute: "\u00da", Ucirc: "\u00db", Uuml: "\u00dc", Yacute: "\u00dd",
  prime: "\u2032", Prime: "\u2033", minus: "\u2212", lowbar: "_",
};

export function decodeEntities(input: string): string {
  if (!input || !input.includes("&")) return input;
  return input.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (match, body: string) => {
    if (body.startsWith("#")) {
      const hex = body[1] === "x" || body[1] === "X";
      const code = Number.parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return match;
      try {
        return String.fromCodePoint(code);
      } catch {
        return match;
      }
    }
    const named = NAMED_ENTITIES[body];
    return named === undefined ? match : named;
  });
}

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function escapeAttr(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function parseAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([a-zA-Z_:][\w:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw))) {
    const name = m[1].toLowerCase();
    if (name.startsWith("on")) continue;
    const value = m[2] ?? m[3] ?? m[4] ?? "";
    attrs[name] = decodeEntities(value);
  }
  return attrs;
}

/** Parse an HTML fragment into a forest of nodes. Never throws. */
export function parseHtml(html: string): HtmlNode[] {
  const root: HtmlElement = { type: "element", tag: "#root", attrs: {}, children: [] };
  const stack: HtmlElement[] = [root];
  const source = String(html ?? "");

  const pushText = (text: string) => {
    if (!text) return;
    const decoded = decodeEntities(text);
    stack[stack.length - 1].children.push({ type: "text", text: decoded });
  };

  let i = 0;
  while (i < source.length) {
    const lt = source.indexOf("<", i);
    if (lt === -1) {
      pushText(source.slice(i));
      break;
    }
    if (lt > i) pushText(source.slice(i, lt));

    // Comment / CDATA / doctype
    if (source.startsWith("<!--", lt)) {
      const end = source.indexOf("-->", lt + 4);
      i = end === -1 ? source.length : end + 3;
      continue;
    }
    if (source.startsWith("<![CDATA[", lt)) {
      const end = source.indexOf("]]>", lt + 9);
      if (end === -1) break;
      pushText(source.slice(lt + 9, end));
      i = end + 3;
      continue;
    }
    if (source.startsWith("<!", lt)) {
      const end = source.indexOf(">", lt);
      i = end === -1 ? source.length : end + 1;
      continue;
    }

    const gt = findTagEnd(source, lt + 1);
    if (gt === -1) {
      pushText(source.slice(lt));
      break;
    }
    const raw = source.slice(lt + 1, gt).trim();
    i = gt + 1;

    if (raw.startsWith("/")) {
      const tag = raw.slice(1).trim().toLowerCase();
      for (let s = stack.length - 1; s >= 1; s -= 1) {
        if (stack[s].tag === tag) {
          stack.length = s;
          break;
        }
      }
      continue;
    }

    const selfClosing = raw.endsWith("/");
    const body = selfClosing ? raw.slice(0, -1).trim() : raw;
    const space = body.search(/[\s/>]/);
    const tag = (space === -1 ? body : body.slice(0, space)).toLowerCase();
    if (!tag) continue;
    const attrs = space === -1 ? {} : parseAttrs(body.slice(space));

    const el: HtmlElement = { type: "element", tag, attrs, children: [] };
    stack[stack.length - 1].children.push(el);

    if (VOID_TAGS.has(tag) || selfClosing) continue;

    if (RAW_TEXT_TAGS.has(tag)) {
      const close = source.toLowerCase().indexOf(`</${tag}`, i);
      if (close === -1) {
        i = source.length;
      } else {
        const rawContent = source.slice(i, close);
        if (tag === "style") el.children.push({ type: "text", text: rawContent });
        const endGt = source.indexOf(">", close);
        i = endGt === -1 ? source.length : endGt + 1;
      }
      continue;
    }

    stack.push(el);
  }

  return root.children;
}

function findTagEnd(source: string, from: number): number {
  let quote: string | null = null;
  for (let i = from; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (ch === ">") {
      return i;
    }
  }
  return -1;
}

export interface SerializeOptions {
  xhtml?: boolean;
  /** Drop these tags entirely (including children unless `unwrap` says otherwise). */
  dropTags?: string[];
  unwrapTags?: string[];
  /** Remove attributes that are meaningless outside the editor. */
  dropDataAttrs?: boolean;
}

/** Serialise a node forest back to HTML or XHTML. */
export function serializeNodes(nodes: HtmlNode[], opts: SerializeOptions = {}): string {
  const drop = new Set(opts.dropTags ?? []);
  const unwrap = new Set(opts.unwrapTags ?? []);
  const out: string[] = [];

  const write = (node: HtmlNode, parentTag: string) => {
    if (node.type === "text") {
      const text = opts.xhtml ? escapeHtml(node.text) : escapeHtml(node.text);
      out.push(text);
      return;
    }
    if (node.tag === "#root") {
      node.children.forEach((child) => write(child, ""));
      return;
    }
    if (drop.has(node.tag)) return;
    if (unwrap.has(node.tag)) {
      node.children.forEach((child) => write(child, parentTag));
      return;
    }

    const attrs = Object.entries(node.attrs)
      .filter(([name]) => !(opts.dropDataAttrs && name.startsWith("data-")))
      .map(([name, value]) => (value === "" ? ` ${name}` : ` ${name}="${escapeAttr(value)}"`))
      .join("");

    if (VOID_TAGS.has(node.tag)) {
      out.push(opts.xhtml ? `<${node.tag}${attrs} />` : `<${node.tag}${attrs}>`);
      return;
    }

    out.push(`<${node.tag}${attrs}>`);
    node.children.forEach((child) => write(child, node.tag));
    out.push(`</${node.tag}>`);
  };

  nodes.forEach((node) => write(node, ""));
  return out.join("");
}

export function toXhtmlFragment(html: string): string {
  return serializeNodes(parseHtml(html), { xhtml: true, dropTags: ["script", "style"] });
}

export function textContent(node: HtmlNode): string {
  if (node.type === "text") return node.text;
  return node.children.map(textContent).join("");
}

export function findElements(nodes: HtmlNode[], tag: string): HtmlElement[] {
  const found: HtmlElement[] = [];
  const walk = (list: HtmlNode[]) => {
    for (const node of list) {
      if (node.type !== "element") continue;
      if (node.tag === tag) found.push(node);
      walk(node.children);
    }
  };
  walk(nodes);
  return found;
}

export function collectImageSources(html: string): string[] {
  const nodes = parseHtml(html);
  const urls = new Set<string>();
  for (const img of findElements(nodes, "img")) {
    const src = img.attrs.src;
    if (src) urls.add(src);
  }
  return [...urls];
}

/**
 * Remove a leading heading that merely repeats the chapter title (TipTap
 * documents often start with an H1 that duplicates the outline title).
 */
export function stripLeadingTitleHeading(html: string, title: string): string {
  const nodes = parseHtml(html);
  const normalise = (s: string) => s.toLowerCase().replace(/[\s\u00a0—–-]+/g, " ").replace(/[^\w ]/g, "").trim();
  const wanted = normalise(title);
  if (!wanted) return html;

  let index = 0;
  while (index < nodes.length) {
    const node = nodes[index];
    if (node.type === "text" && !node.text.trim()) {
      index += 1;
      continue;
    }
    break;
  }
  const first = nodes[index];
  if (first && first.type === "element" && /^h[1-3]$/.test(first.tag)) {
    const heading = normalise(textContent(first));
    if (heading === wanted || heading.startsWith(wanted) || wanted.startsWith(heading)) {
      nodes.splice(index, 1);
    }
  }
  return serializeNodes(nodes, {});
}

/** Block-level tags we care about when converting HTML to layout blocks. */
export function isBlockTag(tag: string): boolean {
  return BLOCK_TAGS.has(tag);
}

/**
 * Authors often type a bare `---` or `***` on its own line for a scene break.
 * TipTap stores it as a plain paragraph; promote it to an `<hr>` so every
 * renderer shows a typographic divider instead of literal dashes.
 */
export function normalizeSceneBreaks(html: string): string {
  if (!html || (!html.includes("-") && !html.includes("*") && !html.includes("_"))) return html;
  const nodes = parseHtml(html);
  const walk = (list: HtmlNode[]) => {
    for (const node of list) {
      if (node.type !== "element") continue;
      if (node.tag === "p" && /^\s*(?:[-*_]\s*){3,}$/.test(textContent(node))) {
        node.tag = "hr";
        node.children = [];
        node.attrs = {};
      } else {
        walk(node.children);
      }
    }
  };
  walk(nodes);
  return serializeNodes(nodes, {});
}

export { VOID_TAGS };
