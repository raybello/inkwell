import { createClient } from "@/lib/supabase/server";
import { getProjectContext } from "@/lib/data";
import { CanvasGallery, type CanvasCardData } from "@/components/canvas/canvas-gallery";
import { canvasPreview, shapeCount } from "@/components/canvas/canvas-preview";

export const dynamic = "force-dynamic";

export default async function CanvasIndexPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { canEdit } = await getProjectContext(id);

  const supabase = await createClient();
  const { data } = await supabase
    .from("canvases")
    .select("id, name, content, thumbnail_url, updated_at")
    .eq("project_id", id)
    .order("updated_at", { ascending: false });

  const canvases: CanvasCardData[] = (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    updatedAt: (row.updated_at as string) ?? new Date().toISOString(),
    preview: canvasPreview(row.content, row.thumbnail_url as string | null),
    shapeCount: shapeCount(row.content),
  }));

  return <CanvasGallery projectId={id} canEdit={canEdit} canvases={canvases} />;
}
