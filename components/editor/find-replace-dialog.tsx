"use client";

import * as React from "react";
import Link from "next/link";
import type { Editor } from "@tiptap/react";
import { ArrowRight, Loader2, Replace, Search, CornerDownRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  getChapterContentAction,
  replaceProjectChaptersAction,
  searchProjectChaptersAction,
  type ChapterSearchResult,
} from "@/lib/actions/chapters";
import { findSearchMatches, scrollToMatch, type SearchConfig } from "@/lib/editor/search-highlight";
import { cn, formatNumber } from "@/lib/utils";
import { useEditorTick } from "./use-editor-tick";

type Scope = "chapter" | "project";

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-md border px-2 py-1 text-[11px] transition",
        active
          ? "border-accent/40 bg-accent/10 text-accent-soft"
          : "border-border-strong text-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export function FindReplaceDialog({
  open,
  onOpenChange,
  editor,
  projectId,
  chapterId,
  chapterTitle,
  canEdit,
  onExternalContentChange,
  flushPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editor: Editor | null;
  projectId: string;
  chapterId: string;
  chapterTitle: string;
  canEdit: boolean;
  onExternalContentChange: (content: unknown, wordCount: number) => void;
  flushPending?: () => Promise<unknown>;
}) {
  const [scope, setScope] = React.useState<Scope>("chapter");
  const [query, setQuery] = React.useState("");
  const [replacement, setReplacement] = React.useState("");
  const [caseSensitive, setCaseSensitive] = React.useState(false);
  const [regex, setRegex] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);

  const [projectResult, setProjectResult] = React.useState<ChapterSearchResult | null>(null);
  const [searching, setSearching] = React.useState(false);
  const [replacing, setReplacing] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);

  const tick = useEditorTick(editor);

  const config: SearchConfig = React.useMemo(
    () => ({ query, regex, caseSensitive, activeIndex }),
    [query, regex, caseSensitive, activeIndex],
  );

  const matches = React.useMemo(
    () => (editor ? findSearchMatches(editor.state.doc, config) : []),
    // tick forces a rescan after every document change
    [editor, config, tick],
  );

  React.useEffect(() => {
    if (!editor || !open || scope !== "chapter") return;
    editor.commands.setSearchHighlight(config);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, open, scope, query, regex, caseSensitive, activeIndex]);

  React.useEffect(() => {
    if (open && scope === "chapter") return;
    editor?.commands.clearSearchHighlight();
  }, [editor, open, scope]);

  React.useEffect(() => {
    if (!open) {
      setProjectResult(null);
      setConfirming(false);
      setSearching(false);
      setReplacing(false);
    }
  }, [open]);

  const goTo = (index: number) => {
    if (!editor || !matches.length) return;
    const next = ((index % matches.length) + matches.length) % matches.length;
    setActiveIndex(next);
    const match = matches[next];
    editor.chain().focus().setTextSelection({ from: match.from, to: match.to }).scrollIntoView().run();
    scrollToMatch(editor.view, match);
    editor.commands.setSearchHighlight({ ...config, activeIndex: next });
  };

  const replaceOne = () => {
    if (!editor || !matches.length || !canEdit) return;
    const match = matches[Math.min(activeIndex, matches.length - 1)];
    const chain = editor.chain().focus();
    if (replacement) {
      chain.insertContentAt({ from: match.from, to: match.to }, { type: "text", text: replacement }).run();
    } else {
      chain.deleteRange({ from: match.from, to: match.to }).run();
    }
    const remaining = matches.length - 1;
    setActiveIndex(Math.max(0, Math.min(activeIndex, remaining - 1)));
  };

  const replaceAllChapter = () => {
    if (!editor || !matches.length || !canEdit) return;
    const tr = editor.state.tr;
    for (const match of [...matches].reverse()) {
      tr.insertText(replacement, match.from, match.to);
    }
    editor.view.dispatch(tr);
    editor.commands.setSearchHighlight({ ...config, activeIndex: 0 });
    setActiveIndex(0);
    toast.success(`Replaced ${formatNumber(matches.length)} match${matches.length === 1 ? "" : "es"}.`);
  };

  const runProjectSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setConfirming(false);
    const result = await searchProjectChaptersAction(projectId, query, { regex, caseSensitive });
    setSearching(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setProjectResult(result.data);
  };

  const runProjectReplace = async () => {
    if (!query.trim() || !canEdit) return;
    setReplacing(true);
    // make sure the open chapter's latest keystrokes are in the database first
    try {
      await flushPending?.();
    } catch {
      // continue: replacement operates on stored markdown
    }
    const result = await replaceProjectChaptersAction(projectId, query, replacement, { caseSensitive });
    if (!result.ok) {
      setReplacing(false);
      toast.error(result.error);
      return;
    }

    toast.success(
      `Replaced ${formatNumber(result.data.replacements)} match${result.data.replacements === 1 ? "" : "es"} in ${formatNumber(
        result.data.chapters,
      )} chapter${result.data.chapters === 1 ? "" : "s"}.`,
    );

    // If this chapter was rewritten server-side, pull the new body into the editor.
    const touchedCurrent = projectResult?.hits.some((hit) => hit.chapterId === chapterId);
    if (touchedCurrent) {
      const fresh = await getChapterContentAction(projectId, chapterId);
      if (fresh.ok) onExternalContentChange(fresh.data.content, fresh.data.wordCount);
    }

    setReplacing(false);
    setConfirming(false);
    await runProjectSearch();
  };

  const count = matches.length;
  const projectCount = projectResult?.total ?? 0;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Find & replace"
      description={scope === "chapter" ? `Searching “${chapterTitle}”` : "Searching every chapter in this project"}
      width="max-w-2xl"
    >
      <div className="space-y-4">
        <div className="flex gap-1 rounded-lg border border-border bg-ink-900/60 p-0.5">
          {(
            [
              { id: "chapter", label: "This chapter" },
              { id: "project", label: "Whole project" },
            ] as const
          ).map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setScope(option.id)}
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-[13px] transition",
                scope === option.id ? "bg-ink-750 text-foreground" : "text-muted hover:text-muted-strong",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
              <Input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  if (scope === "chapter") goTo(event.shiftKey ? activeIndex - 1 : activeIndex + 1);
                  else void runProjectSearch();
                }}
                placeholder="Find…"
                className="pl-8"
                autoFocus
              />
            </div>
            {scope === "chapter" && (
              <span className="min-w-[74px] text-right font-mono text-[11px] text-muted">
                {count ? `${Math.min(activeIndex + 1, count)} / ${count}` : "no matches"}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <Toggle active={caseSensitive} onClick={() => setCaseSensitive((value) => !value)}>
              Match case
            </Toggle>
            <Toggle active={regex} onClick={() => setRegex((value) => !value)}>
              Regex
            </Toggle>
            {scope === "chapter" && (
              <div className="ml-auto flex items-center gap-1">
                <Button size="sm" variant="ghost" className="h-7 px-2 text-[12px]" disabled={!count} onClick={() => goTo(activeIndex - 1)}>
                  Prev
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-[12px]" disabled={!count} onClick={() => goTo(activeIndex + 1)}>
                  Next
                </Button>
              </div>
            )}
          </div>
        </div>

        {scope === "chapter" ? (
          <div className="space-y-2 border-t border-border pt-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <CornerDownRight className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
                <Input
                  value={replacement}
                  onChange={(event) => setReplacement(event.target.value)}
                  placeholder="Replace with…"
                  className="pl-8"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      replaceOne();
                    }
                  }}
                />
              </div>
              <Button size="sm" variant="secondary" disabled={!count || !canEdit} onClick={replaceOne}>
                <Replace className="size-3.5" /> Replace
              </Button>
              <Button size="sm" variant="primary" disabled={!count || !canEdit} onClick={replaceAllChapter}>
                All
              </Button>
            </div>
            <p className="text-[11px] text-muted">
              Chapter search highlights matches in the page as you type. {canEdit ? "" : "Read-only access — replacement is disabled."}
            </p>
          </div>
        ) : (
          <div className="space-y-3 border-t border-border pt-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <CornerDownRight className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
                <Input
                  value={replacement}
                  onChange={(event) => setReplacement(event.target.value)}
                  placeholder="Replace with…"
                  className="pl-8"
                  disabled={regex}
                />
              </div>
              <Button size="sm" variant="secondary" loading={searching} onClick={() => void runProjectSearch()}>
                <Search className="size-3.5" /> Search
              </Button>
              {confirming ? (
                <Button size="sm" variant="danger" loading={replacing} onClick={() => void runProjectReplace()}>
                  Confirm {formatNumber(projectCount)}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="primary"
                  disabled={!canEdit || !projectResult || projectCount === 0 || regex}
                  onClick={() => setConfirming(true)}
                >
                  Replace all
                </Button>
              )}
            </div>
            {regex ? (
              <p className="text-[11px] text-amber-300/90">
                Project-wide replacement works on plain text only. Regex search is supported, but switch Regex off to replace.
              </p>
            ) : (
              <p className="text-[11px] text-muted">
                Rewrites the markdown mirror and structured content of every matching chapter. Plain text only.
              </p>
            )}

            <div className="max-h-[260px] overflow-y-auto rounded-md border border-border">
              {searching ? (
                <div className="flex items-center justify-center py-10 text-muted">
                  <Loader2 className="size-4 animate-spin" />
                </div>
              ) : !projectResult ? (
                <p className="px-4 py-8 text-center text-xs text-muted">Run a search to see matches across the manuscript.</p>
              ) : projectResult.hits.length === 0 ? (
                <p className="px-4 py-8 text-center text-xs text-muted">No chapters contain that text.</p>
              ) : (
                <ul className="divide-y divide-border/70">
                  {projectResult.hits.map((hit) => (
                    <li key={hit.chapterId} className="px-3 py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          href={`/app/projects/${projectId}/editor/${hit.chapterId}`}
                          className="group inline-flex min-w-0 items-center gap-1.5 text-[12.5px] text-muted-strong transition hover:text-accent-soft"
                        >
                          <span className="truncate">{hit.title}</span>
                          <ArrowRight className="size-3 shrink-0 opacity-0 transition group-hover:opacity-100" />
                        </Link>
                        <span className="shrink-0 font-mono text-[10px] text-muted">
                          {formatNumber(hit.count)} hit{hit.count === 1 ? "" : "s"}
                        </span>
                      </div>
                      <ul className="mt-1 space-y-0.5">
                        {hit.snippets.map((snippet, index) => (
                          <li key={`${hit.chapterId}-${index}`} className="truncate font-serif text-[12px] text-muted">
                            {snippet.text}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {projectResult && projectCount > 0 && (
              <p className="font-mono text-[11px] text-muted">
                {formatNumber(projectCount)} matches across {formatNumber(projectResult.hits.length)} chapters
              </p>
            )}
          </div>
        )}
      </div>
    </Dialog>
  );
}
