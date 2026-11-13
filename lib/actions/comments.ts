"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { getProjectContext } from "@/lib/data";
import { logActivity, notify } from "@/lib/activity";
import { emitWebhookEvent } from "@/lib/webhooks";
import { countWords, markdownToTiptap } from "@/lib/markdown";
import type { CommentAuthor, CommentRow, CommentsResult } from "@/components/comments/types";

const MAX_BODY = 4000;

function authorOf(profile: { id: string; display_name: string | null; avatar_url: string | null; email: string | null } | null | undefined): CommentAuthor | null {
  if (!profile) return null;
  return {
    id: profile.id,
    display_name: profile.display_name,
    avatar_url: profile.avatar_url,
    email: profile.email,
  };
}

/** Webhooks are best-effort: a dead endpoint must not stall a comment save. */
async function webhook(event: "comment.created", projectId: string, data: Record<string, unknown>) {
  try {
    await Promise.race([
      emitWebhookEvent(event, projectId, data),
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ]);
  } catch {
    // ignore — delivery is logged server-side by lib/webhooks
  }
}

export async function listChapterComments(chapterId: string): Promise<CommentsResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sign in to read comments.", comments: [], viewer: null };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("comments")
    .select("*")
    .eq("chapter_id", chapterId)
    .order("created_at", { ascending: true });

  if (error) return { ok: false, error: error.message, comments: [], viewer: null };

  const rows = (data ?? []) as CommentRow[];
  const authorIds = Array.from(new Set(rows.map((r) => r.author_id).filter((id): id is string => !!id)));

  const [{ data: profiles }, { data: me }, { data: chapterRow }] = await Promise.all([
    authorIds.length
      ? supabase.from("profiles").select("id, display_name, avatar_url, email").in("id", authorIds)
      : Promise.resolve({ data: [] as CommentAuthor[] }),
    supabase.from("profiles").select("id, display_name, avatar_url, email").eq("id", user.id).maybeSingle(),
    supabase.from("chapters").select("project_id").eq("id", chapterId).maybeSingle(),
  ]);

  let canModerate = false;
  let canComment = false;
  if (chapterRow?.project_id) {
    try {
      const ctx = await getProjectContext(chapterRow.project_id as string);
      canModerate = ctx.canEdit;
      canComment = ctx.canComment;
    } catch {
      canModerate = false;
      canComment = false;
    }
  }

  const byId = new Map<string, CommentAuthor>();
  for (const p of (profiles ?? []) as CommentAuthor[]) byId.set(p.id, p);

  const comments = rows.map((r) => ({ ...r, author: r.author_id ? byId.get(r.author_id) ?? null : null }));
  const viewer =
    authorOf(me as CommentAuthor | null) ?? {
      id: user.id,
      display_name: (user.user_metadata?.display_name as string) ?? user.email?.split("@")[0] ?? "Writer",
      avatar_url: (user.user_metadata?.avatar_url as string) ?? null,
      email: user.email ?? null,
    };

  return { ok: true, comments, viewer, canModerate, canComment };
}

export interface CreateCommentInput {
  projectId: string;
  chapterId: string;
  body: string;
  parentId?: string | null;
  anchorStart?: number | null;
  anchorEnd?: number | null;
  quotedText?: string | null;
}

