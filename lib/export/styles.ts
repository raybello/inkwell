import type { StyleName } from "./types";

/**
 * Style templates are shared by the HTML, PDF, EPUB and DOCX generators.
 * They intentionally contain no Tailwind: exported artefacts must stand alone.
 */
export interface StyleTemplate {
  id: StyleName;
  name: string;
  blurb: string;
  /** CSS font stacks. Every template uses a serif body face (the product's editorial promise). */
  bodyFont: string;
  headingFont: string;
  labelFont: string;
  bodySizePt: number;
  screenBodySizePt: number;
  lineHeight: number;
  measureRem: number;
  colors: {
    ink: string;
    muted: string;
    accent: string;
    rule: string;
    paper: string;
    paperEdge: string;
    coverInk: string;
  };
  heading: {
    /** h1 (chapter title) size in pt for print. */
    h1: number;
    h2: number;
    h3: number;
    h4: number;
    weight: 400 | 500 | 600 | 700;
    transform: "none" | "uppercase";
    letterSpacing: number;
    align: "left" | "center";
    italic: boolean;
  };
  paragraph: {
    /** First-line indent in pt; 0 disables indents. */
    firstLineIndent: number;
    /** Space between paragraphs in pt (0 when indenting). */
    spacing: number;
    justify: boolean;
  };
  dropCap: boolean;
  /** Decorative rule above chapter titles. */
  chapterRule: "ornament" | "line" | "none";
  /** PDF: use sans headings? */
  sansHeadings: boolean;
  /** Print chapter opener: small uppercase label above the title. */
  openerLabel: boolean;
}

export const STYLE_TEMPLATES: Record<StyleName, StyleTemplate> = {
  literary: {
    id: "literary",
    name: "Literary",
    blurb: "Garamond-setting warmth: justified serif text, indented paragraphs, a drop cap.",
    bodyFont: '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif',
    headingFont: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
    labelFont: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    bodySizePt: 11.5,
    screenBodySizePt: 19,
    lineHeight: 1.62,
    measureRem: 32,
    colors: {
      ink: "#241f1a",
      muted: "#7a6b5b",
      accent: "#8a4b2a",
      rule: "#c9b8a2",
      paper: "#f7f2e8",
      paperEdge: "#e6dccb",
      coverInk: "#2b241d",
    },
    heading: {
      h1: 26,
      h2: 16,
      h3: 13,
      h4: 11.5,
      weight: 400,
      transform: "none",
      letterSpacing: 0,
      align: "center",
      italic: false,
    },
    paragraph: { firstLineIndent: 20, spacing: 0, justify: true },
    dropCap: true,
    chapterRule: "ornament",
    sansHeadings: false,
    openerLabel: true,
  },
  modern: {
    id: "modern",
    name: "Modern",
    blurb: "Crisp sans headings over generous serif text. Left-aligned, airy, no indents.",
    bodyFont: 'Georgia, "Iowan Old Style", "Times New Roman", serif',
    headingFont: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    labelFont: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    bodySizePt: 11,
    screenBodySizePt: 18,
    lineHeight: 1.7,
    measureRem: 34,
    colors: {
      ink: "#1c1c1e",
      muted: "#6b6b70",
      accent: "#b5622f",
      rule: "#ddd6cc",
      paper: "#fbfaf7",
      paperEdge: "#e8e4dc",
      coverInk: "#161616",
    },
    heading: {
      h1: 24,
      h2: 14,
      h3: 12,
      h4: 11,
      weight: 600,
      transform: "none",
      letterSpacing: 0.2,
      align: "left",
      italic: false,
    },
    paragraph: { firstLineIndent: 0, spacing: 10, justify: false },
    dropCap: false,
    chapterRule: "line",
    sansHeadings: true,
    openerLabel: true,
  },
  minimal: {
    id: "minimal",
    name: "Minimal",
    blurb: "Quiet typography: small-caps labels, tight measure, hairline rules, no decoration.",
    bodyFont: '"Iowan Old Style", "Palatino Linotype", Georgia, serif',
    headingFont: '"Iowan Old Style", "Palatino Linotype", Georgia, serif',
    labelFont: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    bodySizePt: 11,
    screenBodySizePt: 18,
    lineHeight: 1.58,
    measureRem: 30,
    colors: {
      ink: "#22201d",
      muted: "#8b8378",
      accent: "#22201d",
      rule: "#d8d2c8",
      paper: "#fdfcf9",
      paperEdge: "#e9e5dd",
      coverInk: "#1f1d1a",
    },
    heading: {
      h1: 21,
      h2: 13,
      h3: 11.5,
      h4: 11,
      weight: 500,
      transform: "uppercase",
      letterSpacing: 1.6,
      align: "left",
      italic: false,
    },
    paragraph: { firstLineIndent: 0, spacing: 9, justify: false },
    dropCap: false,
    chapterRule: "none",
    sansHeadings: false,
    openerLabel: false,
  },
};

