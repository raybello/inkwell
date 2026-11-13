"use client";

/**
 * Chapter comment rail (right-hand side of the editor).
 *
 * ── Editor integration contract ───────────────────────────────────────────────
 * 1. The editor asks for a comment on the current selection by dispatching:
 *
 *      window.dispatchEvent(new CustomEvent("inkwell:comment-request", {
 *        detail: { text: selectionText, from: plainTextStart, to: plainTextEnd },
 *      }));
 *
 *    `from`/`to` are character offsets into the chapter plain text. This panel
 *    opens the composer, quotes `text`, and saves anchor_start / anchor_end /
 *    quoted_text with the comment. Listen with `requestComment()` from
 *    "@/components/comments/types" if you prefer a typed helper.
 *
 * 2. This panel asks the editor to reveal an anchor by dispatching:
 *
 *      window.dispatchEvent(new CustomEvent("inkwell:comment-focus", {
 *        detail: { from: anchorStart, to: anchorEnd },
 *      }));
 *
 *    The editor should scroll that range into view and flash a highlight.
 *    `focusCommentAnchor()` is the typed helper.
 *
 * Both events are safe no-ops when nobody is listening.
 * ──────────────────────────────────────────────────────────────────────────────
 */

import * as React from "react";
import { ChevronDown, LocateFixed, MessageSquare, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { CommentComposer } from "@/components/comments/comment-composer";
import { AnchoredCommentRow, CommentThread } from "@/components/comments/comment-thread";
import {
  COMMENT_REQUEST_EVENT,
  focusCommentAnchor,
  type CommentAuthor,
  type CommentRequestDetail,
  type CommentRow,
} from "@/components/comments/types";
import { listChapterComments, createComment, deleteComment, setCommentResolved } from "@/lib/actions/comments";
import { cn } from "@/lib/utils";

interface Draft {
  quoted: string | null;
  from: number | null;
  to: number | null;
}

export function CommentsPanel({
  projectId,
  chapterId,
  className,
}: {
  projectId: string;
  chapterId: string;
  className?: string;
}) {
  const [comments, setComments] = React.useState<CommentRow[]>([]);
  const [viewer, setViewer] = React.useState<CommentAuthor | null>(null);
  const [canModerate, setCanModerate] = React.useState(false);
  const [canComment, setCanComment] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<"open" | "new" | "all">("open");
  const [newIds, setNewIds] = React.useState<Set<string>>(new Set());
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [focusSignal, setFocusSignal] = React.useState(0);
  const [showResolved, setShowResolved] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    const res = await listChapterComments(chapterId);
    setLoading(false);
    if (!res.ok) {
      setError(res.error ?? "Could not load comments.");
      return;
    }
    setError(null);
    setComments(res.comments);

    // Unread is browser-local: the comments table has no per-user read state.
    try {
      const key = `inkwell:comments:seenAt:${chapterId}`;
      const previous = window.localStorage.getItem(key);
      if (previous) {
        const since = Date.parse(previous);
        if (Number.isFinite(since)) {
          setNewIds(new Set(res.comments.filter((c) => Date.parse(c.created_at) > since).map((c) => c.id)));
        }
      }
      window.localStorage.setItem(key, new Date().toISOString());
    } catch {
      /* storage disabled — unread badges are optional */
    }

    setViewer(res.viewer);
    setCanModerate(!!res.canModerate);
    setCanComment(!!res.canComment);
  }, [chapterId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  // Editor → panel: "comment on this selection".
  React.useEffect(() => {
    function onRequest(event: Event) {
      const detail = (event as CustomEvent<CommentRequestDetail>).detail ?? {};
      const text = typeof detail.text === "string" ? detail.text.trim().slice(0, 500) : "";
      const from = typeof detail.from === "number" && Number.isFinite(detail.from) ? detail.from : null;
      const to = typeof detail.to === "number" && Number.isFinite(detail.to) ? detail.to : null;
      setDraft({ quoted: text || null, from, to });
      setFilter("open");
      setFocusSignal((n) => n + 1);
    }
    window.addEventListener(COMMENT_REQUEST_EVENT, onRequest);
    return () => window.removeEventListener(COMMENT_REQUEST_EVENT, onRequest);
  }, []);

  const byId = React.useMemo(() => new Map(comments.map((c) => [c.id, c])), [comments]);

  const rootIdOf = React.useCallback(
    (comment: CommentRow) => {
      let current = comment;
      let guard = 0;
      while (current.parent_id && guard < 8) {
        const parent = byId.get(current.parent_id);
        if (!parent) break;
        current = parent;
        guard += 1;
      }
      return current.id;
    },
    [byId],
  );

  const topLevel = React.useMemo(() => comments.filter((c) => !c.parent_id), [comments]);
  const repliesByRoot = React.useMemo(() => {
    const map = new Map<string, CommentRow[]>();
    for (const c of comments) {
      if (!c.parent_id) continue;
      const root = rootIdOf(c);
      if (root === c.id) continue;
      const list = map.get(root) ?? [];
      list.push(c);
      map.set(root, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.created_at.localeCompare(b.created_at));
    return map;
  }, [comments, rootIdOf]);

  const openThreads = topLevel.filter((c) => !c.resolved);
  const resolvedThreads = topLevel.filter((c) => c.resolved);
  const newThreads = React.useMemo(() => topLevel.filter((c) => newIds.has(c.id)), [topLevel, newIds]);
  const visible = filter === "open" ? openThreads : filter === "new" ? newThreads : topLevel;
  const anchored = React.useMemo(
    () =>
      openThreads
        .filter((c) => c.quoted_text && c.anchor_start != null && c.anchor_end != null)
        .sort((a, b) => (a.anchor_start ?? 0) - (b.anchor_start ?? 0)),
    [openThreads],
  );

  function jumpTo(comment: CommentRow) {
    if (comment.anchor_start != null && comment.anchor_end != null) {
      focusCommentAnchor({ from: comment.anchor_start, to: comment.anchor_end });
    }
    document.getElementById(`comment-${comment.id}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function optimisticRow(body: string, parentId: string | null, snapshot: Draft | null): CommentRow {
    return {
      id: `tmp-${Math.random().toString(36).slice(2)}`,
      chapter_id: chapterId,
      project_id: projectId,
      author_id: viewer?.id ?? null,
      parent_id: parentId,
      anchor_start: parentId ? null : snapshot?.from ?? null,
      anchor_end: parentId ? null : snapshot?.to ?? null,
      quoted_text: parentId ? null : snapshot?.quoted ?? null,
      body,
      resolved: false,
      created_at: new Date().toISOString(),
      author: viewer,
      pending: true,
    };
  }

  async function handleCreate(body: string): Promise<boolean> {
    const snapshot = draft;
    const temp = optimisticRow(body, null, snapshot);
    setComments((prev) => [...prev, temp]);
    setDraft(null);
    setFilter("open");

    const res = await createComment({
      projectId,
      chapterId,
      body,
      anchorStart: snapshot?.from ?? null,
      anchorEnd: snapshot?.to ?? null,
      quotedText: snapshot?.quoted ?? null,
    });

    if (!res.ok || !res.comment) {
      setComments((prev) => prev.filter((c) => c.id !== temp.id));
      setDraft(snapshot);
      toast.error(res.error ?? "Could not post that comment.");
      return false;
    }
    const saved = res.comment;
    setComments((prev) => prev.map((c) => (c.id === temp.id ? saved : c)));
    return true;
  }

  async function handleReply(parent: CommentRow, body: string): Promise<boolean> {
    const temp = optimisticRow(body, parent.id, null);
    setComments((prev) => [...prev, temp]);

    const res = await createComment({ projectId, chapterId, body, parentId: parent.id });
    if (!res.ok || !res.comment) {
      setComments((prev) => prev.filter((c) => c.id !== temp.id));
      toast.error(res.error ?? "Could not post that reply.");
      return false;
    }
    const saved = res.comment;
    setComments((prev) => prev.map((c) => (c.id === temp.id ? saved : c)));
    return true;
  }

  async function handleResolve(comment: CommentRow, resolved: boolean) {
    const affected = [comment.id, ...(repliesByRoot.get(comment.id) ?? []).map((r) => r.id)];
    const previous = comments;
    setComments((prev) => prev.map((c) => (affected.includes(c.id) ? { ...c, resolved } : c)));
    const res = await setCommentResolved(comment.id, resolved);
    if (!res.ok) {
      setComments(previous);
      toast.error(res.error ?? "Could not update the thread.");
    }
  }

  async function handleDelete(comment: CommentRow) {
    const removed = new Set<string>([comment.id]);
    // Cascade locally so nested replies don't linger until the next refresh.
    let frontier = [comment.id];
    for (let depth = 0; depth < 6 && frontier.length; depth += 1) {
      const next = comments.filter((c) => c.parent_id && frontier.includes(c.parent_id));
      for (const child of next) removed.add(child.id);
      frontier = next.map((c) => c.id);
    }
    const previous = comments;
    setComments((prev) => prev.filter((c) => !removed.has(c.id)));
    const res = await deleteComment(comment.id);
    if (!res.ok) {
      setComments(previous);
      toast.error(res.error ?? "Could not delete that comment.");
    }
  }

  return (
    <aside className={cn("flex h-full min-h-0 flex-col bg-ink-900/40", className)} aria-label="Chapter comments">
      <header className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-strong">
          {openThreads.length} open
        </h2>
        <div className="ml-auto flex items-center gap-0.5">
          <div className="flex items-center rounded-md border border-border p-0.5">
            {(["open", "new", "all"] as const)
              .filter((key) => key !== "new" || newThreads.length > 0)
              .map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                aria-pressed={filter === key}
                className={cn(
                  "rounded px-2 py-0.5 text-[11px] capitalize transition",
                  filter === key ? "bg-ink-750 text-foreground" : "text-muted hover:text-muted-strong",
                )}
              >
                {key === "new" ? `New ${newThreads.length}` : key}
              </button>
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Refresh comments"
            title="Refresh"
            onClick={() => void load()}
            className="text-muted"
          >
            <RotateCw className="size-3.5" />
          </Button>
        </div>
      </header>

      <div className="shrink-0 border-b border-border px-3 py-3">
        {!loading && !canComment ? (
          <p className="rounded-md border border-border bg-ink-900/60 px-3 py-2 text-[11.5px] leading-relaxed text-muted">
            You have view-only access — you can read this discussion but not post to it.
          </p>
        ) : (
          <CommentComposer
            placeholder={draft?.quoted ? "Reply to the selected text…" : "Leave a note on this chapter…"}
            submitLabel="Comment"
            quotedText={draft?.quoted ?? null}
            onClearQuote={draft ? () => setDraft(null) : undefined}
            focusSignal={focusSignal}
            onSubmit={handleCreate}
          />
        )}
        {draft?.from != null && (
          <p className="mt-1.5 flex items-center gap-1 text-[10.5px] uppercase tracking-[0.12em] text-accent/80">
            <LocateFixed className="size-3" /> anchored to the selection
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && comments.length === 0 ? (
          <div className="space-y-4 p-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-2.5">
                <Skeleton className="size-6 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-2.5 w-24" />
                  <Skeleton className="h-2 w-full" />
                  <Skeleton className="h-2 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-4 text-center">
            <p className="text-xs text-red-300">{error}</p>
            <Button variant="ghost" size="sm" onClick={() => void load()} className="mt-2">
              Try again
            </Button>
          </div>
        ) : (
          <>
            {anchored.length > 0 && (
              <section className="border-b border-border px-4 py-2.5">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted/80">
                  In the text · {anchored.length}
                </p>
                <ul className="divide-y divide-border/60">
                  {anchored.map((c) => (
                    <AnchoredCommentRow key={c.id} comment={c} onJump={jumpTo} onOpen={jumpTo} />
                  ))}
                </ul>
              </section>
            )}

            {visible.length === 0 && resolvedThreads.length === 0 && comments.length === 0 ? (
              <EmptyState
                icon={<MessageSquare />}
                title="No comments yet"
                description="Select a passage to anchor a note, or start a general comment above. Collaborators see this thread in real time."
                className="py-12"
              />
            ) : visible.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-muted">
                {filter === "new"
                  ? "Nothing new since your last visit."
                  : `Nothing open. ${resolvedThreads.length > 0 ? "Resolved threads are below." : "The manuscript is clear."}`}
              </p>
            ) : (
              <ol className="divide-y divide-border/70">
                {visible.map((thread) => (
                  <li key={thread.id}>
                    <CommentThread
                      comment={thread}
                      replies={repliesByRoot.get(thread.id) ?? []}
                      viewerId={viewer?.id ?? null}
                      canModerate={canModerate}
                      isNew={newIds.has(thread.id)}
                      canReply={canComment}
                      canResolve={canModerate || thread.author_id === viewer?.id}
                      onReply={handleReply}
                      onResolve={handleResolve}
                      onDelete={handleDelete}
                      onJump={jumpTo}
                    />
                  </li>
                ))}
              </ol>
            )}

            {filter === "open" && resolvedThreads.length > 0 && (
              <section className="border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowResolved((s) => !s)}
                  aria-expanded={showResolved}
                  className="flex w-full items-center gap-1.5 px-4 py-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted transition hover:text-muted-strong"
                >
                  <ChevronDown className={cn("size-3 transition-transform", showResolved && "rotate-180")} />
                  Resolved ({resolvedThreads.length})
                </button>
                {showResolved && (
                  <ol className="divide-y divide-border/70 border-t border-border/70">
                    {resolvedThreads.map((thread) => (
                      <li key={thread.id}>
                        <CommentThread
                          comment={thread}
                          replies={repliesByRoot.get(thread.id) ?? []}
                          viewerId={viewer?.id ?? null}
                          canModerate={canModerate}
                          isNew={newIds.has(thread.id)}
                          canReply={canComment}
                          canResolve={canModerate || thread.author_id === viewer?.id}
                          onReply={handleReply}
                          onResolve={handleResolve}
                          onDelete={handleDelete}
                          onJump={jumpTo}
                        />
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
