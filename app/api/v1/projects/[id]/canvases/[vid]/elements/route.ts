import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withApi, json, apiError } from "@/lib/api/respond";
import { authorize } from "@/lib/api/auth";
import { canvasElementSchema } from "@/lib/api/schemas";
import { getApiProject } from "@/lib/api/projects";
import { validateBody } from "@/lib/api/validate";
import type { Canvas } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; vid: string }> };

interface StoredElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  asset_id?: string | null;
  url?: string | null;
  color?: string;
  meta?: Record<string, unknown>;
  created_at: string;
}

/**
 * POST /api/v1/projects/:id/canvases/:vid/elements
 *
 * Elements are appended to `canvases.content.elements`, preserving any other
 * fields the canvas editor stores on the snapshot.
 */
export const POST = withApi<Ctx>(async (request: NextRequest, ctx, meta) => {
  const auth = await authorize(request, meta, "canvases:write");
  if (!auth.ok) return auth.response;

  const { id, vid } = await ctx.params;
  const access = await getApiProject(auth.auth, id, "write");
  if (!access.ok) return apiError(access.status, access.code, access.message, undefined, auth.meta);

  const body = await validateBody(request, canvasElementSchema, auth.meta);
  if (!body.ok) return body.response;

  const admin = createAdminClient();
  const { data: canvas, error } = await admin
    .from("canvases")
    .select("*")
    .eq("id", vid)
    .eq("project_id", id)
    .maybeSingle<Canvas>();
  if (error) throw new Error(error.message);
  if (!canvas) return apiError(404, "not_found", "Canvas not found.", undefined, auth.meta);

  if (body.data.asset_id) {
    const { data: asset } = await admin
      .from("assets")
      .select("id")
      .eq("id", body.data.asset_id)
      .eq("project_id", id)
      .maybeSingle<{ id: string }>();
    if (!asset) {
      return apiError(422, "validation_error", "`asset_id` does not belong to this project.", undefined, auth.meta);
    }
  }

  const element: StoredElement = {
    id: randomUUID(),
    type: body.data.type,
    x: body.data.x,
    y: body.data.y,
    width: body.data.width,
    height: body.data.height,
    text: body.data.text,
    asset_id: body.data.asset_id ?? null,
    url: body.data.url ?? null,
    color: body.data.color,
    meta: body.data.meta,
    created_at: new Date().toISOString(),
  };

  const existing =
    typeof canvas.content === "object" && canvas.content !== null
      ? (canvas.content as Record<string, unknown>)
      : {};
  const elements = Array.isArray(existing.elements) ? [...(existing.elements as unknown[])] : [];
  elements.push(element);
  const content = { ...existing, elements };

  const { error: updateError } = await admin
    .from("canvases")
    .update({ content })
    .eq("id", vid)
    .eq("project_id", id);
  if (updateError) return apiError(500, "internal_error", updateError.message, undefined, auth.meta);

  return json(
    { data: element, canvas_id: vid, element_count: elements.length },
    auth.meta,
    { status: 201 },
  );
});
