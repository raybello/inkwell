import { generateDocx } from "./docx";
import { generateEpub } from "./epub";
import { generateHtml } from "./html";
import { fetchImages } from "./images";
import { collectImageSources } from "./html-parse";
import { generateJson } from "./json";
import { generateMarkdown } from "./markdown";
import { generatePdf } from "./pdf";
import { buildExportDocument, exportBaseName } from "./prepare";
import { FORMAT_META, type ExportFormat, type GeneratedExport, type GenerateExportInput, type ImageMap } from "./types";

const NEEDS_IMAGE_BYTES: ExportFormat[] = ["epub", "docx", "pdf", "pdf_screen"];

/**
 * The single entry point for every export format.
 *
 * Generation is synchronous (callers mark the job `processing` first). Images
 * are fetched up-front only for formats that embed bytes; the HTML export keeps
 * absolute URLs so the page stays portable.
 */
export async function generateExport(input: GenerateExportInput): Promise<GeneratedExport> {
  const format = input.format;
  if (!FORMAT_META[format]) throw new Error(`Unsupported export format: ${format}`);

  const doc = buildExportDocument(input);
  const meta = FORMAT_META[format];
  const filename = `${exportBaseName(doc)}.${meta.ext}`;

  let images: ImageMap = new Map();
  if (NEEDS_IMAGE_BYTES.includes(format)) {
    const urls: string[] = [];
    if (doc.options.includeCover && doc.coverUrl) urls.push(doc.coverUrl);
    for (const chapter of doc.chapters) urls.push(...collectImageSources(chapter.html));
    images = await fetchImages(urls);
  }

  switch (format) {
    case "markdown":
      return { bytes: generateMarkdown(doc), filename, contentType: meta.contentType };
    case "html":
      return { bytes: generateHtml(doc), filename, contentType: meta.contentType };
    case "json":
      return { bytes: generateJson(doc), filename, contentType: meta.contentType };
    case "docx":
      return { bytes: await generateDocx(doc, images), filename, contentType: meta.contentType };
    case "epub":
      return { bytes: await generateEpub(doc, images), filename, contentType: meta.contentType };
    case "pdf":
      return { bytes: await generatePdf(doc, images, "print"), filename, contentType: meta.contentType };
    case "pdf_screen":
      return { bytes: await generatePdf(doc, images, "screen"), filename, contentType: meta.contentType };
    default:
      throw new Error(`Unsupported export format: ${format as string}`);
  }
}

export { buildExportDocument, exportBaseName } from "./prepare";
export { STYLE_TEMPLATES, resolveStyle, styleCss } from "./styles";
export { FORMAT_META, FORMAT_ORDER } from "./types";
export type {
  ExportDocument,
  ExportFormat,
  ExportOptions,
  ExportScope,
  GeneratedExport,
  GenerateExportInput,
  StyleName,
} from "./types";
