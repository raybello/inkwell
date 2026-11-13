"use client";

/**
 * Change tracking — word-level diff review between a chapter version and the
 * chapter's current draft. Hand-written LCS diff, no dependencies.
 *
 * Semantics: `base` is the older text (a chapter_versions row), `current` is
 * what the chapter holds now. Accepting a hunk keeps the newer wording;
 * rejecting it restores the older wording. Applying writes the resulting
 * markdown back to `chapters.content_md` (+ TipTap JSON) via saveChapterRevision.
 */

import * as React from "react";
import { Check, Minus, Plus, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { saveChapterRevision } from "@/lib/actions/comments";
import { cn } from "@/lib/utils";

export type DiffOp = { kind: "equal" | "insert" | "delete"; text: string };
export interface DiffHunk {
  index: number;
  before: string;
  after: string;
}
export type DiffBlock = { kind: "equal"; text: string } | { kind: "hunk"; hunk: DiffHunk };

/** Split into words and whitespace runs so differences stay readable. */
export function tokenize(text: string): string[] {
  return text.match(/\s+|[^\s]+/g) ?? [];
}

const LCS_CELL_BUDGET = 4_000_000;

/**
 * Word diff via longest-common-subsequence. Common prefix/suffix are trimmed
 * first and an oversized middle falls back to a single replace block, so this
 * stays bounded on very long chapters.
 */
export function diffWords(base: string, next: string): DiffOp[] {
  const a = tokenize(base);
  const b = tokenize(next);
  const ops: DiffOp[] = [];

  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start += 1;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA -= 1;
    endB -= 1;
  }

  const push = (kind: DiffOp["kind"], text: string) => {
    const last = ops[ops.length - 1];
    if (last && last.kind === kind) last.text += text;
    else ops.push({ kind, text });
  };

  for (let i = 0; i < start; i += 1) push("equal", a[i]);

  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);
  const n = midA.length;
  const m = midB.length;

  if (n && m && (n + 1) * (m + 1) <= LCS_CELL_BUDGET) {
    const width = m + 1;
    const dp = new Int32Array((n + 1) * width);
    for (let i = n - 1; i >= 0; i -= 1) {
      for (let j = m - 1; j >= 0; j -= 1) {
        dp[i * width + j] =
          midA[i] === midB[j]
            ? dp[(i + 1) * width + j + 1] + 1
            : Math.max(dp[(i + 1) * width + j], dp[i * width + j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (midA[i] === midB[j]) {
        push("equal", midA[i]);
        i += 1;
        j += 1;
      } else if (dp[(i + 1) * width + j] >= dp[i * width + j + 1]) {
        push("delete", midA[i]);
        i += 1;
      } else {
        push("insert", midB[j]);
        j += 1;
      }
    }
    while (i < n) {
      push("delete", midA[i]);
      i += 1;
    }
    while (j < m) {
      push("insert", midB[j]);
      j += 1;
    }
  } else {
    if (n) push("delete", midA.join(""));
    if (m) push("insert", midB.join(""));
  }

  for (let i = endA; i < a.length; i += 1) push("equal", a[i]);
  return ops;
}

/**
 * Group ops into alternating unchanged text and reviewable hunks.
 *
 * Two refinements keep the review readable: whitespace-only differences are
 * folded into the surrounding text (nobody wants to approve a newline), and
 * changes separated by a short untouched gap are merged into one hunk.
 */
export function diffBlocks(base: string, next: string): DiffBlock[] {
  type Part = { kind: "equal"; text: string } | { kind: "change"; before: string; after: string };
  const ops = diffWords(base, next);
  const parts: Part[] = [];
  let before = "";
  let after = "";
  let equal = "";

  const flushEqual = () => {
    if (equal) {
      parts.push({ kind: "equal", text: equal });
      equal = "";
    }
  };

  const flushChange = () => {
    if (!before && !after) return;
    if (!before.trim() && !after.trim()) {
      equal += after || before;
    } else {
      flushEqual();
      parts.push({ kind: "change", before, after });
    }
    before = "";
    after = "";
  };

  for (const op of ops) {
    if (op.kind === "equal") {
      flushChange();
      equal += op.text;
    } else if (op.kind === "delete") {
      before += op.text;
    } else {
      after += op.text;
    }
  }
  flushChange();
  flushEqual();

  const merged: Part[] = [];
  for (const part of parts) {
    if (part.kind === "equal") {
      merged.push(part);
      continue;
    }
    const gap = merged[merged.length - 1];
    const previous = merged[merged.length - 2];
    if (gap?.kind === "equal" && previous?.kind === "change" && gap.text.length <= 80 && !gap.text.includes("\n\n") && tokenize(gap.text).length <= 12) {
      merged.pop();
      previous.before += gap.text + part.before;
      previous.after += gap.text + part.after;
      continue;
    }
    merged.push({ ...part });
  }

  const blocks: DiffBlock[] = [];
  let index = 0;
  for (const part of merged) {
    if (part.kind === "equal") {
      if (part.text) blocks.push({ kind: "equal", text: part.text });
    } else {
      blocks.push({ kind: "hunk", hunk: { index, before: part.before, after: part.after } });
      index += 1;
    }
  }
  return blocks;
}

export function applyDecisions(blocks: DiffBlock[], accepted: Set<number>): string {
  return blocks
    .map((block) => {
      if (block.kind === "equal") return block.text;
      return accepted.has(block.hunk.index) ? block.hunk.after : block.hunk.before;
    })
    .join("");
}

export function diffStats(blocks: DiffBlock[]) {
  let hunks = 0;
  let added = 0;
  let removed = 0;
  for (const block of blocks) {
    if (block.kind !== "hunk") continue;
    hunks += 1;
    added += tokenize(block.hunk.after).filter((t) => t.trim()).length;
    removed += tokenize(block.hunk.before).filter((t) => t.trim()).length;
  }
  return { hunks, added, removed };
}

const MAX_RENDERED_BLOCKS = 1500;

export function ChangeTrackingDialog({
  open,
  onOpenChange,
  projectId,
  chapterId,
  chapterTitle,
  versionLabel,
  base,
  current,
  onApplied,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  chapterId: string;
  chapterTitle: string;
  versionLabel: string;
  base: string;
  current: string;
  onApplied?: () => void;
}) {
  const blocks = React.useMemo(() => (open ? diffBlocks(base ?? "", current ?? "") : []), [open, base, current]);
  const stats = React.useMemo(() => diffStats(blocks), [blocks]);
  const hunkCount = stats.hunks;
  const [accepted, setAccepted] = React.useState<Set<number>>(new Set());
  const [applying, setApplying] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    // Default: accept every proposed change, like "Accept all" in a word processor.
    setAccepted(new Set(Array.from({ length: hunkCount }, (_, i) => i)));
  }, [open, hunkCount]);

  function toggle(index: number, accept: boolean) {
    setAccepted((prev) => {
      const next = new Set(prev);
      if (accept) next.add(index);
      else next.delete(index);
      return next;
    });
  }

  async function apply() {
    const markdown = applyDecisions(blocks, accepted);
    setApplying(true);
    const res = await saveChapterRevision({
      projectId,
      chapterId,
      markdown,
      label: `Reviewed changes from ${versionLabel}`,
    });
    setApplying(false);
    if (!res.ok) {
      toast.error(res.error ?? "Could not apply the review.");
      return;
    }
    toast.success(`Chapter updated · ${res.wordCount?.toLocaleString("en-US") ?? 0} words`);
    onApplied?.();
    onOpenChange(false);
  }

  const visibleBlocks = blocks.length > MAX_RENDERED_BLOCKS ? blocks.slice(0, MAX_RENDERED_BLOCKS) : blocks;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      width="max-w-3xl"
      title="Review changes"
      description={`${chapterTitle} · ${versionLabel} → current draft`}
      footer={
        <>
          <span className="mr-auto self-center text-[11px] text-muted">
            {accepted.size} of {hunkCount} {hunkCount === 1 ? "change" : "changes"} accepted
          </span>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void apply()} loading={applying} disabled={hunkCount === 0}>
            <Check /> {accepted.size === 0 ? "Restore this version" : "Apply accepted"}
          </Button>
        </>
      }
    >
      {hunkCount === 0 ? (
        <p className="py-10 text-center text-sm text-muted">No wording differences. The draft matches this version.</p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">{stats.hunks} hunks</Badge>
            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-sage">
              <Plus className="size-3" />
              {stats.added}
            </span>
            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-red-400">
              <Minus className="size-3" />
              {stats.removed}
            </span>
            <div className="ml-auto flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[11.5px]"
                onClick={() => setAccepted(new Set(Array.from({ length: hunkCount }, (_, i) => i)))}
              >
                Accept all
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-[11.5px]" onClick={() => setAccepted(new Set())}>
                Reject all
              </Button>
            </div>
          </div>

          <div className="max-h-[46vh] overflow-y-auto rounded-lg border border-border bg-ink-950/50 p-4">
            <div className="whitespace-pre-wrap break-words font-serif text-[14.5px] leading-[1.9] text-ink-100">
              {visibleBlocks.map((block, i) => {
                if (block.kind === "equal") return <span key={`eq-${i}`}>{block.text}</span>;
                const isAccepted = accepted.has(block.hunk.index);
                return (
                  <span key={`hunk-${block.hunk.index}`} className="group/hunk relative">
                    <span
                      className={cn(
                        "rounded-sm transition-colors",
                        isAccepted ? "bg-sage/10" : "bg-red-900/15",
                      )}
                    >
                      {block.hunk.before && (
                        <span
                          className={cn(
                            "text-red-300/80",
                            isAccepted && "bg-red-900/25 line-through decoration-red-500/60",
                            !isAccepted && "text-ink-100",
                          )}
                        >
                          {block.hunk.before}
                        </span>
                      )}
                      {block.hunk.after && (
                        <span
                          className={cn(
                            isAccepted ? "bg-sage/20 text-sage" : "text-muted line-through decoration-red-500/50 opacity-60",
                          )}
                        >
                          {block.hunk.after}
                        </span>
                      )}
                    </span>
                    <span className="mx-0.5 inline-flex translate-y-[1px] items-center gap-0.5 opacity-60 transition group-hover/hunk:opacity-100">
                      <button
                        type="button"
                        onClick={() => toggle(block.hunk.index, true)}
                        aria-label={`Accept change ${block.hunk.index + 1}`}
                        aria-pressed={isAccepted}
                        className={cn(
                          "rounded border p-[1px] transition",
                          isAccepted
                            ? "border-sage/60 bg-sage/20 text-sage"
                            : "border-border-strong bg-ink-800 text-muted hover:text-sage",
                        )}
                      >
                        <Check className="size-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggle(block.hunk.index, false)}
                        aria-label={`Reject change ${block.hunk.index + 1}`}
                        aria-pressed={!isAccepted}
                        className={cn(
                          "rounded border p-[1px] transition",
                          !isAccepted
                            ? "border-red-700/60 bg-red-900/30 text-red-300"
                            : "border-border-strong bg-ink-800 text-muted hover:text-red-300",
                        )}
                      >
                        <X className="size-3" />
                      </button>
                    </span>
                  </span>
                );
              })}
            </div>
          </div>

          {blocks.length > MAX_RENDERED_BLOCKS && (
            <p className="text-[11px] text-amber-300/80">
              Showing the first {MAX_RENDERED_BLOCKS} sections. Applying still writes the complete reviewed text.
            </p>
          )}
          <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted">
            <Undo2 className="mt-0.5 size-3 shrink-0" />
            Applying writes the chapter&apos;s markdown and TipTap content, and records a manual version. Unsaved edits in the
            editor for this chapter may be overwritten.
          </p>
        </div>
      )}
    </Dialog>
  );
}
