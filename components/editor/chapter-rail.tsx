"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, FileText, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { ChapterListItem } from "./types";

const DOT: Record<string, string> = {
  draft: "bg-ink-500",
  in_progress: "bg-accent",
  complete: "bg-sage",
  needs_review: "bg-amber-500",
};

export function ChapterRail({
  projectId,
  chapters,
  activeId,
  liveWords,
  canEdit,
  onAdd,
  onRename,
  onRequestDelete,
  onMove,
  className,
}: {
  projectId: string;
  chapters: ChapterListItem[];
  activeId: string;
  liveWords: number;
  canEdit: boolean;
  onAdd: () => void;
  onRename: (chapter: ChapterListItem) => void;
  onRequestDelete: (chapter: ChapterListItem) => void;
  onMove: (chapter: ChapterListItem, direction: -1 | 1) => void;
  className?: string;
}) {
  const total = chapters.reduce(
    (sum, chapter) => sum + (chapter.id === activeId ? liveWords : chapter.word_count ?? 0),
    0,
  );

  return (
    <aside className={cn("flex min-h-0 flex-col bg-ink-900/40", className)} aria-label="Chapters">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
          Manuscript
          <span className="ml-1.5 font-mono text-[10px] tracking-normal text-muted/70">{chapters.length}</span>
        </span>
        {canEdit && (
          <button
            type="button"
            onClick={onAdd}
            className="rounded-md p-1 text-muted transition hover:bg-ink-750 hover:text-foreground"
            aria-label="Add chapter"
            title="Add chapter"
          >
            <Plus className="size-4" />
          </button>
        )}
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {chapters.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted">No chapters yet.</p>
        ) : (
          <ul className="space-y-0.5">
            {chapters.map((chapter, index) => {
              const active = chapter.id === activeId;
              const words = active ? liveWords : chapter.word_count;
              return (
                <li key={chapter.id} className="group relative">
                  <Link
                    href={`/app/projects/${projectId}/editor/${chapter.id}`}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex flex-col gap-1 rounded-md border border-transparent px-2 py-2 pr-8 transition",
                      active
                        ? "border-border-strong bg-ink-800 text-foreground"
                        : "text-muted-strong hover:bg-ink-850 hover:text-foreground",
                    )}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={cn(
                          "size-1.5 shrink-0 rounded-full",
                          DOT[chapter.status] ?? "bg-ink-500",
                          active && "ring-2 ring-ink-700",
                        )}
                        aria-hidden
                      />
                      <span className={cn("truncate text-[13px] leading-snug", active && "font-medium")}>
                        {chapter.title || "Untitled Chapter"}
                      </span>
                    </span>
                    <span className="pl-3.5 font-mono text-[10px] text-muted">
                      {index + 1} · {formatNumber(words)} words
                    </span>
                  </Link>

                  {canEdit && chapters.length > 1 && (
                    <div className="absolute right-1 top-1.5 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100">
                      <Dropdown
                        align="end"
                        trigger={
                          <button
                            type="button"
                            className="rounded-md p-1 text-muted hover:bg-ink-700 hover:text-foreground"
                            aria-label={`Actions for ${chapter.title}`}
                          >
                            <MoreHorizontal className="size-3.5" />
                          </button>
                        }
                      >
                        {(close) => (
                          <>
                            <DropdownItem
                              onClick={() => {
                                close();
                                onRename(chapter);
                              }}
                            >
                              Rename…
                            </DropdownItem>
                            <DropdownItem
                              icon={<ChevronUp />}
                              disabled={index === 0}
                              onClick={() => {
                                close();
                                onMove(chapter, -1);
                              }}
                            >
                              Move up
                            </DropdownItem>
                            <DropdownItem
                              icon={<ChevronDown />}
                              disabled={index === chapters.length - 1}
                              onClick={() => {
                                close();
                                onMove(chapter, 1);
                              }}
                            >
                              Move down
                            </DropdownItem>
                            <DropdownItem
                              danger
                              icon={<Trash2 />}
                              onClick={() => {
                                close();
                                onRequestDelete(chapter);
                              }}
                            >
                              Delete chapter
                            </DropdownItem>
                          </>
                        )}
                      </Dropdown>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {canEdit && (
          <button
            type="button"
            onClick={onAdd}
            className="mt-2 flex w-full items-center gap-2 rounded-md border border-dashed border-border-strong px-2 py-1.5 text-[12px] text-muted transition hover:border-accent/50 hover:text-accent-soft"
          >
            <Plus className="size-3.5" /> New chapter
          </button>
        )}
      </nav>

      <div className="flex h-9 shrink-0 items-center justify-between border-t border-border px-3 font-mono text-[10px] text-muted">
        <span className="flex items-center gap-1.5">
          <FileText className="size-3" />
          {formatNumber(total)} words
        </span>
        <span>{chapters.length} ch.</span>
      </div>
    </aside>
  );
}
