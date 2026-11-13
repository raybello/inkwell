import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withApi, json, apiError } from "@/lib/api/respond";
import { authorize } from "@/lib/api/auth";
import { aiGenerateApiSchema } from "@/lib/api/schemas";
import { getApiProject } from "@/lib/api/projects";
import { validateBody } from "@/lib/api/validate";
import { AiError, generate, type AiContext } from "@/lib/ai";
import type { Chapter } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** POST /api/v1/projects/:id/ai/generate — AI completion through an API key. */
export const POST = withApi<Ctx>(async (request: NextRequest, ctx, meta) => {
  const auth = await authorize(request, meta, "ai:write");
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const access = await getApiProject(auth.auth, id, "read");
  if (!access.ok) return apiError(access.status, access.code, access.message, undefined, auth.meta);

  const body = await validateBody(request, aiGenerateApiSchema, auth.meta);
  if (!body.ok) return body.response;

  const hasInput = Boolean(body.data.selection?.trim() || body.data.prompt?.trim());
  const contextActions = ["continue", "chat", "improve", "summarise"];
  const canUseChapterContext = Boolean(body.data.chapter_id) && contextActions.includes(body.data.action);
  if (!hasInput && !canUseChapterContext) {
    return apiError(
      422,
      "validation_error",
      "Provide `selection` (text to act on) or `prompt` (instruction/premise), or a `chapter_id` for context-based actions.",
      undefined,
      auth.meta,
    );
  }

  const context: AiContext = { projectTitle: access.project.title };
  if (body.data.chapter_id) {
    const admin = createAdminClient();
    const { data: chapter } = await admin
      .from("chapters")
      .select("id, title, synopsis, content_md")
      .eq("id", body.data.chapter_id)
      .eq("project_id", id)
      .maybeSingle<Pick<Chapter, "id" | "title" | "synopsis" | "content_md">>();
    if (!chapter) {
      return apiError(422, "validation_error", "`chapter_id` does not belong to this project.", undefined, auth.meta);
    }
    context.chapterTitle = chapter.title;
    context.synopsis = chapter.synopsis ?? undefined;
    context.excerpt = (chapter.content_md ?? "").slice(0, 6000);
  }

  try {
    const result = await generate({
      action: body.data.action,
      selection: body.data.selection,
      prompt: body.data.prompt,
      target: body.data.target,
      model: body.data.model,
      context,
    });

    return json({ data: result }, auth.meta);
  } catch (error) {
    if (error instanceof AiError) {
      return apiError(error.status, error.code, error.message, undefined, auth.meta);
    }
    throw error;
  }
});
