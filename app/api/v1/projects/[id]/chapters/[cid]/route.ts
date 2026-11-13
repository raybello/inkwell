import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withApi, json, apiError, text } from "@/lib/api/respond";
import { authorize } from "@/lib/api/auth";
import { updateChapterSchema } from "@/lib/api/schemas";
import { getApiProject } from "@/lib/api/projects";
import { asDoc, toMarkdown } from "@/lib/api/content";
import { markdownToTiptap } from "@/lib/markdown";
import { serializeChapter } from "@/lib/api/serialize";
import { validateBody } from "@/lib/api/validate";
import { emitWebhookEvent } from "@/lib/webhooks";
import type { Chapter } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; cid: string }> };

async function loadChapter(projectId: string, chapterId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("chapters")
    .select("*")
    .eq("id", chapterId)
    .eq("project_id", projectId)
    .maybeSingle<Chapter>();
  if (error) throw new Error(error.message);
  return data;
}

export const GET = withApi<Ctx>(async (request: NextRequest, ctx, meta) => {
  const auth = await authorize(request, meta, "chapters:read");
  if (!auth.ok) return auth.response;

  const { id, cid } = await ctx.params;
  const access = await getApiProject(auth.auth, id, "read");
  if (!access.ok) return apiError(access.status, access.code, access.message, undefined, auth.meta);

  const chapter = await loadChapter(id, cid);
  if (!chapter) return apiError(404, "not_found", "Chapter not found.", undefined, auth.meta);

  const format = request.nextUrl.searchParams.get("format") ?? "json";
  if (format === "md" || format === "markdown") {
    return text(chapter.content_md ?? "", auth.meta);
  }
  if (format !== "json") {
    return apiError(422, "validation_error", "`format` must be `json` or `md`.", undefined, auth.meta);
  }

  return json({ data: serializeChapter(chapter) }, auth.meta);
});

export const PATCH = withApi<Ctx>(async (request: NextRequest, ctx, meta) => {
  const auth = await authorize(request, meta, "chapters:write");
  if (!auth.ok) return auth.response;

  const { id, cid } = await ctx.params;
  const access = await getApiProject(auth.auth, id, "write");
  if (!access.ok) return apiError(access.status, access.code, access.message, undefined, auth.meta);

  const body = await validateBody(request, updateChapterSchema, auth.meta);
  if (!body.ok) return body.response;

  const chapter = await loadChapter(id, cid);
  if (!chapter) return apiError(404, "not_found", "Chapter not found.", undefined, auth.meta);

  if (body.data.parent_id !== undefined && body.data.parent_id !== null) {
    if (body.data.parent_id === cid) {
      return apiError(422, "validation_error", "A chapter cannot be its own parent.", undefined, auth.meta);
    }
    const admin = createAdminClient();
    const { data: parent } = await admin
      .from("chapters")
      .select("id")
      .eq("id", body.data.parent_id)
      .eq("project_id", id)
      .maybeSingle<{ id: string }>();
    if (!parent) {
      return apiError(422, "validation_error", "`parent_id` does not belong to this project.", undefined, auth.meta);
    }
  }

  const patch: Record<string, unknown> = {};
  const { content, content_md, ...rest } = body.data;
  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined) patch[key] = value;
  }

  if (content !== undefined) {
    const doc = asDoc(content);
    patch.content = doc;
    patch.content_md = toMarkdown(doc);
  } else if (content_md !== undefined) {
    // Markdown input: convert through the shared markdown mirror helpers.
    const converted = asDoc(markdownToTiptap(content_md));
    patch.content = converted;
    patch.content_md = toMarkdown(converted);
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("chapters")
    .update(patch)
    .eq("id", cid)
    .eq("project_id", id)
    .select("*")
    .single<Chapter>();

  if (error || !data) {
    return apiError(500, "internal_error", error?.message ?? "Could not update chapter.", undefined, auth.meta);
  }

  void emitWebhookEvent("chapter.updated", id, {
    id: data.id,
    title: data.title,
    status: data.status,
    word_count: data.word_count,
    fields: Object.keys(patch),
  }).catch(() => undefined);

  return json({ data: serializeChapter(data) }, auth.meta);
});

export const DELETE = withApi<Ctx>(async (request: NextRequest, ctx, meta) => {
  const auth = await authorize(request, meta, "chapters:write");
  if (!auth.ok) return auth.response;

  const { id, cid } = await ctx.params;
  const access = await getApiProject(auth.auth, id, "write");
  if (!access.ok) return apiError(access.status, access.code, access.message, undefined, auth.meta);

  const chapter = await loadChapter(id, cid);
  if (!chapter) return apiError(404, "not_found", "Chapter not found.", undefined, auth.meta);

  const admin = createAdminClient();
  const { error } = await admin.from("chapters").delete().eq("id", cid).eq("project_id", id);
  if (error) return apiError(500, "internal_error", error.message, undefined, auth.meta);

  void emitWebhookEvent("chapter.deleted", id, {
    id: cid,
    title: chapter.title,
    parent_id: chapter.parent_id,
  }).catch(() => undefined);

  return json({ data: { id: cid, deleted: true } }, auth.meta);
});
