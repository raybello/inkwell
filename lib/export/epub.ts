import JSZip from "jszip";
import { absoluteImageUrl } from "./images";
import { escapeAttr, escapeHtml, parseHtml, serializeNodes, type HtmlNode } from "./html-parse";
import { epubCss, resolveStyle } from "./styles";
import type { ExportDocument, FetchedImage, ImageMap } from "./types";
import { epubTimestamp, openerLabel, xmlSafe } from "./util";

const XML_HEAD = '<?xml version="1.0" encoding="utf-8"?>';

function xhtmlDoc(opts: {
  title: string;
  language: string;
  body: string;
  bodyAttrs?: string;
  extraHead?: string;
  bodyClass?: string;
}): string {
  return `${XML_HEAD}
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${escapeAttr(opts.language)}" xml:lang="${escapeAttr(opts.language)}">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(xmlSafe(opts.title))}</title>
  <link rel="stylesheet" type="text/css" href="styles.css" />
  ${opts.extraHead ?? ""}
</head>
<body${opts.bodyAttrs ? ` ${opts.bodyAttrs}` : ""}${opts.bodyClass ? ` class="${escapeAttr(opts.bodyClass)}"` : ""}>
${opts.body}
</body>
</html>`;
}

function rewriteImages(nodes: HtmlNode[], images: Map<string, { href: string }>): void {
  for (const node of nodes) {
    if (node.type !== "element") continue;
    if (node.tag === "img") {
      const src = node.attrs.src;
      const mapped = src ? images.get(src) : undefined;
      if (mapped) node.attrs.src = mapped.href;
      else if (src) node.attrs.src = absoluteImageUrl(src);
      if (!node.attrs.alt) node.attrs.alt = "";
    }
    rewriteImages(node.children, images);
  }
}

function chapterXhtml(doc: ExportDocument, index: number, html: string, imageRefs: Map<string, { href: string }>): string {
  const chapter = doc.chapters[index];
  const style = resolveStyle(doc.style);
  const nodes = parseHtml(html);
  rewriteImages(nodes, imageRefs);
  const bodyHtml = xmlSafe(serializeNodes(nodes, { xhtml: true }));
  const labelText = style.openerLabel ? openerLabel(chapter.title, index) : "";
  const label = labelText ? `<p class="label">${escapeHtml(labelText)}</p>` : "";
  const synopsis = chapter.synopsis
    ? `<p class="ink-synopsis">${escapeHtml(xmlSafe(chapter.synopsis.trim()))}</p>`
    : "";
  const body = `<section class="ink-chapter" epub:type="chapter" id="ch${index + 1}" role="doc-chapter">
<header class="ink-opener">
${label}
<h1>${escapeHtml(xmlSafe(chapter.title))}</h1>
${synopsis}
</header>
<div class="ink-body">
${bodyHtml || "<p class=\"ink-empty\"><em>This chapter is empty.</em></p>"}
</div>
</section>`;
  return xhtmlDoc({ title: chapter.title, language: doc.language, body, bodyClass: "ink-page" });
}

function backCoverXhtml(doc: ExportDocument, cover: FetchedImage | undefined, href: string | null): string {
  if (!href || !cover) return "";
  return xhtmlDoc({
    title: "Back cover",
    language: doc.language,
    bodyAttrs: 'epub:type="backmatter"',
    bodyClass: "ink-cover-page",
    body: `<div class="ink-cover"><img src="${escapeAttr(href)}" alt="${escapeAttr(xmlSafe(doc.title))} back cover" /></div>`,
  });
}