export async function createComment(
  input: CreateCommentInput,
): Promise<{ ok: boolean; error?: string; comment?: CommentRow }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sign in to comment." };

  const body = (input.body ?? "").trim();
  if (!body) return { ok: false, error: "Write something first." };
  if (body.length > MAX_BODY) return { ok: false, error: `Keep comments under ${MAX_BODY} characters.` };

  let ctx: Awaited<ReturnType<typeof getProjectContext>> | null = null;
  try {
    ctx = await getProjectContext(input.projectId);
  } catch {
    ctx = null;
  }
  if (!ctx) return { ok: false, error: "You do not have access to this project." };
  if (!ctx.canComment) return { ok: false, error: "Viewers can read comments but not post them." };

  const supabase = await createClient();

  const { data: chapter } = await supabase
    .from("chapters")
    .select("id, title, project_id")
    .eq("id", input.chapterId)
    .maybeSingle();
  if (!chapter || chapter.project_id !== input.projectId) return { ok: false, error: "That chapter is not in this project." };

  let parent: { id: string; chapter_id: string; author_id: string | null; parent_id: string | null } | null = null;
  if (input.parentId) {
    const { data } = await supabase
      .from("comments")
      .select("id, chapter_id, author_id, parent_id")
      .eq("id", input.parentId)
      .maybeSingle();
    if (!data || data.chapter_id !== input.chapterId) return { ok: false, error: "That thread no longer exists." };
    parent = data;
  }

  const anchorStart =
    typeof input.anchorStart === "number" && Number.isFinite(input.anchorStart) ? Math.max(0, Math.trunc(input.anchorStart)) : null;
  const anchorEnd =
    typeof input.anchorEnd === "number" && Number.isFinite(input.anchorEnd) ? Math.max(0, Math.trunc(input.anchorEnd)) : null;
  const quoted = input.quotedText?.trim() ? input.quotedText.trim().slice(0, 500) : null;

  const { data: inserted, error } = await supabase
    .from("comments")
    .insert({
      project_id: input.projectId,
      chapter_id: input.chapterId,
      author_id: user.id,
      parent_id: parent?.id ?? null,
      body,
      anchor_start: anchorStart,
      anchor_end: anchorEnd,
      quoted_text: quoted,
      resolved: false,
    })
    .select("*")
    .single();

  if (error || !inserted) return { ok: false, error: error?.message ?? "Could not save the comment." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, email")
    .eq("id", user.id)
    .maybeSingle();

  const comment: CommentRow = { ...(inserted as CommentRow), author: authorOf(profile), pending: false };
  const actor = comment.author?.display_name ?? "A collaborator";

  // Activity + notifications: owner, previous commenters, and the parent author.
  await logActivity({
    projectId: input.projectId,
    action: parent ? "comment.replied" : "comment.created",
    targetType: "comment",
    targetId: comment.id,
    summary: parent ? `replied in a thread on “${chapter.title}”` : `commented on “${chapter.title}”`,
  });

  const { data: thread } = await supabase.from("comments").select("author_id").eq("chapter_id", input.chapterId);
  const recipients = new Set<string>();
  if (ctx.project.owner_id !== user.id) recipients.add(ctx.project.owner_id);
  for (const row of thread ?? []) {
    if (row.author_id && row.author_id !== user.id) recipients.add(row.author_id);
  }

  const excerpt = body.length > 140 ? `${body.slice(0, 139).trimEnd()}…` : body;
  const link = `/app/projects/${input.projectId}/editor/${input.chapterId}#comment-${comment.id}`;
  await Promise.all(
    Array.from(recipients).map((userId) =>
      notify({
        userId,
        projectId: input.projectId,
        kind: parent ? "reply" : "comment",
        title: parent ? `${actor} replied in “${chapter.title}”` : `${actor} commented on “${chapter.title}”`,
        body: excerpt,
        link,
      }),
    ),
  );

  await webhook("comment.created", input.projectId, {
    comment_id: comment.id,
    chapter_id: input.chapterId,
    parent_id: comment.parent_id,
    author_id: user.id,
    body,
    quoted_text: quoted,
    anchor_start: anchorStart,
    anchor_end: anchorEnd,
  });

  revalidatePath(`/app/projects/${input.projectId}/editor/${input.chapterId}`);
  return { ok: true, comment };
}

