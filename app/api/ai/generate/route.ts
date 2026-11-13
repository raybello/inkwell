import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withApi, json, apiError } from "@/lib/api/respond";
import { sessionGenerateSchema } from "@/lib/api/schemas";
import { validateBody } from "@/lib/api/validate";
import { AiError, generate, type AiContext } from "@/lib/ai";
import type { Chapter } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/ai/generate — session-authenticated AI action for the editor UI.
 * Body: { projectId, chapterId?, action, selection?, target?, model? }
 */
export const POST = withApi(async (request: NextRequest, _ctx, meta) => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError(401, "unauthorized", "Sign in to use the assistant.", undefined, meta);

  const body = await validateBody(request, sessionGenerateSchema, meta);
  if (!body.ok) return body.response;

  const { projectId, chapterId } = body.data;

  if (!body.data.selection?.trim() && !chapterId) {
    return apiError(
      422,
      "validation_error",
      "Provide `selection` (the text to work on) or a `chapterId` for context.",
      undefined,
      meta,
    );
  }

  const { data: role, error: roleError } = await supabase.rpc("project_role", { p: projectId });
  if (roleError) throw new Error(roleError.message);
  if (!role) return apiError(403, "forbidden", "You do not have access to this project.", undefined, meta);

  const context: AiContext = {};
  if (chapterId) {
    const { data: chapter } = await supabase
      .from("chapters")
      .select("title, synopsis, content_md, project_id")
      .eq("id", chapterId)
      .eq("project_id", projectId)
      .maybeSingle<Pick<Chapter, "title" | "synopsis" | "content_md" | "project_id">>();
    if (!chapter) {
      return apiError(404, "not_found", "Chapter not found.", undefined, meta);
    }
    context.chapterTitle = chapter.title;
    context.synopsis = chapter.synopsis ?? undefined;
    context.excerpt = (chapter.content_md ?? "").slice(0, 6000);
  }

  const { data: project } = await supabase
    .from("projects")
    .select("title")
    .eq("id", projectId)
    .maybeSingle<{ title: string }>();
  if (project?.title) context.projectTitle = project.title;

  try {
    const result = await generate({
      action: body.data.action,
      selection: body.data.selection,
      target: body.data.target,
      model: body.data.model,
      context,
    });
    // Session route (editor UI): flat shape, not the public API envelope.
    return json({ text: result.text, model: result.model, provider: result.provider, usage: result.usage }, meta);
  } catch (error) {
    if (error instanceof AiError) {
      return apiError(error.status, error.code, error.message, undefined, meta);
    }
    throw error;
  }
});
