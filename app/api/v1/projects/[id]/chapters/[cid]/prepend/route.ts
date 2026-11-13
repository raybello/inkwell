import type { NextRequest } from "next/server";
import { withApi, json, apiError } from "@/lib/api/respond";
import { authorize } from "@/lib/api/auth";
import { appendBlockSchema } from "@/lib/api/schemas";
import { getApiProject } from "@/lib/api/projects";
import { asDoc, insertNodes, nodesFromText, styledNode } from "@/lib/api/content";
import { loadApiChapter, persistChapterContent } from "@/lib/api/chapters";
import { serializeChapter } from "@/lib/api/serialize";
import { validateBody } from "@/lib/api/validate";
import { emitWebhookEvent } from "@/lib/webhooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; cid: string }> };

/** POST /api/v1/projects/:id/chapters/:cid/prepend — prepend a text block. */
export const POST = withApi<Ctx>(async (request: NextRequest, ctx, meta) => {
  const auth = await authorize(request, meta, "chapters:write");
  if (!auth.ok) return auth.response;

  const { id, cid } = await ctx.params;
  const access = await getApiProject(auth.auth, id, "write");
  if (!access.ok) return apiError(access.status, access.code, access.message, undefined, auth.meta);

  const body = await validateBody(request, appendBlockSchema, auth.meta);
  if (!body.ok) return body.response;

  const chapter = await loadApiChapter(id, cid);
  if (!chapter) return apiError(404, "not_found", "Chapter not found.", undefined, auth.meta);

  const nodes =
    body.data.format === "markdown"
      ? nodesFromText(body.data.text, "markdown")
      : [styledNode(body.data.text, body.data.as ?? "paragraph")];

  const doc = insertNodes(asDoc(chapter.content), nodes, "start");
  const updated = await persistChapterContent(id, cid, doc);

  void emitWebhookEvent("chapter.updated", id, {
    id: cid,
    title: updated.title,
    word_count: updated.word_count,
    operation: "prepend",
  }).catch(() => undefined);

  return json({ data: serializeChapter(updated) }, auth.meta);
});