function coverXhtml(doc: ExportDocument, cover: FetchedImage | undefined, coverHref: string | null): string {
  if (coverHref && cover) {
    return xhtmlDoc({
      title: "Cover",
      language: doc.language,
      bodyAttrs: 'epub:type="cover"',
      bodyClass: "ink-cover-page",
      body: `<div class="ink-cover"><img src="${escapeAttr(coverHref)}" alt="${escapeAttr(xmlSafe(doc.title))}" /></div>`,
    });
  }
  const subtitle = doc.subtitle ? `<p class="subtitle">${escapeHtml(xmlSafe(doc.subtitle))}</p>` : "";
  const author = doc.author ? `<p class="author">${escapeHtml(xmlSafe(doc.author))}</p>` : "";
  return xhtmlDoc({
    title: doc.title,
    language: doc.language,
    bodyClass: "ink-titlepage",
    body: `<section class="ink-titlepage" epub:type="titlepage">
<h1 class="title">${escapeHtml(xmlSafe(doc.title))}</h1>
${subtitle}
${author}
</section>`,
  });
}

function navXhtml(doc: ExportDocument, hrefs: string[]): string {
  const items = doc.chapters
    .map(
      (chapter, i) =>
        `      <li><a href="${escapeAttr(hrefs[i])}">${escapeHtml(xmlSafe(chapter.title))}</a></li>`,
    )
    .join("\n");
  const body = `<nav epub:type="toc" id="toc" role="doc-toc">
    <h1 class="toc-title">Contents</h1>
    <ol>
${items}
    </ol>
  </nav>
  <nav epub:type="landmarks" id="landmarks" hidden="hidden">
    <ol>
      <li><a epub:type="bodymatter" href="${escapeAttr(hrefs[0] ?? "nav.xhtml")}">Begin reading</a></li>
    </ol>
  </nav>`;
  return xhtmlDoc({ title: "Contents", language: doc.language, body, bodyClass: "ink-toc-page" });
}

function opf(doc: ExportDocument, manifest: string[], spine: string[]): string {
  const metadata = [
    `    <dc:identifier id="pub-id">${escapeHtml(xmlSafe(doc.identifier))}</dc:identifier>`,
    `    <dc:title id="title">${escapeHtml(xmlSafe(doc.title))}</dc:title>`,
    doc.subtitle
      ? `    <dc:title id="subtitle">${escapeHtml(xmlSafe(doc.subtitle))}</dc:title>\n    <meta refines="#subtitle" property="title-type">subtitle</meta>`
      : "",
    `    <dc:language>${escapeHtml(doc.language)}</dc:language>`,
    doc.author ? `    <dc:creator id="creator">${escapeHtml(xmlSafe(doc.author))}</dc:creator>` : "",
    `    <dc:date>${doc.createdAt.toISOString().slice(0, 10)}</dc:date>`,
    `    <dc:publisher>Inkwell Studio</dc:publisher>`,
    doc.description ? `    <dc:description>${escapeHtml(xmlSafe(doc.description))}</dc:description>` : "",
    doc.genre ? `    <dc:subject>${escapeHtml(xmlSafe(doc.genre))}</dc:subject>` : "",
    `    <meta property="dcterms:modified">${epubTimestamp(doc.createdAt)}</meta>`,
  ]
    .filter(Boolean)
    .join("\n");

  const spineItems = spine.map((id) => `    <itemref idref="${id}" />`).join("\n");

  return `${XML_HEAD}
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id" xml:lang="${escapeAttr(doc.language)}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
${metadata}
  </metadata>
  <manifest>
${manifest.join("\n")}
  </manifest>
  <spine>
${spineItems}
  </spine>
</package>`;
}

const CONTAINER = `${XML_HEAD}
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml" />
  </rootfiles>
</container>`;

const MEDIA_TYPES: Record<FetchedImage["ext"], string> = {
  png: "image/png",
  jpg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};

