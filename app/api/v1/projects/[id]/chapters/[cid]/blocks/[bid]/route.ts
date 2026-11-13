import type { NextRequest } from "next/server";
import { withApi, json, apiError } from "@/lib/api/respond";
import { authorize } from "@/lib/api/auth";
import { updateBlockSchema } from "@/lib/api/schemas";
import { getApiProject } from "@/lib/api/projects";
import { asDoc, findBlock, replaceBlock } from "@/lib/api/content";
import { loadApiChapter, persistChapterContent } from "@/lib/api/chapters";
import { serializeChapter } from "@/lib/api/serialize";
import { validateBody } from "@/lib/api/validate";
import { emitWebhookEvent } from "@/lib/webhooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; cid: string; bid: string }> };

/**
 * PATCH /api/v1/projects/:id/chapters/:cid/blocks/:bid
 *
 * `bid` is the zero-based block index returned by `GET .../chapters/:cid`
 * (`blocks[].bid`), or an `attrs.id` / `attrs.blockId` if the document has one.
 */
export const PATCH = withApi<Ctx>(async (request: NextRequest, ctx, meta) => {
  const auth = await authorize(request, meta, "chapters:write");
  if (!auth.ok) return auth.response;

  const { id, cid, bid } = await ctx.params;
  const access = await getApiProject(auth.auth, id, "write");
  if (!access.ok) return apiError(access.status, access.code, access.message, undefined, auth.meta);

  const body = await validateBody(request, updateBlockSchema, auth.meta);
  if (!body.ok) return body.response;

  const chapter = await loadApiChapter(id, cid);
  if (!chapter) return apiError(404, "not_found", "Chapter not found.", undefined, auth.meta);

  const doc = asDoc(chapter.content);
  const index = findBlock(doc, bid);
  if (index < 0) {
    return apiError(404, "not_found", `Block "${bid}" was not found in this chapter.`, undefined, auth.meta);
  }

  const updatedDoc = replaceBlock(doc, index, {
    text: body.data.text,
    attrs: body.data.attrs,
    type: body.data.type,
  });
  const updated = await persistChapterContent(id, cid, updatedDoc);

  void emitWebhookEvent("chapter.updated", id, {
    id: cid,
    title: updated.title,
    word_count: updated.word_count,
    operation: "block.update",
    block_id: String(index),
  }).catch(() => undefined);

  return json({ data: serializeChapter(updated), block_id: String(index) }, auth.meta);
});
