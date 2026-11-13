import { createAdminClient } from "@/lib/supabase/admin";
import type { Asset, Chapter, StoryboardCard } from "@/lib/types";

export interface StoryCardView {
  id: string;
  chapter_id: string;
  chapter_title: string | null;
  position: number;
  notes: string | null;
  color: string | null;
  primary_image: { id: string; url: string | null; filename: string } | null;
  mood_images: { id: string; url: string | null; filename: string }[];
  updated_at: string;
}

type AssetRef = Pick<Asset, "id" | "filename" | "public_url">;

/** Storyboard cards for a project, joined with chapter titles and asset URLs. */
export async function listStoryboard(projectId: string): Promise<StoryCardView[]> {
  const admin = createAdminClient();
  const [{ data: cards, error }, { data: chapters }, { data: assets }] = await Promise.all([
    admin
      .from("storyboard_cards")
      .select("*")
      .eq("project_id", projectId)
      .order("position", { ascending: true }),
    admin.from("chapters").select("id, title").eq("project_id", projectId),
    admin.from("assets").select("id, filename, public_url").eq("project_id", projectId),
  ]);
  if (error) throw new Error(error.message);

  const chapterTitles = new Map(
    ((chapters ?? []) as Pick<Chapter, "id" | "title">[]).map((c) => [c.id, c.title]),
  );
  const assetMap = new Map(((assets ?? []) as AssetRef[]).map((a) => [a.id, a]));

  return ((cards ?? []) as StoryboardCard[]).map((card) => {
    const primary = card.primary_image_id ? assetMap.get(card.primary_image_id) : undefined;
    return {
      id: card.id,
      chapter_id: card.chapter_id,
      chapter_title: chapterTitles.get(card.chapter_id) ?? null,
      position: card.position,
      notes: card.notes,
      color: card.color,
      primary_image: primary ? { id: primary.id, url: primary.public_url, filename: primary.filename } : null,
      mood_images: (card.mood_image_ids ?? [])
        .map((id) => assetMap.get(id))
        .filter((a): a is AssetRef => Boolean(a))
        .map((a) => ({ id: a.id, url: a.public_url, filename: a.filename })),
      updated_at: card.updated_at,
    };
  });
}
