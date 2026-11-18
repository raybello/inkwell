import { describe, expect, it } from "vitest";
import {
  countWords,
  htmlToMarkdown,
  markdownToTiptap,
  plainText,
  tiptapToHtml,
  tiptapToMarkdown,
} from "@/lib/markdown";

const doc = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Chapter One" }],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "The " },
        { type: "text", text: "salt", marks: [{ type: "bold" }] },
        { type: "text", text: " road " },
        { type: "text", text: "winds", marks: [{ type: "italic" }] },
        { type: "text", text: " on." },
      ],
    },
    {
      type: "bulletList",
      content: [
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "first" }] }] },
        { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "second" }] }] },
      ],
    },
  ],
};

describe("tiptapToMarkdown", () => {
  it("serializes headings, marks and lists", () => {
    const md = tiptapToMarkdown(doc);
    expect(md).toContain("## Chapter One");
    expect(md).toContain("**salt**");
    expect(md).toContain("*winds*");
    expect(md).toContain("- first");
    expect(md).toContain("- second");
  });

  it("returns empty string for junk input instead of throwing", () => {
    expect(tiptapToMarkdown(null)).toBe("");
    expect(tiptapToMarkdown("not a doc")).toBe("");
    expect(tiptapToMarkdown({ type: "doc" })).toBe("");
  });
});

describe("markdownToTiptap", () => {
  it("parses the basic block set", () => {
    const parsed = markdownToTiptap("## Title\n\nA paragraph.\n\n- one\n- two\n");
    const types = (parsed.content ?? []).map((n) => n.type);
    expect(types).toEqual(["heading", "paragraph", "bulletList"]);
  });

  it("empty input yields the EMPTY_DOC shape", () => {
    const parsed = markdownToTiptap("   ");
    expect(parsed).toEqual({ type: "doc", content: [{ type: "paragraph" }] });
  });

  it("round-trips markdown -> tiptap -> markdown without losing text", () => {
    const md = "## Heading\n\nSome **bold** and *italic* text.\n\n- alpha\n- beta\n";
    const again = tiptapToMarkdown(markdownToTiptap(md));
    expect(again).toContain("## Heading");
    expect(again).toContain("**bold**");
    expect(again).toContain("*italic*");
    expect(again).toContain("- alpha");
    expect(again).toContain("- beta");
  });
});

describe("htmlToMarkdown", () => {
  it("strips script/style and maps common tags", () => {
    const md = htmlToMarkdown(
      '<script>alert(1)</script><h2>Head</h2><p>Text with <strong>bold</strong> and <a href="https://x.co">a link</a>.</p><ul><li>item</li></ul>',
    );
    expect(md).not.toContain("alert");
    expect(md).toContain("## Head");
    expect(md).toContain("**bold**");
    expect(md).toContain("[a link](https://x.co)");
    expect(md).toContain("- item");
  });

  it("unescapes entities", () => {
    expect(htmlToMarkdown("<p>Tom &amp; &lt;b&gt;Jerry&quot;</p>")).toBe("Tom & <b>Jerry\"");
  });
});

describe("plainText / countWords", () => {
  it("plainText drops structure", () => {
    expect(plainText(doc)).toContain("The salt road winds on.");
    expect(plainText(null)).toBe("");
  });

  it("countWords matches the mirror's word counting", () => {
    expect(countWords("one two  three")).toBe(3);
    expect(countWords("")).toBe(0);
  });
});

describe("tiptapToHtml", () => {
  it("renders through the shared extension set", () => {
    const html = tiptapToHtml(doc);
    expect(html).toContain("<h2>Chapter One</h2>");
    expect(html).toContain("<strong>salt</strong>");
  });
});
