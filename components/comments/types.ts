import type { Profile } from "@/lib/types";

/** Author shape shipped to the client (a trimmed profile). */
export type CommentAuthor = Pick<Profile, "id" | "display_name" | "avatar_url" | "email">;

export interface CommentRow {
  id: string;
  chapter_id: string;
  project_id: string;
  author_id: string | null;
  parent_id: string | null;
  anchor_start: number | null;
  anchor_end: number | null;
  quoted_text: string | null;
  body: string;
  resolved: boolean;
  created_at: string;
  author?: CommentAuthor | null;
  /** Set on optimistic rows that have not been persisted yet. */
  pending?: boolean;
}

export interface CommentsResult {
  ok: boolean;
  error?: string;
  comments: CommentRow[];
  viewer: CommentAuthor | null;
  /** Owner/editor — may resolve or delete any comment in the project. */
  canModerate?: boolean;
  /** Reviewers and above may post; viewers read only. */
  canComment?: boolean;
}

/**
 * Editor ⇄ comment rail event contract.
 *
 * The editor dispatches `inkwell:comment-request` on `window` when the writer
 * asks to comment on a selection:
 *
 *   window.dispatchEvent(new CustomEvent("inkwell:comment-request", {
 *     detail: { text: selectedPlainText, from: plainTextOffsetStart, to: plainTextOffsetEnd },
 *   }));
 *
 * `from`/`to` are character offsets into the chapter's plain text (the same
 * coordinate space as comments.anchor_start / comments.anchor_end). The panel
 * opens its composer pre-filled with `text` and persists the offsets as
 * anchor_start/anchor_end plus quoted_text.
 *
 * When the writer clicks "Jump to text" on an anchored comment the panel emits:
 *
 *   window.dispatchEvent(new CustomEvent("inkwell:comment-focus", {
 *     detail: { from: anchorStart, to: anchorEnd },
 *   }));
 *
 * which the editor is expected to handle by scrolling to and highlighting that
 * range. Both events are no-ops if the editor does not listen.
 */
export const COMMENT_REQUEST_EVENT = "inkwell:comment-request";
export const COMMENT_FOCUS_EVENT = "inkwell:comment-focus";

export interface CommentRequestDetail {
  text?: string;
  from?: number;
  to?: number;
}

export interface CommentFocusDetail {
  from?: number;
  to?: number;
}

export function requestComment(detail: CommentRequestDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<CommentRequestDetail>(COMMENT_REQUEST_EVENT, { detail }));
}

export function focusCommentAnchor(detail: CommentFocusDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<CommentFocusDetail>(COMMENT_FOCUS_EVENT, { detail }));
}

/** Deterministic accent for a user, used by comment rails and presence. */
export function colourForUser(seed: string): string {
  const palette = ["#c8814a", "#7d9a7e", "#8b6b8f", "#b08a5a", "#6f8f9b", "#a86b62"];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) % 100000;
  return palette[hash % palette.length];
}
