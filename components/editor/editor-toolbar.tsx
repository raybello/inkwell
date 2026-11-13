"use client";

import * as React from "react";
import type { Editor } from "@tiptap/react";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Code,
  Code2,
  Columns3,
  Highlighter,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Maximize2,
  MessageSquare,
  Minus,
  MoreHorizontal,
  Quote,
  Redo2,
  Rows3,
  Search,
  Strikethrough,
  Table2,
  Type,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";
import { Dropdown, DropdownItem, DropdownLabel, DropdownSeparator } from "@/components/ui/dropdown";
import { Tooltip } from "@/components/ui/misc";
import { cn, formatNumber } from "@/lib/utils";
import { useEditorTick } from "./use-editor-tick";

function ToolButton({
  label,
  shortcut,
  active,
  disabled,
  onClick,
  children,
  className,
}: {
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Tooltip label={shortcut ? `${label}  ${shortcut}` : label}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={active || undefined}
        disabled={disabled}
        onMouseDown={(event) => event.preventDefault()}
        onClick={onClick}
        className={cn(
          "inline-flex size-7 items-center justify-center rounded-[5px] text-muted-strong transition",
          "hover:bg-ink-750 hover:text-foreground disabled:opacity-35 disabled:hover:bg-transparent",
          active && "bg-ink-750 text-accent-soft",
          className,
        )}
      >
        {children}
      </button>
    </Tooltip>
  );
}

function Divider({ className }: { className?: string }) {
  return <span className={cn("mx-0.5 h-4 w-px shrink-0 bg-border", className)} aria-hidden />;
}

const BLOCK_OPTIONS = [
  { id: "paragraph", label: "Paragraph" },
  { id: "h1", label: "Heading 1" },
  { id: "h2", label: "Heading 2" },
  { id: "h3", label: "Heading 3" },
  { id: "h4", label: "Heading 4" },
  { id: "quote", label: "Quote" },
  { id: "code", label: "Code block" },
] as const;

type BlockId = (typeof BLOCK_OPTIONS)[number]["id"];

function currentBlock(editor: Editor | null): BlockId {
  if (!editor) return "paragraph";
  for (const level of [1, 2, 3, 4] as const) {
    if (editor.isActive("heading", { level })) return `h${level}` as BlockId;
  }
  if (editor.isActive("blockquote")) return "quote";
  if (editor.isActive("codeBlock")) return "code";
  return "paragraph";
}

function setBlock(editor: Editor, id: BlockId) {
  const chain = editor.chain().focus();
  if (id === "paragraph") chain.setParagraph().run();
  else if (id === "quote") chain.toggleBlockquote().run();
  else if (id === "code") chain.toggleCodeBlock().run();
  else chain.setHeading({ level: Number(id.slice(1)) as 1 | 2 | 3 | 4 }).run();
}

