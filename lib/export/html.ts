import { absoluteImageUrl } from "./images";
import { escapeAttr, escapeHtml, parseHtml, serializeNodes, type HtmlNode } from "./html-parse";
import { resolveStyle, styleCss } from "./styles";
import type { ExportDocument } from "./types";
import { openerLabel } from "./util";

function chapterLabel(doc: ExportDocument, index: number, title: string): string {
  return openerLabel(title, index);
}

function absolutiseImages(html: string): string {
  if (!html.includes("<img")) return html;
  const nodes = parseHtml(html);
  const walk = (list: HtmlNode[]) => {
    for (const node of list) {
      if (node.type !== "element") continue;
      if (node.tag === "img" && node.attrs.src) node.attrs.src = absoluteImageUrl(node.attrs.src);
      walk(node.children);
    }
  };
  walk(nodes);
  return serializeNodes(nodes, {});
}

function tocHtml(doc: ExportDocument): string {
  if (!doc.options.includeToc || doc.chapters.length < 2) return "";
  const items = doc.chapters
    .map(
      (chapter, i) =>
        `<li><a href="#ch-${i + 1}">${escapeHtml(chapter.title)}</a><span class="dots"></span></li>`,
    )
    .join("\n");
  return `<nav class="ink-toc" aria-label="Contents"><h2>Contents</h2><ol>${items}</ol></nav>`;
}

function chapterHtml(doc: ExportDocument, index: number, chapterId: string, title: string, synopsis: string | null, html: string, styleId: ExportDocument["style"]): string {
  const style = resolveStyle(styleId);
  const labelText = style.openerLabel ? chapterLabel(doc, index, title) : "";
  const label = labelText ? `<span class="label">${escapeHtml(labelText)}</span>` : "";
  const rule =
    style.chapterRule === "ornament"
      ? `<span class="rule ornament" aria-hidden="true"></span>`
      : style.chapterRule === "line"
        ? `<span class="rule" aria-hidden="true"></span>`
        : "";
  const synopsisHtml = synopsis ? `<p class="ink-synopsis">${escapeHtml(synopsis.trim())}</p>` : "";
  return `<section class="ink-chapter" id="ch-${index + 1}" data-chapter-id="${escapeHtml(chapterId)}">
<header class="ink-opener">${label}<h1>${escapeHtml(title)}</h1>${rule}${synopsisHtml}</header>
<div class="ink-body">${absolutiseImages(html) || `<p class="ink-empty"><em>This chapter is empty.</em></p>`}</div>
</section>`;
}

/** A single self-contained HTML document, suitable for publishing to any website. */
export function generateHtml(doc: ExportDocument): Uint8Array {
  const style = resolveStyle(doc.style);
  const coverSrc = doc.options.includeCover && doc.coverUrl ? absoluteImageUrl(doc.coverUrl) : null;
  const backCoverSrc =
    doc.options.includeCover && doc.backCoverUrl ? absoluteImageUrl(doc.backCoverUrl) : null;
  const backCover = backCoverSrc
    ? `<figure class="ink-back-cover"><img src="${escapeAttr(backCoverSrc)}" alt="${escapeAttr(`${doc.title} back cover`)}" /></figure>`
    : "";

  const hero = `<header class="ink-hero">
${coverSrc ? `<figure class="ink-cover"><img src="${escapeAttr(coverSrc)}" alt="${escapeAttr(`${doc.title} cover`)}" /></figure>` : ""}
${doc.subtitle ? `<p class="ink-kicker">${escapeHtml(doc.subtitle)}</p>` : ""}
<h1 class="ink-book-title">${escapeHtml(doc.title)}</h1>
${doc.author ? `<p class="ink-byline">by ${escapeHtml(doc.author)}</p>` : ""}
${doc.description ? `<p class="ink-description">${escapeHtml(doc.description)}</p>` : ""}
</header>`;

  const chapters = doc.chapters
    .map((chapter, i) =>
      chapterHtml(doc, i, chapter.id, chapter.title, chapter.synopsis, chapter.html, doc.style),
    )
    .join("\n");

  const meta = [
    doc.genre ? `<meta name="keywords" content="${escapeAttr(doc.genre)}" />` : "",
    `<meta name="author" content="${escapeAttr(doc.author)}" />`,
    doc.description ? `<meta name="description" content="${escapeAttr(doc.description)}" />` : "",
  ]
    .filter(Boolean)
    .join("\n  ");

  const document = `<!doctype html>
<html lang="${escapeAttr(doc.language)}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="generator" content="Inkwell Studio" />
  <title>${escapeHtml(doc.title)}${doc.subtitle ? ` — ${escapeHtml(doc.subtitle)}` : ""}</title>
  ${meta}
  <style>
${styleCss(style, { dropCaps: doc.options.dropCaps })}
.ink-hero { max-width: var(--measure); margin: 0 auto; padding: 4.5rem 1.25rem 2.5rem; text-align: center; }
.ink-hero .ink-kicker { font-family: var(--label-font); font-size: 0.72rem; letter-spacing: 0.26em; text-transform: uppercase; color: var(--muted); margin: 0 0 1rem; }
.ink-book-title { font-family: var(--heading-font); font-size: clamp(2.4rem, 6vw, 3.6rem); line-height: 1.05; margin: 0 0 1rem; font-weight: ${style.heading.weight}; }
.ink-byline { font-family: var(--label-font); font-size: 0.78rem; letter-spacing: 0.22em; text-transform: uppercase; color: var(--muted); margin: 0; }
.ink-description { max-width: 34rem; margin: 1.6rem auto 0; color: var(--muted); font-style: italic; line-height: 1.6; text-align: center; }
.ink-toc { max-width: var(--measure); padding: 1rem 1.25rem 2.5rem; }
.ink-chapter { max-width: var(--measure); margin: 0 auto; padding: 0 1.25rem 4.5rem; }
.ink-empty { color: var(--muted); }
.ink-back-cover { max-width: var(--measure); margin: 0 auto 3rem; padding: 0 1.25rem; }
.ink-back-cover img { display: block; width: 100%; height: auto; box-shadow: 0 24px 60px -30px rgba(0,0,0,0.5); }
.ink-colophon { max-width: var(--measure); margin: 0 auto; padding: 3rem 1.25rem 5rem; border-top: 1px solid var(--rule); color: var(--muted); font-family: var(--label-font); font-size: 0.7rem; letter-spacing: 0.16em; text-transform: uppercase; text-align: center; }
@media (max-width: 640px) { .ink-hero { padding-top: 2.5rem; } .ink-chapter { padding-bottom: 3rem; } }
  </style>
</head>
<body>
  <main>
    ${hero}
    ${tocHtml(doc)}
    ${chapters}
    ${backCover}
  </main>
  <footer class="ink-colophon">${escapeHtml(doc.title)}${doc.author ? ` · ${escapeHtml(doc.author)}` : ""} · Made with Inkwell Studio</footer>
</body>
</html>`;

  return new TextEncoder().encode(document);
}
