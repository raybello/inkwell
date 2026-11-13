import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withApi, json, apiError } from "@/lib/api/respond";
import { authorize } from "@/lib/api/auth";
import { pinStoryboardSchema } from "@/lib/api/schemas";
import { getApiProject } from "@/lib/api/projects";
import { validateBody } from "@/lib/api/validate";
import type { Asset, StoryboardCard } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; cid: string }> };

/** POST /api/v1/projects/:id/storyboard/:cid/image — pin an asset to a chapter card. */
export const POST = withApi<Ctx>(async (request: NextRequest, ctx, meta) => {
  const auth = await authorize(request, meta, "storyboard:write");
  if (!auth.ok) return auth.response;

  const { id, cid } = await ctx.params;
  const access = await getApiProject(auth.auth, id, "write");
  if (!access.ok) return apiError(access.status, access.code, access.message, undefined, auth.meta);

  const body = await validateBody(request, pinStoryboardSchema, auth.meta);
  if (!body.ok) return body.response;

  const admin = createAdminClient();
  const { data: chapter } = await admin
    .from("chapters")
    .select("id, title")
    .eq("id", cid)
    .eq("project_id", id)
    .maybeSingle<{ id: string; title: string }>();
  if (!chapter) return apiError(404, "not_found", "Chapter not found.", undefined, auth.meta);

  const { data: asset } = await admin
    .from("assets")
    .select("id, filename, public_url")
    .eq("id", body.data.asset_id)
    .eq("project_id", id)
    .maybeSingle<Pick<Asset, "id" | "filename" | "public_url">>();
  if (!asset) {
    return apiError(422, "validation_error", "`asset_id` does not belong to this project.", undefined, auth.meta);
  }

  const { data: existing } = await admin
    .from("storyboard_cards")
    .select("id, position")
    .eq("project_id", id)
    .eq("chapter_id", cid)
    .maybeSingle<{ id: string; position: number }>();

  let card: StoryboardCard;
  if (existing) {
    const { data, error } = await admin
      .from("storyboard_cards")
      .update({ primary_image_id: asset.id })
      .eq("id", existing.id)
      .select("*")
      .single<StoryboardCard>();
    if (error || !data) {
      return apiError(500, "internal_error", error?.message ?? "Could not pin image.", undefined, auth.meta);
    }
    card = data;
  } else {
    const { data: last } = await admin
      .from("storyboard_cards")
      .select("position")
      .eq("project_id", id)
      .order("position", { ascending: false })
      .limit(1);
    const position = last?.length ? ((last[0] as { position: number }).position ?? 0) + 1 : 0;
    const { data, error } = await admin
      .from("storyboard_cards")
      .insert({
        project_id: id,
        chapter_id: cid,
        primary_image_id: asset.id,
        position,
      })
      .select("*")
      .single<StoryboardCard>();
    if (error || !data) {
      return apiError(500, "internal_error", error?.message ?? "Could not create storyboard card.", undefined, auth.meta);
    }
    card = data;
  }

  return json(
    {
      data: {
        id: card.id,
        chapter_id: card.chapter_id,
        chapter_title: chapter.title,
        position: card.position,
        notes: card.notes,
        color: card.color,
        primary_image: { id: asset.id, url: asset.public_url, filename: asset.filename },
        mood_images: [],
        updated_at: card.updated_at,
      },
    },
    auth.meta,
  );
});

/** DELETE /api/v1/projects/:id/storyboard/:cid/image — unpin the card's image. */
export const DELETE = withApi<Ctx>(async (request: NextRequest, ctx, meta) => {
  const auth = await authorize(request, meta, "storyboard:write");
  if (!auth.ok) return auth.response;

  const { id, cid } = await ctx.params;
  const access = await getApiProject(auth.auth, id, "write");
  if (!access.ok) return apiError(access.status, access.code, access.message, undefined, auth.meta);

  const admin = createAdminClient();
  const { data: card } = await admin
    .from("storyboard_cards")
    .select("id")
    .eq("project_id", id)
    .eq("chapter_id", cid)
    .maybeSingle<{ id: string }>();
  if (!card) return apiError(404, "not_found", "This chapter has no storyboard card.", undefined, auth.meta);

  const { error } = await admin
    .from("storyboard_cards")
    .update({ primary_image_id: null })
    .eq("id", card.id);
  if (error) return apiError(500, "internal_error", error.message, undefined, auth.meta);

  return json({ data: { chapter_id: cid, primary_image_id: null } }, auth.meta);
});
