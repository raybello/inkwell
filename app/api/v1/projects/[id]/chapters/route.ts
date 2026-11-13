import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withApi, json, apiError } from "@/lib/api/respond";
import { authorize } from "@/lib/api/auth";
import { createChapterSchema } from "@/lib/api/schemas";
import { getApiProject } from "@/lib/api/projects";
import {
  asDoc,
  buildChapterTree,
  nodesFromText,
  toMarkdown,
} from "@/lib/api/content";
import { serializeChapter, serializeChapterSummary } from "@/lib/api/serialize";
import { validateBody } from "@/lib/api/validate";
import { emitWebhookEvent } from "@/lib/webhooks";
import type { Chapter } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withApi<Ctx>(async (request: NextRequest, ctx, meta) => {
  const auth = await authorize(request, meta, "chapters:read");
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const access = await getApiProject(auth.auth, id, "read");
  if (!access.ok) return apiError(access.status, access.code, access.message, undefined, auth.meta);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("chapters")
    .select("*")
    .eq("project_id", id)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return apiError(500, "internal_error", error.message, undefined, auth.meta);

  const chapters = (data ?? []) as Chapter[];
  const format = request.nextUrl.searchParams.get("format") ?? "tree";

  if (format === "flat") {
    return json({ data: chapters.map((chapter) => serializeChapterSummary(chapter)), count: chapters.length }, auth.meta);
  }
  if (format !== "tree") {
    return apiError(422, "validation_error", "`format` must be `tree` or `flat`.", undefined, auth.meta);
  }

  return json({ data: buildChapterTree(chapters), count: chapters.length }, auth.meta);
});

export const POST = withApi<Ctx>(async (request: NextRequest, ctx, meta) => {
  const auth = await authorize(request, meta, "chapters:write");
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const access = await getApiProject(auth.auth, id, "write");
  if (!access.ok) return apiError(access.status, access.code, access.message, undefined, auth.meta);

  const body = await validateBody(request, createChapterSchema, auth.meta);
  if (!body.ok) return body.response;

  const admin = createAdminClient();

  if (body.data.parent_id) {
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

  let position = body.data.position;
  if (position === undefined) {
    const { data: siblings } = await admin
      .from("chapters")
      .select("position")
      .eq("project_id", id)
      .is("parent_id", body.data.parent_id ?? null)
      .order("position", { ascending: false })
      .limit(1);
    position = siblings?.length ? ((siblings[0] as { position: number }).position ?? 0) + 1 : 0;
  }

  const doc = body.data.content
    ? asDoc(body.data.content)
    : body.data.content_md
      ? asDoc({ type: "doc", content: nodesFromText(body.data.content_md, "markdown") })
      : asDoc(null);
  const contentMd = body.data.content_md ?? toMarkdown(doc);
  const hasBody = Boolean(body.data.content || (body.data.content_md && body.data.content_md.trim()));

  const { data, error } = await admin
    .from("chapters")
    .insert({
      project_id: id,
      parent_id: body.data.parent_id ?? null,
      title: body.data.title,
      synopsis: body.data.synopsis ?? null,
      status: body.data.status ?? "draft",
      position,
      pov: body.data.pov ?? null,
      tags: body.data.tags ?? [],
      notes: body.data.notes ?? null,
      content: hasBody ? doc : null,
      content_md: contentMd,
    })
    .select("*")
    .single<Chapter>();

  if (error || !data) {
    return apiError(500, "internal_error", error?.message ?? "Could not create chapter.", undefined, auth.meta);
  }

  void emitWebhookEvent("chapter.created", id, {
    id: data.id,
    title: data.title,
    parent_id: data.parent_id,
    position: data.position,
    status: data.status,
    word_count: data.word_count,
  }).catch(() => undefined);

  return json({ data: serializeChapter(data) }, auth.meta, {
    status: 201,
    headers: { Location: `/api/v1/projects/${id}/chapters/${data.id}` },
  });
});