export function EditorToolbar({
  editor,
  canEdit,
  wordCount,
  onOpenFind,
  onOpenImage,
  onOpenLink,
  onComment,
  onToggleFocus,
  focused,
  typewriter,
  onToggleTypewriter,
  className,
}: {
  editor: Editor | null;
  canEdit: boolean;
  wordCount: number;
  onOpenFind: () => void;
  onOpenImage: () => void;
  onOpenLink: () => void;
  onComment?: () => void;
  onToggleFocus: () => void;
  focused: boolean;
  typewriter: boolean;
  onToggleTypewriter: () => void;
  className?: string;
}) {
  useEditorTick(editor);
  const block = currentBlock(editor);
  const blockLabel = BLOCK_OPTIONS.find((option) => option.id === block)?.label ?? "Paragraph";
  const inTable = !!editor?.isActive("table");
  const isLink = !!editor?.isActive("link");

  const run = (fn: (chain: ReturnType<Editor["chain"]>) => { run: () => boolean }) => {
    if (!editor || !canEdit) return;
    fn(editor.chain().focus()).run();
  };

  return (
    <div
      className={cn(
        "flex h-11 shrink-0 items-center gap-0.5 border-b border-border bg-ink-900/80 px-2 backdrop-blur sm:px-3",
        className,
      )}
      role="toolbar"
      aria-label="Formatting"
    >
      <Dropdown
        align="start"
        trigger={
          <button
            type="button"
            disabled={!canEdit}
            className="flex h-7 w-[104px] items-center justify-between gap-1 rounded-[5px] px-2 text-[12px] text-muted-strong transition hover:bg-ink-750 hover:text-foreground disabled:opacity-40 sm:w-[118px]"
            aria-label={`Block type: ${blockLabel}`}
          >
            <span className="truncate">{blockLabel}</span>
            <ChevronDown className="size-3 opacity-60" />
          </button>
        }
      >
        {(close) => (
          <>
            <DropdownLabel>Turn into</DropdownLabel>
            {BLOCK_OPTIONS.map((option) => (
              <DropdownItem
                key={option.id}
                className={cn("justify-between", option.id === block && "text-accent-soft")}
                onClick={() => {
                  if (editor) setBlock(editor, option.id);
                  close();
                }}
              >
                <span
                  className={cn(
                    option.id === "h1" && "font-serif text-base",
                    option.id === "h2" && "font-serif text-[15px]",
                    option.id === "h3" && "font-serif text-sm",
                    option.id === "h4" && "text-[11px] uppercase tracking-[0.12em]",
                  )}
                >
                  {option.label}
                </span>
              </DropdownItem>
            ))}
          </>
        )}
      </Dropdown>

      <Divider />

      <ToolButton label="Undo" shortcut="⌘Z" disabled={!canEdit || !editor?.can().undo()} onClick={() => run((c) => c.undo())}>
        <Undo2 className="size-[15px]" />
      </ToolButton>
      <ToolButton label="Redo" shortcut="⇧⌘Z" disabled={!canEdit || !editor?.can().redo()} onClick={() => run((c) => c.redo())}>
        <Redo2 className="size-[15px]" />
      </ToolButton>

      <Divider />

      <ToolButton label="Bold" shortcut="⌘B" active={editor?.isActive("bold")} disabled={!canEdit} onClick={() => run((c) => c.toggleBold())}>
        <Bold className="size-[15px]" />
      </ToolButton>
      <ToolButton label="Italic" shortcut="⌘I" active={editor?.isActive("italic")} disabled={!canEdit} onClick={() => run((c) => c.toggleItalic())}>
        <Italic className="size-[15px]" />
      </ToolButton>
      <ToolButton
        label="Underline"
        shortcut="⌘U"
        active={editor?.isActive("underline")}
        disabled={!canEdit}
        onClick={() => run((c) => c.toggleUnderline())}
        className="hidden sm:inline-flex"
      >
        <UnderlineIcon className="size-[15px]" />
      </ToolButton>
      <ToolButton
        label="Strikethrough"
        active={editor?.isActive("strike")}
        disabled={!canEdit}
        onClick={() => run((c) => c.toggleStrike())}
        className="hidden 2xl:inline-flex"
      >
        <Strikethrough className="size-[15px]" />
      </ToolButton>
      <ToolButton
        label="Inline code"
        shortcut="⌘E"
        active={editor?.isActive("code")}
        disabled={!canEdit}
        onClick={() => run((c) => c.toggleCode())}
        className="hidden 2xl:inline-flex"
      >
        <Code className="size-[15px]" />
      </ToolButton>
      <ToolButton
        label="Highlight"
        active={editor?.isActive("highlight")}
        disabled={!canEdit}
        onClick={() => run((c) => c.toggleHighlight())}
        className="hidden 2xl:inline-flex"
      >
        <Highlighter className="size-[15px]" />
      </ToolButton>

      <Divider className="hidden xl:block" />

      <div className="hidden items-center gap-0.5 xl:flex">
        <ToolButton label="Align left" active={editor?.isActive({ textAlign: "left" })} disabled={!canEdit} onClick={() => run((c) => c.setTextAlign("left"))}>
          <AlignLeft className="size-[15px]" />
        </ToolButton>
        <ToolButton label="Align centre" active={editor?.isActive({ textAlign: "center" })} disabled={!canEdit} onClick={() => run((c) => c.setTextAlign("center"))}>
          <AlignCenter className="size-[15px]" />
        </ToolButton>
        <ToolButton label="Align right" active={editor?.isActive({ textAlign: "right" })} disabled={!canEdit} onClick={() => run((c) => c.setTextAlign("right"))}>
          <AlignRight className="size-[15px]" />
        </ToolButton>
        <ToolButton label="Justify" active={editor?.isActive({ textAlign: "justify" })} disabled={!canEdit} onClick={() => run((c) => c.setTextAlign("justify"))}>
          <AlignJustify className="size-[15px]" />
        </ToolButton>
      </div>

      <Divider className="hidden xl:block" />

      <div className="hidden items-center gap-0.5 xl:flex">
        <ToolButton label="Bullet list" active={editor?.isActive("bulletList")} disabled={!canEdit} onClick={() => run((c) => c.toggleBulletList())}>
          <List className="size-[15px]" />
        </ToolButton>
        <ToolButton label="Numbered list" active={editor?.isActive("orderedList")} disabled={!canEdit} onClick={() => run((c) => c.toggleOrderedList())}>
          <ListOrdered className="size-[15px]" />
        </ToolButton>
        <ToolButton label="Task list" active={editor?.isActive("taskList")} disabled={!canEdit} onClick={() => run((c) => c.toggleTaskList())}>
          <ListChecks className="size-[15px]" />
        </ToolButton>
      </div>

      <Divider className="hidden xl:block" />

      <ToolButton label="Link" shortcut="⌘K" active={isLink} disabled={!canEdit} onClick={onOpenLink} className="hidden sm:inline-flex">
        <Link2 className="size-[15px]" />
      </ToolButton>
      <ToolButton label="Insert image" disabled={!canEdit} onClick={onOpenImage} className="hidden sm:inline-flex">
        <ImageIcon className="size-[15px]" />
      </ToolButton>

      <div className="hidden xl:block">
        <Dropdown
          align="start"
          trigger={
            <button
              type="button"
              disabled={!canEdit}
              className={cn(
                "inline-flex size-7 items-center justify-center rounded-[5px] text-muted-strong transition hover:bg-ink-750 hover:text-foreground disabled:opacity-35",
                inTable && "bg-ink-750 text-accent-soft",
              )}
              aria-label="Table options"
            >
              <Table2 className="size-[15px]" />
            </button>
          }
        >
          {(close) => (
            <>
              <DropdownLabel>Table</DropdownLabel>
              <DropdownItem
                icon={<Table2 />}
                onClick={() => {
                  run((c) => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true }));
                  close();
                }}
              >
                Insert 3 × 3 table
              </DropdownItem>
              <DropdownSeparator />
              <DropdownItem icon={<Rows3 />} disabled={!inTable} onClick={() => { run((c) => c.addRowBefore()); close(); }}>
                Row above
              </DropdownItem>
              <DropdownItem icon={<Rows3 />} disabled={!inTable} onClick={() => { run((c) => c.addRowAfter()); close(); }}>
                Row below
              </DropdownItem>
              <DropdownItem icon={<Rows3 />} disabled={!inTable} onClick={() => { run((c) => c.deleteRow()); close(); }}>
                Delete row
              </DropdownItem>
              <DropdownSeparator />
              <DropdownItem icon={<Columns3 />} disabled={!inTable} onClick={() => { run((c) => c.addColumnBefore()); close(); }}>
                Column left
              </DropdownItem>
              <DropdownItem icon={<Columns3 />} disabled={!inTable} onClick={() => { run((c) => c.addColumnAfter()); close(); }}>
                Column right
              </DropdownItem>
              <DropdownItem icon={<Columns3 />} disabled={!inTable} onClick={() => { run((c) => c.deleteColumn()); close(); }}>
                Delete column
              </DropdownItem>
              <DropdownSeparator />
              <DropdownItem disabled={!inTable} onClick={() => { run((c) => c.toggleHeaderRow()); close(); }}>
                Toggle header row
              </DropdownItem>
              <DropdownItem danger disabled={!inTable} onClick={() => { run((c) => c.deleteTable()); close(); }}>
                Delete table
              </DropdownItem>
            </>
          )}
        </Dropdown>
      </div>

      <ToolButton label="Divider" disabled={!canEdit} onClick={() => run((c) => c.setHorizontalRule())} className="hidden 2xl:inline-flex">
        <Minus className="size-[15px]" />
      </ToolButton>

      <span className="ml-auto" />

      <span className="hidden select-none px-1 font-mono text-[10.5px] text-muted sm:inline" aria-hidden>
        {formatNumber(wordCount)} w
      </span>

      <ToolButton label="Find and replace" shortcut="⌘F" onClick={onOpenFind}>
        <Search className="size-[15px]" />
      </ToolButton>

      {onComment && (
        <ToolButton label="Comment on selection" shortcut="⌘⇧M" onClick={onComment}>
          <MessageSquare className="size-[15px]" />
        </ToolButton>
      )}

      <div className="xl:hidden">
        <Dropdown
          align="end"
          trigger={
            <button
              type="button"
              className="inline-flex size-7 items-center justify-center rounded-[5px] text-muted-strong transition hover:bg-ink-750 hover:text-foreground"
              aria-label="More formatting"
            >
              <MoreHorizontal className="size-[15px]" />
            </button>
          }
        >
          {(close) => (
            <>
              <DropdownLabel>Format</DropdownLabel>
              <DropdownItem icon={<UnderlineIcon />} onClick={() => { run((c) => c.toggleUnderline()); close(); }}>
                Underline
              </DropdownItem>
              <DropdownItem icon={<Strikethrough />} onClick={() => { run((c) => c.toggleStrike()); close(); }}>
                Strikethrough
              </DropdownItem>
              <DropdownItem icon={<Code />} onClick={() => { run((c) => c.toggleCode()); close(); }}>
                Inline code
              </DropdownItem>
              <DropdownItem icon={<Highlighter />} onClick={() => { run((c) => c.toggleHighlight()); close(); }}>
                Highlight
              </DropdownItem>
              <DropdownItem icon={<Quote />} onClick={() => { run((c) => c.toggleBlockquote()); close(); }}>
                Quote
              </DropdownItem>
              <DropdownItem icon={<Code2 />} onClick={() => { run((c) => c.toggleCodeBlock()); close(); }}>
                Code block
              </DropdownItem>
              <DropdownSeparator />
              <DropdownLabel>Insert</DropdownLabel>
              <DropdownItem icon={<Link2 />} onClick={() => { close(); onOpenLink(); }}>
                Link
              </DropdownItem>
              <DropdownItem icon={<ImageIcon />} onClick={() => { close(); onOpenImage(); }}>
                Image
              </DropdownItem>
              <DropdownItem icon={<Table2 />} onClick={() => { run((c) => c.insertTable({ rows: 3, cols: 3, withHeaderRow: true })); close(); }}>
                Table
              </DropdownItem>
              <DropdownItem icon={<Minus />} onClick={() => { run((c) => c.setHorizontalRule()); close(); }}>
                Divider
              </DropdownItem>
              {inTable && (
                <>
                  <DropdownItem icon={<Rows3 />} onClick={() => { run((c) => c.addRowAfter()); close(); }}>
                    Add row
                  </DropdownItem>
                  <DropdownItem icon={<Columns3 />} onClick={() => { run((c) => c.addColumnAfter()); close(); }}>
                    Add column
                  </DropdownItem>
                  <DropdownItem icon={<Rows3 />} onClick={() => { run((c) => c.deleteRow()); close(); }}>
                    Delete row
                  </DropdownItem>
                  <DropdownItem icon={<Columns3 />} onClick={() => { run((c) => c.deleteColumn()); close(); }}>
                    Delete column
                  </DropdownItem>
                  <DropdownItem danger onClick={() => { run((c) => c.deleteTable()); close(); }}>
                    Delete table
                  </DropdownItem>
                </>
              )}
              <DropdownItem icon={<ListChecks />} onClick={() => { run((c) => c.toggleTaskList()); close(); }}>
                Task list
              </DropdownItem>
              <DropdownItem icon={<List />} onClick={() => { run((c) => c.toggleBulletList()); close(); }}>
                Bullet list
              </DropdownItem>
              <DropdownItem icon={<ListOrdered />} onClick={() => { run((c) => c.toggleOrderedList()); close(); }}>
                Numbered list
              </DropdownItem>
              <DropdownSeparator />
              <DropdownLabel>Align</DropdownLabel>
              <DropdownItem icon={<AlignLeft />} onClick={() => { run((c) => c.setTextAlign("left")); close(); }}>
                Left
              </DropdownItem>
              <DropdownItem icon={<AlignCenter />} onClick={() => { run((c) => c.setTextAlign("center")); close(); }}>
                Centre
              </DropdownItem>
              <DropdownItem icon={<AlignRight />} onClick={() => { run((c) => c.setTextAlign("right")); close(); }}>
                Right
              </DropdownItem>
              <DropdownItem icon={<AlignJustify />} onClick={() => { run((c) => c.setTextAlign("justify")); close(); }}>
                Justify
              </DropdownItem>
              <DropdownSeparator />
              <DropdownItem icon={<Type />} onClick={() => { close(); onToggleTypewriter(); }}>
                {typewriter ? "Typewriter off" : "Typewriter on"}
              </DropdownItem>
              <DropdownItem icon={<Maximize2 />} onClick={() => { close(); onToggleFocus(); }}>
                {focused ? "Exit focus mode" : "Focus mode"}
              </DropdownItem>
            </>
          )}
        </Dropdown>
      </div>

      <ToolButton
        label={focused ? "Exit focus mode" : "Focus mode"}
        shortcut="⌘⏎"
        onClick={onToggleFocus}
        className="hidden lg:inline-flex"
      >
        <Maximize2 className="size-[15px]" />
      </ToolButton>
    </div>
  );
}