export function resolveStyle(name: StyleName | string | null | undefined): StyleTemplate {
  if (name === "modern" || name === "minimal" || name === "literary") return STYLE_TEMPLATES[name];
  return STYLE_TEMPLATES.literary;
}

/** CSS custom properties + base rules for a standalone document / EPUB stylesheet. */
export function styleCss(style: StyleTemplate, opts?: { epub?: boolean; dropCaps?: boolean }): string {
  const s = style;
  const pageBg = opts?.epub ? "#ffffff" : s.colors.paper;
  return `
:root {
  --ink: ${s.colors.ink};
  --muted: ${s.colors.muted};
  --accent: ${s.colors.accent};
  --rule: ${s.colors.rule};
  --paper: ${pageBg};
  --body-font: ${s.bodyFont};
  --heading-font: ${s.headingFont};
  --label-font: ${s.labelFont};
  --body-size: ${opts?.epub ? 1 : s.screenBodySizePt / 16}${opts?.epub ? "em" : "rem"};
  --line-height: ${s.lineHeight};
  --measure: ${s.measureRem}rem;
}
html { color-scheme: light; }
body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  font-family: var(--body-font);
  font-size: var(--body-size);
  line-height: var(--line-height);
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
.ink-page { max-width: var(--measure); margin: 0 auto; padding: 0 1.25rem; }
p { margin: 0 0 ${s.paragraph.spacing ? s.paragraph.spacing / 16 : 0}rem; text-align: ${s.paragraph.justify ? "justify" : "left"}; ${s.paragraph.justify ? "hyphens: auto;" : ""} }
${s.paragraph.firstLineIndent ? `p + p { text-indent: ${s.paragraph.firstLineIndent / 16}rem; margin-top: 0; }` : ""}
.ink-chapter p:first-of-type { text-indent: 0; }
h1, h2, h3, h4 { font-family: var(--heading-font); font-weight: ${s.heading.weight}; line-height: 1.2; break-after: avoid; page-break-after: avoid; color: var(--ink); }
h2 { font-size: ${s.heading.h2 / (s.bodySizePt || 11)}em; margin: 1.8em 0 0.5em; }
h3 { font-size: ${s.heading.h3 / (s.bodySizePt || 11)}em; margin: 1.5em 0 0.4em; }
h4 { font-size: ${s.heading.h4 / (s.bodySizePt || 11)}em; margin: 1.3em 0 0.3em; letter-spacing: 0.04em; }
blockquote { margin: 1.2em 0 1.2em 0; padding-left: 1.1em; border-left: 2px solid var(--rule); color: var(--muted); font-style: italic; }
blockquote p { text-indent: 0; text-align: left; }
hr { border: 0; text-align: center; margin: 2em 0; }
hr::after { content: "· · ·"; letter-spacing: 0.6em; color: var(--muted); }
a { color: var(--accent); text-decoration-thickness: 0.06em; text-underline-offset: 0.18em; }
img { max-width: 100%; height: auto; }
figure { margin: 1.5em 0; }
ul, ol { padding-left: 1.4em; margin: 0 0 1rem; }
li { margin-bottom: 0.35em; }
code, pre { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 0.88em; background: rgba(0,0,0,0.045); border-radius: 4px; }
code { padding: 0.1em 0.3em; }
pre { padding: 0.8em 1em; overflow-x: auto; line-height: 1.5; }
pre code { background: none; padding: 0; }
table { width: 100%; border-collapse: collapse; margin: 1.4em 0; font-size: 0.92em; }
th, td { border-bottom: 1px solid var(--rule); padding: 0.45em 0.6em; text-align: left; vertical-align: top; }
th { font-family: var(--label-font); font-size: 0.78em; letter-spacing: 0.08em; text-transform: uppercase; }
mark { background: ${s.colors.accent}22; color: inherit; }
figcaption { font-family: var(--label-font); font-size: 0.78em; color: var(--muted); text-align: center; margin-top: 0.5em; }

/* chapter opener */
.ink-chapter { margin: 0 0 4rem; }
.ink-opener { margin: 0 0 2.2rem; padding-top: 0.4rem; }
.ink-opener .label { display: block; font-family: var(--label-font); font-size: 0.66em; letter-spacing: 0.24em; text-transform: uppercase; color: var(--muted); margin-bottom: 0.9em; ${s.heading.align === "center" ? "text-align: center;" : ""} }
.ink-opener h1 { font-size: ${Math.min(2.1, s.heading.h1 / (s.bodySizePt || 11))}em; letter-spacing: ${s.heading.letterSpacing / 100}em; ${s.heading.transform === "uppercase" ? "text-transform: uppercase;" : ""} ${s.heading.italic ? "font-style: italic;" : ""} margin: 0 0 0.5rem; text-align: ${s.heading.align}; }
.ink-opener .rule { display: block; width: 3.5rem; height: 1px; background: var(--rule); margin: 1.1rem ${s.heading.align === "center" ? "auto" : "0"}; border: 0; }
.ink-opener .rule.ornament { width: auto; height: auto; background: none; font-family: var(--heading-font); color: var(--muted); letter-spacing: 0.5em; text-align: center; font-size: 0.82em; }
.ink-opener .rule.ornament::before { content: "· · ·"; letter-spacing: 0.15em; }
.ink-synopsis { font-family: var(--body-font); font-style: italic; color: var(--muted); text-align: ${s.heading.align}; max-width: 26rem; margin: 0.9rem auto 0; font-size: 0.92em; line-height: 1.55; }
${(opts?.dropCaps ?? s.dropCap) ? `.ink-chapter > p:first-of-type::first-letter, .ink-chapter .ink-body > p:first-of-type::first-letter { float: left; font-family: var(--heading-font); font-size: 3.3em; line-height: 0.82; padding: 0.08em 0.12em 0 0; color: var(--accent); }` : ""}
.ink-toc { margin: 0 auto; }
.ink-toc h2 { font-family: var(--label-font); font-size: 0.7em; letter-spacing: 0.24em; text-transform: uppercase; color: var(--muted); margin: 0 0 1.4rem; }
.ink-toc ol { list-style: none; padding: 0; margin: 0; }
.ink-toc li { display: flex; align-items: baseline; gap: 0.6rem; padding: 0.5rem 0; border-bottom: 1px solid ${s.colors.rule}66; font-family: var(--heading-font); }
.ink-toc a { color: inherit; text-decoration: none; }
.ink-toc .dots { flex: 1; border-bottom: 1px dotted var(--rule); transform: translateY(-0.2em); }
.ink-toc .pg { font-family: var(--label-font); font-size: 0.8em; color: var(--muted); }
.ink-titlepage { min-height: 70vh; display: flex; flex-direction: column; justify-content: center; text-align: center; }
.ink-titlepage p { text-align: center; text-indent: 0; margin: 0 0 0.6rem; }
.ink-titlepage .title { font-family: var(--heading-font); font-size: 2.6em; line-height: 1.1; margin: 0 0 0.6rem; }
.ink-titlepage .subtitle { font-family: var(--body-font); font-style: italic; color: var(--muted); font-size: 1.15em; margin: 0; }
.ink-titlepage .author { font-family: var(--label-font); font-size: 0.72em; letter-spacing: 0.28em; text-transform: uppercase; color: var(--muted); margin-top: 2.4rem; }
.ink-cover { margin: 0 auto 2rem; max-width: 22rem; }
.ink-cover img { width: 100%; border-radius: 2px; box-shadow: 0 18px 40px -22px rgba(0,0,0,0.55); }
@media print {
  body { background: #fff; }
  .ink-chapter { break-before: page; page-break-before: always; }
  .ink-chapter:first-of-type { break-before: auto; page-break-before: auto; }
  a { color: inherit; text-decoration: none; }
  .no-print { display: none !important; }
}
`.trim();
}

/** CSS for the EPUB stylesheet — relative units only, no flex/grid assumptions. */
export function epubCss(style: StyleTemplate, dropCaps?: boolean): string {
  return styleCss(style, { epub: true, dropCaps })
    .replace(/\.ink-titlepage \{[^}]*\}/, ".ink-titlepage { text-align: center; margin: 3em 1em; }")
    .replace(/\.ink-toc li \{[^}]*\}/, ".ink-toc li { margin: 0.5em 0; font-family: var(--heading-font); }")
    .replace(/\.ink-toc \.dots \{[^}]*\}/, "")
    .replace(/\.ink-toc \.pg \{[^}]*\}/, "")
    .replace(/box-shadow:[^;]+;/g, "");
}
