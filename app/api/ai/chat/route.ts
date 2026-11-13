import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { withApi, apiError } from "@/lib/api/respond";
import { sessionChatSchema } from "@/lib/api/schemas";
import { validateBody } from "@/lib/api/validate";
import { AiError, streamChat, type AiContext } from "@/lib/ai";
import type { Chapter } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/ai/chat — session-authenticated streaming chat.
 *
 * Returns `text/plain` chunks (not SSE). Context = chapter title + synopsis +
 * the first 6,000 characters of `content_md`.
 */
export const POST = withApi(async (request: NextRequest, _ctx, meta) => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return apiError(401, "unauthorized", "Sign in to use the assistant.", undefined, meta);

  const body = await validateBody(request, sessionChatSchema, meta);
  if (!body.ok) return body.response;

  const { projectId, chapterId } = body.data;

  const { data: role, error: roleError } = await supabase.rpc("project_role", { p: projectId });
  if (roleError) throw new Error(roleError.message);
  if (!role) return apiError(403, "forbidden", "You do not have access to this project.", undefined, meta);

  const { data: project } = await supabase
    .from("projects")
    .select("title")
    .eq("id", projectId)
    .maybeSingle<{ title: string }>();

  const context: AiContext = { projectTitle: project?.title };

  if (chapterId) {
    const { data: chapter } = await supabase
      .from("chapters")
      .select("title, synopsis, content_md")
      .eq("id", chapterId)
      .eq("project_id", projectId)
      .maybeSingle<Pick<Chapter, "title" | "synopsis" | "content_md">>();
    if (!chapter) return apiError(404, "not_found", "Chapter not found.", undefined, meta);
    context.chapterTitle = chapter.title;
    context.synopsis = chapter.synopsis ?? undefined;
    context.excerpt = (chapter.content_md ?? "").slice(0, 6000);
  }

  try {
    const { stream, model, provider } = await streamChat({
      messages: body.data.messages,
      context,
      model: body.data.model,
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store, no-transform",
        "X-Accel-Buffering": "no",
        "X-Ai-Model": model,
        "X-Ai-Provider": provider,
        "X-Request-Id": meta.requestId,
      },
    });
  } catch (error) {
    if (error instanceof AiError) {
      return apiError(error.status, error.code, error.message, undefined, meta);
    }
    throw error;
  }
});
