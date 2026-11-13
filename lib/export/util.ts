const WORDS = [
  "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen", "Twenty",
];

export function numberWord(n: number): string {
  if (n >= 1 && n <= WORDS.length) return WORDS[n - 1];
  return String(n);
}

/** ISO-8601 UTC timestamp without milliseconds — the only form EPUB 3 accepts for dcterms:modified. */
export function epubTimestamp(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** Remove characters that are illegal in XML 1.0. */
export function xmlSafe(input: string): string {
  return input.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, "");
}

const CP1252_EXTRA = new Set(
  [
    0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160,
    0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
    0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
  ],
);

const CHAR_MAP: Record<string, string> = {
  "\u00a0": " ",
  "\u2002": " ",
  "\u2003": " ",
  "\u2009": " ",
  "\u202f": " ",
  "\u200b": "",
  "\u200c": "",
  "\u200d": "",
  "\u2026": "\u2026",
  "\u2212": "-",
  "\u2010": "-",
  "\u2011": "-",
  "\u2044": "/",
  "\u2032": "'",
  "\u2033": '"',
  "\u2192": "->",
  "\u2190": "<-",
  "\u2264": "<=",
  "\u2265": ">=",
  "\u2260": "!=",
  "\u00ad": "",
};

/**
 * The standard 14 PDF fonts use WinAnsi (CP1252) encoding. Anything outside that
 * range makes pdf-lib throw, so map common typography and replace the rest.
 */
export function sanitizeForPdf(input: string): string {
  if (!input) return "";
  let out = "";
  for (const ch of input) {
    const mapped = CHAR_MAP[ch];
    if (mapped !== undefined) {
      out += mapped;
      continue;
    }
    const code = ch.codePointAt(0) ?? 0;
    if (ch === "\n" || ch === "\t") {
      out += " ";
      continue;
    }
    if (code === 0x0d) continue;
    if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || CP1252_EXTRA.has(code)) {
      out += ch;
    } else if (code === 0x09) {
      out += " ";
    } else {
      out += "?";
    }
  }
  return out.replace(/ {2,}/g, " ").trim();
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/**
 * A small-caps opener label ("Chapter Two") — omitted when the author already
 * encoded the structural word in the chapter title.
 */
export function openerLabel(title: string, index: number): string {
  if (/^\s*(chapter|part|prologue|epilogue|interlude|appendix|introduction|foreword)\b/i.test(title)) return "";
  return /^\s*part\b/i.test(title) ? `Part ${numberWord(index + 1)}` : `Chapter ${numberWord(index + 1)}`;
}

/** Split text into words while keeping punctuation attached — used by the PDF wrapper. */
export function wordsOf(text: string): string[] {
  return text.split(/(\s+)/).filter((part) => part.length > 0);
}
