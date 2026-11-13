/**
 * Verification harness for the Inkwell export engine.
 *
 *   node --env-file=.env.local scripts/verify-export.mjs
 *
 * Generates every format for the seeded project, then validates the artefacts:
 *   - EPUB: entry order, stored mimetype, XML well-formedness (via python3)
 *   - DOCX: OOXML parts present, zip integrity, XML well-formedness
 *   - PDF: reload with pdf-lib, page count, TOC annotations
 *   - markup formats: structural assertions
 * Also stress-tests a synthetic 100k-word manuscript for PDF pagination.
 *
 * Files land in $TMPDIR/inkwell-export-verify (never inside the repo).
 */
import { mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { register } from "node:module";

register("./ts-alias-loader.mjs", import.meta.url);

const { createClient } = await import("@supabase/supabase-js");
const { generateExport } = await import("../lib/export/index.ts");
const { PDFDocument, PDFName } = await import("pdf-lib");
const JSZip = (await import("jszip")).default;

const PROJECT_ID = "0deff67b-c27a-4147-868d-0310d66eaa8d";
const OUT = join(process.env.TMPDIR || "/tmp", "inkwell-export-verify");
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const failures = [];
const checks = [];
function check(name, condition, detail = "") {
  checks.push({ name, ok: !!condition, detail });
  if (!condition) failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
  console.log(`${condition ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const { error: loginError } = await supabase.auth.signInWithPassword({
  email: "demo@inkwell.studio",
  password: "inkwell-demo-2026",
});
if (loginError) {
  console.error("Login failed:", loginError.message);
  process.exit(1);
}

const { data: project } = await supabase.from("projects").select("*").eq("id", PROJECT_ID).single();
const { data: chapters } = await supabase.from("chapters").select("*").eq("project_id", PROJECT_ID).order("position");
const { data: assets } = await supabase.from("assets").select("*").eq("project_id", PROJECT_ID);
const { data: notes } = await supabase.from("notes").select("*").eq("project_id", PROJECT_ID);
check("loaded seeded project", project && chapters?.length === 5, `${chapters?.length} chapters`);

function save(name, bytes) {
  const path = join(OUT, name);
  writeFileSync(path, bytes);
  return path;
}

function parseXmlFiles(paths) {
  const script = `
import sys, zipfile, xml.etree.ElementTree as ET
bad = []
for path in sys.argv[1:]:
    try:
        if path.endswith(".zipdir"):
            continue
        if path.endswith(".epub") or path.endswith(".docx"):
            with zipfile.ZipFile(path) as z:
                for name in z.namelist():
                    if name.endswith((".xml", ".xhtml", ".opf", ".ncx")):
                        ET.fromstring(z.read(name))
        else:
            ET.parse(path)
    except Exception as e:
        bad.append(f"{path}: {e}")
print("\\n".join(bad))
sys.exit(1 if bad else 0)
`;
  try {
    execFileSync("python3", ["-c", script, ...paths], { encoding: "utf8" });
    return { ok: true, errors: "" };
  } catch (error) {
    return { ok: false, errors: String(error.stdout || error.message).trim() };
  }
}

const base = { project, chapters, assets: assets ?? [], notes: notes ?? [], authorName: "Demo Writer" };
const results = {};

for (const style of ["literary", "modern", "minimal"]) {
  for (const format of ["markdown", "html", "docx", "epub", "pdf", "pdf_screen", "json"]) {
    const started = Date.now();
    try {
      const result = await generateExport({ ...base, format, style, options: { includeCover: true, includeToc: true } });
      const path = save(`salt-road-${style}.${format}`, result.bytes);
      results[`${format}:${style}`] = result;
      const sizeKb = (result.bytes.length / 1024).toFixed(1);
      check(`generate ${format} (${style})`, result.bytes.length > 150, `${sizeKb} KB, ${Date.now() - started} ms`);
      void path;
    } catch (error) {
      check(`generate ${format} (${style})`, false, error instanceof Error ? error.stack || error.message : String(error));
    }
  }
}

// ---------------- EPUB structure ----------------
const epubPath = join(OUT, "salt-road-literary.epub");
const rawEpub = readFileSync(epubPath);
const zip = await JSZip.loadAsync(rawEpub);
const names = Object.keys(zip.files);
check("EPUB mimetype is first entry", names[0] === "mimetype", names.slice(0, 4).join(", "));
const firstLocal = rawEpub.subarray(0, 80).toString("latin1");
check("EPUB mimetype stored uncompressed", rawEpub.subarray(30, 38).toString("latin1") === "mimetype" && rawEpub[8] === 0, `flags=${rawEpub[6]}|${rawEpub[7]} method=${rawEpub[8]}|${rawEpub[9]}`);
for (const required of [
  "META-INF/container.xml",
  "OEBPS/content.opf",
  "OEBPS/nav.xhtml",
  "OEBPS/styles.css",
  "OEBPS/cover.xhtml",
  "OEBPS/chapter-1.xhtml",
  "OEBPS/chapter-5.xhtml",
]) {
  check(`EPUB has ${required}`, names.includes(required));
}
const opf = await zip.file("OEBPS/content.opf").async("string");
check("EPUB OPF package version 3", /version="3\.0"/.test(opf));
check("EPUB OPF has dc:title/author/language", /dc:title/.test(opf) && /dc:creator/.test(opf) && /dc:language/.test(opf));
check("EPUB OPF dcterms:modified", /dcterms:modified/.test(opf));
check("EPUB nav has epub:type toc", /epub:type="toc"/.test(await zip.file("OEBPS/nav.xhtml").async("string")));
const chapter1 = await zip.file("OEBPS/chapter-1.xhtml").async("string");
check("EPUB chapter is XHTML", /<\?xml/.test(chapter1) && /xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/.test(chapter1));
check("EPUB chapter self-closes void tags", !/<br>/.test(chapter1) && !/<img[^>]*[^/]>\s*</.test(chapter1.replace(/<img[^>]*\/>/g, "")));
const epubXml = parseXmlFiles([epubPath]);
check("EPUB all XML parts are well-formed", epubXml.ok, epubXml.errors);

// ---------------- DOCX ----------------
const docxPath = join(OUT, "salt-road-literary.docx");
const docxZip = await JSZip.loadAsync(readFileSync(docxPath));
const docxNames = Object.keys(docxZip.files);
for (const part of ["[Content_Types].xml", "word/document.xml", "word/styles.xml"]) {
  check(`DOCX has ${part}`, docxNames.includes(part));
}
const docXml = await docxZip.file("word/document.xml").async("string");
check("DOCX manuscript uses Times New Roman", /Times New Roman/.test(docXml));
check("DOCX has page breaks per chapter", (docXml.match(/pageBreakBefore/g) || []).length >= 5);
check("DOCX contains chapter title", docXml.includes("Chapter One"));
const docxXml = parseXmlFiles([docxPath]);
check("DOCX XML well-formed", docxXml.ok, docxXml.errors);

// ---------------- PDF ----------------
for (const key of ["pdf:literary", "pdf_screen:literary", "pdf:modern", "pdf:minimal"]) {
  const result = results[key];
  if (!result) continue;
  const doc = await PDFDocument.load(result.bytes);
  check(`PDF ${key} reloads`, doc.getPageCount() > 5, `${doc.getPageCount()} pages`);
  const first = doc.getPage(0);
  check(`PDF ${key} page size`, first.getWidth() > 400 && first.getHeight() > 500, `${first.getWidth().toFixed(0)}×${first.getHeight().toFixed(0)}`);
  if (key === "pdf:literary") {
    const { width, height } = first.getSize();
    check("PDF print trim is 6×9in", Math.round(width) === 432 && Math.round(height) === 648, `${width}×${height}`);
  }
}
const screenPdfBytes = results["pdf_screen:literary"]?.bytes;
if (screenPdfBytes) {
  const doc = await PDFDocument.load(screenPdfBytes);
  let annots = 0;
  for (const page of doc.getPages()) {
    const arr = page.node.lookup(PDFName.of("Annots"));
    if (arr) annots += arr.size ? arr.size() : 0;
  }
  check("PDF screen has link annotations", annots > 0, `${annots} annotations`);
}

// ---------------- markup ----------------
const md = results["markdown:literary"].bytes;
const mdText = Buffer.from(md).toString("utf8");
check("Markdown starts with YAML front matter", mdText.startsWith("---\ntitle:"));
check("Markdown has one H1 per chapter", (mdText.match(/^# /gm) || []).length >= 6);
const html = Buffer.from(results["html:literary"].bytes).toString("utf8");
check("HTML is standalone", html.startsWith("<!doctype html>") && html.includes("</html>"));
check("HTML has anchored TOC", html.includes('class="ink-toc"') && html.includes('id="ch-1"'));
check("HTML has embedded style", html.includes("<style>") && html.includes("--body-font"));
const json = JSON.parse(Buffer.from(results["json:literary"].bytes).toString("utf8"));
check("JSON dump has project + chapters + notes", json.project?.id === PROJECT_ID && json.chapters.length === 5 && json.notes.length > 0);

// ---------------- chapter scope ----------------
const chapterId = chapters[1].id;
for (const format of ["markdown", "epub", "pdf", "docx"]) {
  try {
    const result = await generateExport({ ...base, format, style: "modern", scope: "chapter", chapterId });
    save(`chapter-scope.${format}`, result.bytes);
    check(`chapter-scope ${format}`, result.filename.includes("chapter-one"), result.filename);
    if (format === "epub") {
      const z = await JSZip.loadAsync(result.bytes);
      const opfText = await z.file("OEBPS/content.opf").async("string");
      check("chapter-scope EPUB has single chapter", (opfText.match(/chapter-/g) || []).length === 1);
    }
    if (format === "pdf") {
      const d = await PDFDocument.load(result.bytes);
      check("chapter-scope PDF has pages", d.getPageCount() > 1, `${d.getPageCount()} pages`);
    }
  } catch (error) {
    check(`chapter-scope ${format}`, false, error instanceof Error ? error.message : String(error));
  }
}


// ---------------- cover + inline image embedding ----------------
import { deflateSync } from "node:zlib";

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i];
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function makePng(width, height, [r, g, b]) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const row = Buffer.alloc(1 + width * 3);
  for (let x = 0; x < width; x += 1) {
    row[1 + x * 3] = r;
    row[2 + x * 3] = g;
    row[3 + x * 3] = b;
  }
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const coverPng = makePng(600, 900, [176, 106, 62]);
const inlinePng = makePng(480, 300, [92, 112, 128]);
const coverUri = `data:image/png;base64,${coverPng.toString("base64")}`;
const inlineUri = `data:image/png;base64,${inlinePng.toString("base64")}`;
const imageChapters = chapters.map((chapter, index) =>
  index === 1
    ? {
        ...chapter,
        content: {
          type: "doc",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "The map room, photographed the week the survey began." }] },
            { type: "image", attrs: { src: inlineUri, alt: "Survey map", title: null } },
            { type: "paragraph", content: [{ type: "text", text: "Every line on it had been redrawn by hand." }] },
          ],
        },
        content_md: "The map room, photographed the week the survey began.",
      }
    : chapter,
);
const projectWithCover = { ...project, cover_image_url: coverUri };

for (const format of ["epub", "pdf", "docx"]) {
  try {
    const result = await generateExport({
      project: projectWithCover,
      chapters: imageChapters,
      format,
      style: "modern",
      options: { includeCover: true, includeToc: true },
      authorName: "Demo Writer",
    });
    save(`images.${format}`, result.bytes);
    if (format === "epub") {
      const z = await JSZip.loadAsync(result.bytes);
      const names2 = Object.keys(z.files);
      const opf2 = await z.file("OEBPS/content.opf").async("string");
      check("EPUB embeds cover image", names2.some((n) => /^OEBPS\/images\/cover-1\.png$/.test(n)), names2.filter((n) => n.includes("/images/")).join(", "));
      check("EPUB marks cover-image", /properties="cover-image"/.test(opf2));
      check("EPUB embeds inline image", names2.some((n) => /^OEBPS\/images\/img-\d+\.png$/.test(n)));
      const ch1 = await z.file("OEBPS/chapter-2.xhtml").async("string");
      check("EPUB chapter references embedded image", /src="images\/img-\d+\.png"/.test(ch1));
      const xml2 = parseXmlFiles([join(OUT, "images.epub")]);
      check("EPUB with images XML well-formed", xml2.ok, xml2.errors);
    }
    if (format === "pdf") {
      const doc = await PDFDocument.load(result.bytes);
      check("PDF with cover has a dedicated cover page", doc.getPageCount() >= 8, `${doc.getPageCount()} pages`);
      check("PDF with images is larger", result.bytes.length > results["pdf:modern"].bytes.length, `${(result.bytes.length / 1024).toFixed(1)} KB`);
    }
    if (format === "docx") {
      const z = await JSZip.loadAsync(result.bytes);
      check("DOCX embeds media", Object.keys(z.files).some((n) => n.startsWith("word/media/")));
      const xml3 = parseXmlFiles([join(OUT, "images.docx")]);
      check("DOCX with images XML well-formed", xml3.ok, xml3.errors);
    }
  } catch (error) {
    check(`image embedding ${format}`, false, error instanceof Error ? error.stack || error.message : String(error));
  }
}

// ---------------- 100k word stress PDF ----------------
const filler = Array.from({ length: 150 }, (_, i) =>
  `The road bent north again at mile ${i}, and the sea kept its own accounting of the stones. She walked until the light failed, counting the gaps in the wall where the wind came through.`,
).join("\n\n");
const bigChapters = Array.from({ length: 22 }, (_, i) => ({
  ...chapters[1],
  id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
  title: `Chapter ${i + 1} — The Long Road`,
  position: i,
  content: null,
  content_md: filler,
  word_count: 4500,
}));
const startedBig = Date.now();
try {
  const big = await generateExport({
    project: { ...project, cover_image_url: null },
    chapters: bigChapters,
    format: "pdf",
    style: "literary",
    options: { includeToc: true },
    authorName: "Demo Writer",
  });
  const elapsed = Date.now() - startedBig;
  const doc = await PDFDocument.load(big.bytes);
  const words = bigChapters.reduce((s, c) => s + c.content_md.split(/\s+/).length, 0);
  save("stress-100k.pdf", big.bytes);
  check("100k-word PDF paginates", doc.getPageCount() > 100, `${doc.getPageCount()} pages, ${words.toLocaleString()} words, ${(elapsed / 1000).toFixed(1)}s`);
  check("100k-word PDF under 30s", elapsed < 30000, `${(elapsed / 1000).toFixed(1)}s`);

  const epubStarted = Date.now();
  const bigEpub = await generateExport({
    project: { ...project, cover_image_url: null },
    chapters: bigChapters,
    format: "epub",
    style: "literary",
    options: { includeToc: true },
    authorName: "Demo Writer",
  });
  const epubElapsed = Date.now() - epubStarted;
  save("stress-100k.epub", bigEpub.bytes);
  const bigZip = await JSZip.loadAsync(bigEpub.bytes);
  const bigOpf = await bigZip.file("OEBPS/content.opf").async("string");
  check("100k-word EPUB includes all chapters", (bigOpf.match(/chapter-\d+\.xhtml/g) || []).length >= 22, `${(bigEpub.bytes.length / 1024 / 1024).toFixed(1)} MB, ${(epubElapsed / 1000).toFixed(1)}s`);
} catch (error) {
  check("100k-word PDF paginates", false, error instanceof Error ? error.stack || error.message : String(error));
}

// ---------------- Unicode / typography safety ----------------
const unicodeChapter = {
  ...chapters[1],
  title: "Chapter One — “Low Water”",
  content: null,
  content_md:
    "“The harbour was in the wrong place,” she said — and meant it.\n\nMira wrote the Greek letters αβγ beside the Russian word штиль, then a Japanese line: 海は静かだった。 An emoji 🚀 and a formula ≤ 3 × 4 followed.\n\nhttps://example.com/a-very-long-unbroken-url-that-should-wrap-without-crashing-the-layout-engine",
};
try {
  for (const format of ["pdf", "epub", "html", "docx", "markdown"]) {
    const result = await generateExport({
      project: { ...project, title: "The Salt Road — Special “Edition”" },
      chapters: [unicodeChapter],
      format,
      style: "literary",
      options: { includeToc: false },
      authorName: "Demo Writer",
    });
    save(`unicode.${format}`, result.bytes);
    check(`unicode-safe ${format}`, result.bytes.length > 100, `${(result.bytes.length / 1024).toFixed(1)} KB`);
  }
  const u = await PDFDocument.load(readFileSync(join(OUT, "unicode.pdf")));
  check("unicode PDF paginates", u.getPageCount() > 0, `${u.getPageCount()} pages`);
  const uepub = await JSZip.loadAsync(readFileSync(join(OUT, "unicode.epub")));
  check("unicode EPUB XML well-formed", parseXmlFiles([join(OUT, "unicode.epub")]).ok);
  check("unicode EPUB keeps Japanese text", (await uepub.file("OEBPS/chapter-1.xhtml").async("string")).includes("海は静かだった"));
} catch (error) {
  check("unicode-safe exports", false, error instanceof Error ? error.stack || error.message : String(error));
}

console.log(`\n${checks.length - failures.length}/${checks.length} checks passed. Output: ${OUT}`);
if (failures.length) {
  console.error("\nFAILURES:\n- " + failures.join("\n- "));
  process.exit(1);
}
