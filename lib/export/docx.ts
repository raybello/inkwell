import {
  AlignmentType,
  Document,
  Footer,
  Header,
  ImageRun,
  Packer,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  convertInchesToTwip,
} from "docx";
import { htmlToBlocks, type Block, type InlineRun } from "./blocks";
import type { ExportDocument, ImageMap } from "./types";

const FONT = "Times New Roman";
const BODY_SIZE = 24; // half-points → 12pt
const LINE = 480; // 240 twips per line at 12pt ⇒ 480 = double spaced
const INDENT = convertInchesToTwip(0.5);

function runsToTextRuns(runs: InlineRun[], opts?: { italics?: boolean; size?: number }): TextRun[] {
  const out: TextRun[] = [];
  for (const run of runs) {
    const lines = run.text.split("\n");
    lines.forEach((text, index) => {
      if (index > 0) out.push(new TextRun({ break: 1 }));
      if (!text) return;
      out.push(
        new TextRun({
          text,
          font: run.style.code ? "Courier New" : FONT,
          size: run.style.code ? 20 : (opts?.size ?? BODY_SIZE),
          bold: !!run.style.bold,
          italics: !!(run.style.italic || opts?.italics),
          underline: run.style.underline || run.style.link ? { type: "single" as const } : undefined,
          strike: !!run.style.strike,
          color: run.style.link ? "6b4a2f" : undefined,
        }),
      );
    });
  }
  if (!out.length) return [new TextRun({ text: "", font: FONT, size: opts?.size ?? BODY_SIZE, italics: opts?.italics })];
  return out;
}

function paragraphFromRuns(
  runs: InlineRun[],
  opts: {
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
    firstLine?: number;
    spacingBefore?: number;
    spacingAfter?: number;
    italics?: boolean;
    size?: number;
    indentLeft?: number;
  } = {},
): Paragraph {
  return new Paragraph({
    children: runsToTextRuns(runs, { italics: opts.italics, size: opts.size }),
    alignment: opts.alignment ?? AlignmentType.LEFT,
    indent: {
      firstLine: opts.firstLine ?? INDENT,
      ...(opts.indentLeft ? { left: opts.indentLeft } : {}),
    },
    spacing: {
      line: LINE,
      before: opts.spacingBefore ?? 0,
      after: opts.spacingAfter ?? 0,
    },
  });
}

function imageParagraph(src: string, alt: string, images: ImageMap): Paragraph[] {
  const image = images.get(src);
  if (!image || image.ext === "svg" || image.ext === "webp") {
    return [
      new Paragraph({
        children: [new TextRun({ text: alt ? `[Image: ${alt}]` : "[Image]", italics: true, font: FONT, size: 20 })],
        alignment: AlignmentType.CENTER,
        spacing: { line: LINE, before: 120, after: 120 },
      }),
    ];
  }
  const maxWidth = 5.5 * 96;
  const naturalWidth = image.width ?? maxWidth;
  const naturalHeight = image.height ?? Math.round(maxWidth * 0.66);
  const scale = Math.min(1, maxWidth / naturalWidth);
  return [
    new Paragraph({
      children: [
        new ImageRun({
          type: image.ext,
          data: image.bytes,
          transformation: { width: Math.round(naturalWidth * scale), height: Math.round(naturalHeight * scale) },
          altText: { title: alt || "Illustration", description: alt || "", name: alt || "image" },
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { line: LINE, before: 120, after: 60 },
    }),
    ...(alt
      ? [
          new Paragraph({
            children: [new TextRun({ text: alt, italics: true, size: 18, font: FONT })],
            alignment: AlignmentType.CENTER,
            spacing: { line: LINE, after: 120 },
          }),
        ]
      : []),
  ];
}

function tableElement(block: Extract<Block, { kind: "table" }>): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: block.rows.map(
      (row) =>
        new TableRow({
          children: row.cells.map(
            (cell) =>
              new TableCell({
                children: [
                  new Paragraph({
                    children: runsToTextRuns(cell, { size: 20 }),
                    spacing: { line: 360, before: 60, after: 60 },
                  }),
                ],
              }),
          ),
        }),
    ),
  });
}

function blocksToDocx(blocks: Block[], images: ImageMap, firstParagraphUnindented = true): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  let sawBody = false;
  for (const block of blocks) {
    switch (block.kind) {
      case "paragraph": {
        if (!block.runs.length) {
          out.push(new Paragraph({ children: [], spacing: { line: LINE } }));
          break;
        }
        const first = !sawBody && firstParagraphUnindented;
        sawBody = true;
        out.push(
          paragraphFromRuns(block.runs, {
            firstLine: first ? 0 : INDENT,
            italics: block.quote,
            indentLeft: block.quote ? convertInchesToTwip(0.4) : undefined,
            spacingBefore: block.quote ? 120 : 0,
            spacingAfter: block.quote ? 120 : 0,
          }),
        );
        break;
      }
      case "heading": {
        const size = block.level === 2 ? 26 : block.level === 3 ? 24 : 24;
        out.push(
          new Paragraph({
            children: runsToTextRuns(block.runs, { size }).map((r) => r),
            alignment: AlignmentType.LEFT,
            spacing: { line: LINE, before: 240, after: 120 },
            keepNext: true,
          }),
        );
        break;
      }
      case "list": {
        block.items.forEach((item, i) => {
          const prefix = block.ordered ? `${i + 1}. ` : "\u2022 ";
          out.push(
            paragraphFromRuns([{ text: prefix, style: {} }, ...item], {
              firstLine: 0,
              indentLeft: convertInchesToTwip(0.35),
            }),
          );
        });
        break;
      }
      case "code": {
        out.push(
          new Paragraph({
            children: block.text.split("\n").flatMap((line, i) => [
              new TextRun({ text: line, font: "Courier New", size: 20 }),
              ...(i < block.text.split("\n").length - 1 ? [new TextRun({ break: 1 })] : []),
            ]),
            spacing: { line: 260, before: 120, after: 120 },
            indent: { left: convertInchesToTwip(0.4) },
          }),
        );
        break;
      }
      case "hr": {
        out.push(
          new Paragraph({
            children: [new TextRun({ text: "\u00b7 \u00b7 \u00b7", font: FONT, size: 24 })],
            alignment: AlignmentType.CENTER,
            spacing: { line: LINE, before: 120, after: 120 },
          }),
        );
        break;
      }
      case "image": {
        out.push(...imageParagraph(block.src, block.caption || block.alt, images));
        break;
      }
      case "table": {
        out.push(tableElement(block));
        out.push(new Paragraph({ children: [], spacing: { line: LINE } }));
        break;
      }
    }
  }
  return out;
}

