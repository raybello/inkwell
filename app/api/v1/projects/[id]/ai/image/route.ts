import type { NextRequest } from "next/server";
import { withApi, json, apiError } from "@/lib/api/respond";
import { authorize } from "@/lib/api/auth";
import { aiImageSchema } from "@/lib/api/schemas";
import { getApiProject } from "@/lib/api/projects";
import { storeProjectAsset } from "@/lib/api/assets";
import { serializeAsset } from "@/lib/api/serialize";
import { validateBody } from "@/lib/api/validate";
import { AiError, generateImage } from "@/lib/ai";
import { emitWebhookEvent } from "@/lib/webhooks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function filenameFor(prompt: string): string {
  const slug = prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `${slug || "generated-image"}.png`;
}

/**
 * POST /api/v1/projects/:id/ai/image
 *
 * Generates an image with OpenAI and stores it in the project asset library.
 * Returns 501 when no image provider is configured — images are never faked.
 */
export const POST = withApi<Ctx>(async (request: NextRequest, ctx, meta) => {
  const auth = await authorize(request, meta, "ai:write");
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const access = await getApiProject(auth.auth, id, "write");
  if (!access.ok) return apiError(access.status, access.code, access.message, undefined, auth.meta);

  const body = await validateBody(request, aiImageSchema, auth.meta);
  if (!body.ok) return body.response;

  try {
    const image = await generateImage({
      prompt: body.data.prompt,
      size: body.data.size,
      model: body.data.model,
    });

    const asset = await storeProjectAsset({
      projectId: id,
      uploaderId: auth.auth.userId,
      bytes: image.bytes,
      filename: filenameFor(body.data.prompt),
      mimeType: image.mimeType,
      altText: body.data.prompt.slice(0, 1000),
      tags: ["ai-generated"],
      source: "ai",
    });

    void emitWebhookEvent("asset.uploaded", id, {
      id: asset.id,
      filename: asset.filename,
      url: asset.public_url,
      mime_type: asset.mime_type,
      size_bytes: asset.size_bytes,
      source: "ai",
    }).catch(() => undefined);

    return json({ data: serializeAsset(asset), model: image.model }, auth.meta, { status: 201 });
  } catch (error) {
    if (error instanceof AiError) {
      return apiError(error.status, error.code, error.message, undefined, auth.meta);
    }
    throw error;
  }
});
