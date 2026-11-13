import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withApi, json, apiError } from "@/lib/api/respond";
import { authorize } from "@/lib/api/auth";
import { paginationSchema, MAX_ASSET_BYTES } from "@/lib/api/schemas";
import { getApiProject } from "@/lib/api/projects";
import { assertAllowedMime, storeProjectAsset } from "@/lib/api/assets";
import { serializeAsset } from "@/lib/api/serialize";
import { validateQuery } from "@/lib/api/validate";
import { emitWebhookEvent } from "@/lib/webhooks";
import type { Asset } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withApi<Ctx>(async (request: NextRequest, ctx, meta) => {
  const auth = await authorize(request, meta, "assets:read");
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const access = await getApiProject(auth.auth, id, "read");
  if (!access.ok) return apiError(access.status, access.code, access.message, undefined, auth.meta);

  const query = validateQuery(request, paginationSchema, auth.meta);
  if (!query.ok) return query.response;

  const admin = createAdminClient();
  const { data, count, error } = await admin
    .from("assets")
    .select("*", { count: "exact" })
    .eq("project_id", id)
    .order("created_at", { ascending: false })
    .range(query.data.offset, query.data.offset + query.data.limit - 1);

  if (error) return apiError(500, "internal_error", error.message, undefined, auth.meta);

  return json(
    {
      data: ((data ?? []) as Asset[]).map(serializeAsset),
      pagination: { limit: query.data.limit, offset: query.data.offset, total: count ?? 0 },
    },
    auth.meta,
  );
});

/**
 * POST /api/v1/projects/:id/assets — multipart/form-data
 * Fields: `file` (required), `alt_text`, `tags` (comma-separated).
 */
export const POST = withApi<Ctx>(async (request: NextRequest, ctx, meta) => {
  const auth = await authorize(request, meta, "assets:write");
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const access = await getApiProject(auth.auth, id, "write");
  if (!access.ok) return apiError(access.status, access.code, access.message, undefined, auth.meta);

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return apiError(
      415,
      "validation_error",
      "Uploads must be multipart/form-data with a `file` field.",
      undefined,
      auth.meta,
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return apiError(400, "validation_error", "Could not parse multipart body.", undefined, auth.meta);
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return apiError(422, "validation_error", "`file` is required and must be a file field.", undefined, auth.meta);
  }

  if (file.size > MAX_ASSET_BYTES) {
    return apiError(
      413,
      "validation_error",
      `File exceeds the ${Math.round(MAX_ASSET_BYTES / 1024 / 1024)} MB limit.`,
      { size_bytes: file.size },
      auth.meta,
    );
  }

  const mimeType = file.type || "application/octet-stream";
  const mimeError = assertAllowedMime(mimeType);
  if (mimeError) return apiError(415, "validation_error", mimeError, undefined, auth.meta);

  const altText = form.get("alt_text");
  const tagsRaw = form.get("tags");
  const tags =
    typeof tagsRaw === "string"
      ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 20)
      : Array.isArray(tagsRaw)
        ? tagsRaw.filter((t): t is string => typeof t === "string").slice(0, 20)
        : [];

  const asset = await storeProjectAsset({
    projectId: id,
    uploaderId: auth.auth.userId,
    bytes: await file.arrayBuffer(),
    filename: file.name || "upload",
    mimeType,
    altText: typeof altText === "string" && altText.trim() ? altText.trim().slice(0, 1000) : null,
    tags,
    source: "upload",
  });

  void emitWebhookEvent("asset.uploaded", id, {
    id: asset.id,
    filename: asset.filename,
    url: asset.public_url,
    mime_type: asset.mime_type,
    size_bytes: asset.size_bytes,
  }).catch(() => undefined);

  return json(
    { data: serializeAsset(asset) },
    auth.meta,
    { status: 201, headers: { Location: `/api/v1/projects/${id}/assets/${asset.id}` } },
  );
});