/** EPUB 3 builder. `mimetype` must be the first entry and stored uncompressed. */
export async function generateEpub(doc: ExportDocument, images: ImageMap): Promise<Uint8Array> {
  const zip = new JSZip();
  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

  const style = resolveStyle(doc.style);

  // Image collection: cover first, then inline images in reading order.
  const imageEntries: { id: string; href: string; mediaType: string; image: FetchedImage }[] = [];
  const imageRefs = new Map<string, { href: string }>();
  const usedNames = new Set<string>();
  const addImage = (src: string, idHint: string): string | null => {
    const existing = imageRefs.get(src);
    if (existing) return existing.href;
    const image = images.get(src);
    if (!image) return null;
    if (image.ext === "webp") return null;
    let base = `${idHint}-${imageEntries.length + 1}`;
    while (usedNames.has(base)) base = `${base}x`;
    usedNames.add(base);
    const href = `images/${base}.${image.ext}`;
    imageEntries.push({ id: base, href, mediaType: MEDIA_TYPES[image.ext], image });
    imageRefs.set(src, { href });
    return href;
  };

  const coverHref = doc.options.includeCover && doc.coverUrl ? addImage(doc.coverUrl, "cover") : null;
  const coverEntry = coverHref ? imageEntries.find((entry) => entry.href === coverHref) : undefined;
  const backHref =
    doc.options.includeCover && doc.backCoverUrl ? addImage(doc.backCoverUrl, "back-cover") : null;
  const backEntry = backHref ? imageEntries.find((entry) => entry.href === backHref) : undefined;
  for (const chapter of doc.chapters) {
    const nodes = parseHtml(chapter.html);
    const walk = (list: HtmlNode[]) => {
      for (const node of list) {
        if (node.type !== "element") continue;
        if (node.tag === "img" && node.attrs.src) addImage(node.attrs.src, "img");
        walk(node.children);
      }
    };
    walk(nodes);
  }

  // Chapter documents.
  const chapterHrefs = doc.chapters.map((_, i) => `chapter-${i + 1}.xhtml`);
  doc.chapters.forEach((_, index) => {
    zip.file(`OEBPS/${chapterHrefs[index]}`, chapterXhtml(doc, index, doc.chapters[index].html, imageRefs));
  });
  zip.file("OEBPS/nav.xhtml", navXhtml(doc, chapterHrefs));
  zip.file("OEBPS/styles.css", epubCss(style, doc.options.dropCaps));
  zip.file("OEBPS/cover.xhtml", coverXhtml(doc, coverEntry?.image, coverHref));
  if (backHref) {
    zip.file("OEBPS/back-cover.xhtml", backCoverXhtml(doc, backEntry?.image, backHref));
  }

  const manifest: string[] = [
    `    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav" />`,
    `    <item id="css" href="styles.css" media-type="text/css" />`,
    `    <item id="cover" href="cover.xhtml" media-type="application/xhtml+xml" />`,
  ];
  if (backHref) {
    manifest.push(`    <item id="back-cover" href="back-cover.xhtml" media-type="application/xhtml+xml" />`);
  }
  for (const image of imageEntries) {
    const isCover = coverHref !== null && image.href === coverHref;
    manifest.push(
      `    <item id="${escapeAttr(image.id)}" href="${escapeAttr(image.href)}" media-type="${image.mediaType}"${isCover ? ' properties="cover-image"' : ""} />`,
    );
  }
  const spine: string[] = ["cover"];
  if (doc.options.includeToc && doc.scope === "project") {
    spine.push("nav");
  }
  doc.chapters.forEach((_, i) => {
    const id = `ch${i + 1}`;
    manifest.push(`    <item id="${id}" href="${chapterHrefs[i]}" media-type="application/xhtml+xml" />`);
    spine.push(id);
  });
  if (backHref) spine.push("back-cover");

  zip.file("OEBPS/content.opf", opf(doc, manifest, spine));
  zip.file("META-INF/container.xml", CONTAINER);

  for (const image of imageEntries) {
    zip.file(`OEBPS/${image.href}`, image.image.bytes, { binary: true, compression: "DEFLATE" });
  }

  const bytes = await zip.generateAsync({
    type: "uint8array",
    mimeType: "application/epub+zip",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  return bytes;
}