export async function setCommentResolved(
  commentId: string,
  resolved: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sign in first." };

  const supabase = await createClient();
  const { data: comment } = await supabase
    .from("comments")
    .select("id, project_id, chapter_id, author_id, parent_id")
    .eq("id", commentId)
    .maybeSingle();
  if (!comment) return { ok: false, error: "That comment no longer exists." };

  let ctx: Awaited<ReturnType<typeof getProjectContext>> | null = null;
  try {
    ctx = await getProjectContext(comment.project_id);
  } catch {
    ctx = null;
  }
  if (!ctx) return { ok: false, error: "You do not have access to this project." };

  const { error } = await supabase.from("comments").update({ resolved }).eq("id", commentId);
  if (error) return { ok: false, error: error.message };

  if (!comment.parent_id) {
    // Resolving a thread resolves its replies so the collapsed state is honest.
    await supabase.from("comments").update({ resolved }).eq("parent_id", commentId);
  }

  await logActivity({
    projectId: comment.project_id,
    action: resolved ? "comment.resolved" : "comment.reopened",
    targetType: "comment",
    targetId: commentId,
  });

  revalidatePath(`/app/projects/${comment.project_id}/editor/${comment.chapter_id}`);
  return { ok: true };
}

export async function deleteComment(commentId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sign in first." };

  const supabase = await createClient();
  const { data: comment } = await supabase
    .from("comments")
    .select("id, project_id, chapter_id, author_id, parent_id")
    .eq("id", commentId)
    .maybeSingle();
  if (!comment) return { ok: false, error: "That comment no longer exists." };

  let ctx: Awaited<ReturnType<typeof getProjectContext>> | null = null;
  try {
    ctx = await getProjectContext(comment.project_id);
  } catch {
    ctx = null;
  }
  if (!ctx) return { ok: false, error: "You do not have access to this project." };

  const mine = comment.author_id === user.id;
  if (!mine && !ctx.canEdit) return { ok: false, error: "You can only delete your own comments." };

  const { error } = await supabase.from("comments").delete().eq("id", commentId);
  if (error) return { ok: false, error: error.message };

  await logActivity({
    projectId: comment.project_id,
    action: "comment.deleted",
    targetType: "comment",
    targetId: commentId,
  });

  revalidatePath(`/app/projects/${comment.project_id}/editor/${comment.chapter_id}`);
  return { ok: true };
}

/**
 * Change tracking: writes a reviewed plain-text/markdown revision back to the
 * chapter (TipTap JSON derived from markdown) and records a manual version.
 */
export async function saveChapterRevision(input: {
  projectId: string;
  chapterId: string;
  markdown: string;
  label?: string;
}): Promise<{ ok: boolean; error?: string; wordCount?: number }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sign in first." };

  let ctx: Awaited<ReturnType<typeof getProjectContext>> | null = null;
  try {
    ctx = await getProjectContext(input.projectId);
  } catch {
    ctx = null;
  }
  if (!ctx) return { ok: false, error: "You do not have access to this project." };
  if (!ctx.canEdit) return { ok: false, error: "Only editors and the owner can apply edits." };

  const supabase = await createClient();
  const { data: chapter } = await supabase
    .from("chapters")
    .select("id, project_id, content_md")
    .eq("id", input.chapterId)
    .maybeSingle();
  if (!chapter || chapter.project_id !== input.projectId) return { ok: false, error: "That chapter is not in this project." };

  const markdown = input.markdown.replace(/\r\n/g, "\n");
  if (markdown.trim() === (chapter.content_md ?? "").trim()) {
    return { ok: false, error: "Nothing to apply — the chapter already matches." };
  }

  const doc = markdownToTiptap(markdown);
  const { error } = await supabase
    .from("chapters")
    .update({ content: doc, content_md: markdown })
    .eq("id", input.chapterId);
  if (error) return { ok: false, error: error.message };

  // Explicit snapshot so the review has a durable marker in History.
  await supabase.from("chapter_versions").insert({
    chapter_id: input.chapterId,
    content: doc,
    content_md: markdown,
    word_count: countWords(markdown),
    saved_by: user.id,
    kind: "manual",
    label: input.label?.slice(0, 80) || "Accepted suggested edits",
  });

  await logActivity({
    projectId: input.projectId,
    action: "chapter.reviewed",
    targetType: "chapter",
    targetId: input.chapterId,
    summary: input.label ? `accepted edits (${input.label})` : "accepted suggested edits",
  });

  revalidatePath(`/app/projects/${input.projectId}/settings/history`);
  revalidatePath(`/app/projects/${input.projectId}/editor/${input.chapterId}`);
  return { ok: true, wordCount: countWords(markdown) };
}
