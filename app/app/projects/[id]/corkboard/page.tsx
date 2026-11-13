import type { Asset, Chapter, StoryboardCard as StoryboardCardRow } from "@/lib/types";
import { getProjectContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { ensureCards } from "@/lib/actions/storyboard";
import { buildStoryboardModels, toStoryboardAssets } from "@/components/storyboard/model";
import { BoardEmpty } from "@/components/storyboard/board-empty";
import { CorkboardView } from "@/components/storyboard/corkboard-view";

export default async function CorkboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { project, canEdit } = await getProjectContext(id);
  const supabase = await createClient();

  const [{ data: chapterData }, { data: assetData }] = await Promise.all([
    supabase
      .from("chapters")
      .select("*")
      .eq("project_id", id)
      .order("position", { ascending: true }),
    supabase
      .from("assets")
      .select("*")
      .eq("project_id", id)
      .like("mime_type", "image/%")
      .order("created_at", { ascending: false }),
  ]);

  const chapters = (chapterData ?? []) as Chapter[];
  if (!chapters.some((chapter) => !chapter.parent_id)) {
    return <BoardEmpty projectId={id} view="corkboard" />;
  }

  if (canEdit) await ensureCards(id, { revalidate: false });

  const { data: cardData } = await supabase
    .from("storyboard_cards")
    .select("*")
    .eq("project_id", id);

  const cards = buildStoryboardModels(
    chapters,
    (cardData ?? []) as StoryboardCardRow[],
    id,
  );
  const assets = toStoryboardAssets((assetData ?? []) as Asset[]);

  return (
    <CorkboardView
      projectId={id}
      projectTitle={project.title}
      cards={cards}
      assets={assets}
      canEdit={canEdit}
    />
  );
}
