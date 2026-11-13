import type { Asset, Chapter, StoryboardCard } from "@/lib/types";
import type { StoryboardAsset, StoryboardCardModel } from "./types";

/**
 * Builds the display model for both boards.
 *
 * Only top-level chapters get cards (parts are structural). Order is
 * storyboard_cards.position first, then chapters.position for chapters that
 * have no card row yet — so a freshly added chapter lands where the outline
 * says it should.
 */
export function buildStoryboardModels(
  chapters: Chapter[],
  cards: StoryboardCard[],
  projectId: string,
): StoryboardCardModel[] {
  const cardByChapter = new Map(cards.map((card) => [card.chapter_id, card]));
  const topLevel = chapters.filter((chapter) => !chapter.parent_id);

  const ordered = [...topLevel].sort((a, b) => {
    const cardA = cardByChapter.get(a.id);
    const cardB = cardByChapter.get(b.id);
    const posA = cardA?.position ?? a.position ?? 0;
    const posB = cardB?.position ?? b.position ?? 0;
    if (posA !== posB) return posA - posB;
    return (a.position ?? 0) - (b.position ?? 0);
  });

  return ordered.map((chapter, index) => {
    const card = cardByChapter.get(chapter.id);
    return {
      chapterId: chapter.id,
      cardId: card?.id ?? null,
      number: index + 1,
      position: card?.position ?? chapter.position ?? index,
      title: chapter.title,
      synopsis: chapter.synopsis,
      status: chapter.status,
      wordCount: chapter.word_count ?? 0,
      primaryImageId: card?.primary_image_id ?? null,
      moodImageIds: card?.mood_image_ids ?? [],
      notes: card?.notes ?? null,
      pov: chapter.pov,
      arc: chapter.arc,
      subplot: chapter.subplot,
      href: `/app/projects/${projectId}/editor/${chapter.id}`,
    };
  });
}

export function toStoryboardAssets(assets: Asset[]): StoryboardAsset[] {
  return assets
    .filter((asset) => asset.public_url && (asset.mime_type ?? "").startsWith("image/"))
    .map((asset) => ({
      id: asset.id,
      url: asset.public_url as string,
      filename: asset.filename,
      width: asset.width,
      height: asset.height,
      alt: asset.alt_text,
    }));
}

export function assetIndex(assets: StoryboardAsset[]): Map<string, StoryboardAsset> {
  return new Map(assets.map((asset) => [asset.id, asset]));
}

export function totalWords(cards: StoryboardCardModel[]): number {
  return cards.reduce((sum, card) => sum + (card.wordCount ?? 0), 0);
}

export function padChapterNumber(number: number): string {
  return String(Math.max(0, number)).padStart(2, "0");
}
