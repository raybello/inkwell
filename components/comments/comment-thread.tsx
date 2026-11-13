"use client";

import * as React from "react";
import { Check, CornerDownRight, MoreHorizontal, RotateCcw, Trash2, LocateFixed, Reply } from "lucide-react";
import { Avatar } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dropdown, DropdownItem, DropdownSeparator } from "@/components/ui/dropdown";
import { CommentComposer } from "@/components/comments/comment-composer";
import type { CommentRow } from "@/components/comments/types";
import { cn, relativeTime, truncate } from "@/lib/utils";

export function CommentThread({
  comment,
  replies,
  viewerId,
  canModerate,
  isNew = false,
  canReply = true,
  canResolve = true,
  onReply,
  onResolve,
  onDelete,
  onJump,
}: {
  comment: CommentRow;
  replies: CommentRow[];
  viewerId: string | null;
  canModerate: boolean;
  /** Arrived since this browser last opened the chapter. */
  isNew?: boolean;
  canReply?: boolean;
  canResolve?: boolean;
  onReply: (parent: CommentRow, body: string) => Promise<boolean>;
  onResolve: (comment: CommentRow, resolved: boolean) => void;
  onDelete: (comment: CommentRow) => void;
  onJump?: (comment: CommentRow) => void;
}) {
  const [replying, setReplying] = React.useState(false);
  const mine = !!comment.author_id && comment.author_id === viewerId;
  const authorName = comment.author?.display_name ?? "Someone";
  const anchored = comment.anchor_start != null && comment.anchor_end != null;

  return (
    <article
      id={`comment-${comment.id}`}
      className={cn(
        "group/thread relative px-4 py-3.5 transition-colors",
        comment.pending ? "opacity-70" : "hover:bg-ink-850/40",
        comment.resolved && "opacity-80",
      )}
    >
      <div className="flex items-start gap-2.5">
        <Avatar name={authorName} src={comment.author?.avatar_url} size={24} className="mt-0.5" />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[12.5px] font-medium text-foreground">{authorName}</span>
            <span className="shrink-0 text-[11px] text-muted/80" title={new Date(comment.created_at).toLocaleString()}>
              {comment.pending ? "sending…" : relativeTime(comment.created_at)}
            </span>
            {isNew && !comment.pending && (
              <span className="size-1.5 shrink-0 rounded-full bg-accent" title="New since your last visit" />
            )}
            {comment.resolved && <Badge tone="sage" className="ml-0.5 px-1.5 py-0 text-[10px]">Resolved</Badge>}
            {!comment.pending && (
              <div className="ml-auto shrink-0 opacity-0 transition group-hover/thread:opacity-100 focus-within:opacity-100">
                <Dropdown
                  trigger={
                    <button
                      type="button"
                      aria-label="Comment actions"
                      className="rounded p-1 text-muted hover:bg-ink-800 hover:text-foreground"
                    >
                      <MoreHorizontal className="size-3.5" />
                    </button>
                  }
                >
                  {(close) => (
                    <>
                      {canResolve && (
                        <DropdownItem
                          icon={comment.resolved ? <RotateCcw /> : <Check />}
                          onClick={() => {
                            close();
                            onResolve(comment, !comment.resolved);
                          }}
                        >
                          {comment.resolved ? "Reopen thread" : "Resolve thread"}
                        </DropdownItem>
                      )}
                      {(mine || canModerate) && (
                        <>
                          <DropdownSeparator />
                          <DropdownItem
                            danger
                            icon={<Trash2 />}
                            onClick={() => {
                              close();
                              onDelete(comment);
                            }}
                          >
                            Delete
                          </DropdownItem>
                        </>
                      )}
                    </>
                  )}
                </Dropdown>
              </div>
            )}
          </div>

          {comment.quoted_text && (
            <div className="mt-1.5 rounded-md border-l-2 border-accent/45 bg-accent/[0.04] py-1 pl-2 pr-1.5">
              <p className="font-serif text-[12.5px] italic leading-snug text-muted-strong">
                “{truncate(comment.quoted_text, 220)}”
              </p>
              {anchored && onJump && (
                <button
                  type="button"
                  onClick={() => onJump(comment)}
                  className="mt-1 inline-flex items-center gap-1 text-[10.5px] uppercase tracking-[0.12em] text-accent/90 transition hover:text-accent-soft"
                >
                  <LocateFixed className="size-3" /> Jump to text
                </button>
              )}
            </div>
          )}

          <p className="mt-1.5 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-ink-100">{comment.body}</p>

          <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted">
            {!comment.pending && canReply && (
              <button
                type="button"
                onClick={() => setReplying((r) => !r)}
                className="inline-flex items-center gap-1 transition hover:text-muted-strong"
              >
                <Reply className="size-3" /> Reply
              </button>
            )}
            {replies.length > 0 && (
              <span className="inline-flex items-center gap-1 text-muted/80">
                <CornerDownRight className="size-3" /> {replies.length} {replies.length === 1 ? "reply" : "replies"}
              </span>
            )}
            {!comment.pending && !comment.resolved && canResolve && (
              <button
                type="button"
                onClick={() => onResolve(comment, true)}
                className="ml-auto inline-flex items-center gap-1 text-muted/70 transition hover:text-sage"
              >
                <Check className="size-3" /> Resolve
              </button>
            )}
          </div>

          {replies.length > 0 && (
            <ol className="mt-2 space-y-2 border-l border-border pl-3">
              {replies.map((reply) => (
                <li key={reply.id} className={cn("group/reply", reply.pending && "opacity-70")}>
                  <div className="flex items-center gap-1.5">
                    <Avatar name={reply.author?.display_name} src={reply.author?.avatar_url} size={18} />
                    <span className="truncate text-[12px] font-medium text-ink-100">
                      {reply.author?.display_name ?? "Someone"}
                    </span>
                    <span className="text-[10.5px] text-muted/80">
                      {reply.pending ? "sending…" : relativeTime(reply.created_at)}
                    </span>
                    {(reply.author_id === viewerId || canModerate) && !reply.pending && (
                      <button
                        type="button"
                        onClick={() => onDelete(reply)}
                        aria-label="Delete reply"
                        className="ml-auto rounded p-0.5 text-muted/50 opacity-0 transition hover:bg-ink-800 hover:text-red-400 group-hover/reply:opacity-100"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    )}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap break-words pl-[26px] text-[12.5px] leading-relaxed text-ink-200">
                    {reply.body}
                  </p>
                </li>
              ))}
            </ol>
          )}

          {replying && (
            <div className="mt-2">
              <CommentComposer
                compact
                autoFocus
                submitLabel="Reply"
                placeholder={`Reply to ${authorName.split(" ")[0]}…`}
                onCancel={() => setReplying(false)}
                onSubmit={async (body) => {
                  const ok = await onReply(comment, body);
                  if (ok) setReplying(false);
                  return ok;
                }}
              />
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

/** Compact row used by the "anchored to text" index at the top of the rail. */
export function AnchoredCommentRow({
  comment,
  onJump,
  onOpen,
}: {
  comment: CommentRow;
  onJump: (comment: CommentRow) => void;
  onOpen?: (comment: CommentRow) => void;
}) {
  return (
    <li className="flex items-start gap-2 py-1.5">
      <Avatar name={comment.author?.display_name} src={comment.author?.avatar_url} size={18} className="mt-0.5" />
      <button type="button" onClick={() => onOpen?.(comment)} className="min-w-0 flex-1 text-left">
        <p className="truncate font-serif text-[12.5px] italic text-muted-strong">
          “{truncate(comment.quoted_text ?? comment.body, 90)}”
        </p>
        <p className="mt-0.5 truncate text-[11px] text-muted">
          {comment.author?.display_name ?? "Someone"} · {relativeTime(comment.created_at)}
        </p>
      </button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Jump to text"
        onClick={() => onJump(comment)}
        className="mt-0.5 shrink-0 text-muted hover:text-accent"
      >
        <LocateFixed className="size-3.5" />
      </Button>
    </li>
  );
}