/**
 * Industry-standard manuscript: 1 inch margins, 12 pt Times New Roman, double
 * spaced, chapter titles bold and centred on a new page, title page up front.
 */
export async function generateDocx(doc: ExportDocument, images: ImageMap): Promise<Uint8Array> {
  const children: (Paragraph | Table)[] = [];

  const titlePage: Paragraph[] = [
    new Paragraph({
      children: [new TextRun({ text: doc.title, bold: true, font: FONT, size: 36 })],
      alignment: AlignmentType.CENTER,
      spacing: { before: convertInchesToTwip(3.2), after: 200 },
    }),
  ];
  if (doc.subtitle) {
    titlePage.push(
      new Paragraph({
        children: [new TextRun({ text: doc.subtitle, italics: true, font: FONT, size: 28 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 600 },
      }),
    );
  }
  if (doc.author) {
    titlePage.push(
      new Paragraph({
        children: [new TextRun({ text: `by ${doc.author}`, font: FONT, size: 26 })],
        alignment: AlignmentType.CENTER,
        spacing: { before: convertInchesToTwip(1.6) },
      }),
    );
  }
  titlePage.push(
    new Paragraph({
      children: [new TextRun({ text: `${doc.wordCount.toLocaleString("en-US")} words`, font: FONT, size: 20 })],
      alignment: AlignmentType.CENTER,
      spacing: { before: convertInchesToTwip(2.4) },
    }),
  );

  if (doc.options.includeCover && doc.coverUrl) {
    const cover = images.get(doc.coverUrl);
    if (cover && cover.ext !== "svg" && cover.ext !== "webp") {
      const scale = Math.min(1, (4 * 96) / (cover.width ?? 400));
      titlePage.push(
        new Paragraph({
          children: [
            new ImageRun({
              type: cover.ext,
              data: cover.bytes,
              transformation: {
                width: Math.round((cover.width ?? 400) * scale),
                height: Math.round((cover.height ?? 600) * scale),
              },
              altText: { title: "Cover", description: doc.title, name: "cover" },
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { before: 600 },
        }),
      );
    }
  }
  titlePage.push(new Paragraph({ children: [], pageBreakBefore: true }));
  children.push(...titlePage);

  if (doc.options.includeToc && doc.scope === "project" && doc.chapters.length > 1) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: "Contents", bold: true, font: FONT, size: 28 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
      }),
    );
    doc.chapters.forEach((chapter, i) => {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${i + 1}. ${chapter.title}`, font: FONT, size: BODY_SIZE }),
          ],
          spacing: { line: 360, after: 60 },
          indent: { left: convertInchesToTwip(1) },
        }),
      );
    });
    children.push(new Paragraph({ children: [], pageBreakBefore: true }));
  }

  doc.chapters.forEach((chapter) => {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: chapter.title, bold: true, font: FONT, size: 30 })],
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 240 },
        pageBreakBefore: true,
        keepNext: true,
      }),
    );
    if (chapter.synopsis) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: chapter.synopsis, italics: true, font: FONT, size: 22 })],
          alignment: AlignmentType.CENTER,
          spacing: { line: 360, after: 360 },
        }),
      );
    }
    const blocks = htmlToBlocks(chapter.html);
    if (!blocks.length) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: "(This chapter is empty.)", italics: true, font: FONT, size: BODY_SIZE })],
          spacing: { line: LINE },
        }),
      );
    } else {
      children.push(...blocksToDocx(blocks, images));
    }
    children.push(new Paragraph({ children: [], spacing: { line: LINE } }));
  });

  const headerText = doc.author ? `${doc.author} / ${doc.title}` : doc.title;

  const document = new Document({
    creator: "Inkwell Studio",
    title: doc.title,
    description: doc.description ?? undefined,
    subject: doc.genre ?? undefined,
    styles: {
      default: {
        document: {
          run: { font: FONT, size: BODY_SIZE },
          paragraph: { spacing: { line: LINE } },
        },
      },
    },
    sections: [
      {
        properties: {
          titlePage: true,
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
            },
          },
        },
        headers: {
          first: new Header({ children: [new Paragraph({ children: [] })] }),
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: `${headerText}  ·  `,
                    font: FONT,
                    size: 18,
                    color: "666666",
                  }),
                  new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18, color: "666666" }),
                ],
              }),
            ],
          }),
        },
        footers: {
          first: new Footer({ children: [new Paragraph({ children: [] })] }),
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: "Prepared with Inkwell Studio",
                    font: FONT,
                    size: 16,
                    color: "999999",
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(document);
  return new Uint8Array(buffer);
}
