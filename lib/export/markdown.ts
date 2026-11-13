import type { ExportDocument } from "./types";

function yamlString(value: string): string {
  return JSON.stringify(value.replace(/\r/g, ""));
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}


/**
 * Markdown export: YAML front matter + one `# Title` per chapter, chapters
 * separated by horizontal rules. Chapter-scoped exports skip the project TOC.
 */
export function generateMarkdown(doc: ExportDocument): Uint8Array {
  const lines: string[] = ["---"];
  lines.push(`title: ${yamlString(doc.title)}`);
  if (doc.subtitle) lines.push(`subtitle: ${yamlString(doc.subtitle)}`);
  if (doc.author) lines.push(`author: ${yamlString(doc.author)}`);
  if (doc.genre) lines.push(`genre: ${yamlString(doc.genre)}`);
  if (doc.description) lines.push(`description: ${yamlString(doc.description)}`);
  lines.push(`language: ${yamlString(doc.language)}`);
  lines.push(`identifier: ${yamlString(doc.identifier)}`);
  lines.push(`date: ${dateOnly(doc.createdAt)}`);
  lines.push(`generator: "Inkwell Studio"`);
  lines.push(`words: ${doc.wordCount}`);
  lines.push("---", "");

  if (doc.scope === "project") {
    lines.push(`# ${doc.title}`, "");
    if (doc.subtitle) lines.push(`*${doc.subtitle}*`, "");
    if (doc.author) lines.push(`**${doc.author}**`, "");
    if (doc.description) lines.push(doc.description, "");

    if (doc.options.includeToc && doc.chapters.length > 1) {
      lines.push("## Contents", "");
      doc.chapters.forEach((chapter, i) => {
        lines.push(`${i + 1}. ${chapter.title}`);
      });
      lines.push("");
    }
    lines.push("---", "");
  }

  doc.chapters.forEach((chapter, i) => {
    const isLast = i === doc.chapters.length - 1;
    lines.push(`# ${chapter.title}`, "");
    if (chapter.synopsis) {
      lines.push(`> *${chapter.synopsis.trim()}*`, "");
    }
    if (chapter.markdown.trim()) {
      lines.push(chapter.markdown.trim(), "");
    } else {
      lines.push("*(This chapter is empty.)*", "");
    }
    if (!isLast) lines.push("---", "");
  });

  return new TextEncoder().encode(lines.join("\n").trimEnd() + "\n");
}
