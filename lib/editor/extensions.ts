import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import TextAlign from "@tiptap/extension-text-align";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import CharacterCount from "@tiptap/extension-character-count";

export interface BaseExtensionOptions {
  /**
   * Collaboration (Yjs) supplies its own undo manager, so the ProseMirror
   * history plugin in StarterKit must be disabled to avoid competing stacks.
   */
  collab?: boolean;
}

/**
 * Extensions shared by the client editor and the server HTML renderer.
 * `horizontalRule` is intentionally enabled: dividers live in TipTap JSON and
 * in the markdown mirror (`markdownToTiptap` emits them), so the renderer has
 * to understand them too.
 */
export function createBaseExtensions(options: BaseExtensionOptions = {}) {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3, 4] },
      codeBlock: { HTMLAttributes: { class: "code-block" } },
      ...(options.collab ? { history: false } : {}),
    }),
    Underline,
    Highlight,
    Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: "noopener noreferrer" } }),
    Image.configure({ inline: false, allowBase64: true }),
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    CharacterCount,
  ];
}

/** Singleton instance used by the server-side HTML renderer (`lib/markdown`). */
export const baseExtensions = createBaseExtensions();

export function buildExtensions(options?: { placeholder?: string; collab?: boolean }) {
  return [
    ...createBaseExtensions({ collab: options?.collab }),
    Placeholder.configure({ placeholder: options?.placeholder ?? "Start writing…" }),
  ];
}
