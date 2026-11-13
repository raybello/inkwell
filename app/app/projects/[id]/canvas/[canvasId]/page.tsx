import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProjectContext, listAssets, listChapters } from "@/lib/data";
import { publicAssetUrl } from "@/lib/storage";
import { CanvasBoard, type BoardCanvas } from "@/components/canvas/canvas-board";
import type { CanvasAsset } from "@/components/canvas/asset-drawer";

export const dynamic = "force-dynamic";

export default async function CanvasBoardPage({
  params,
}: {
  params: Promise<{ id: string; canvasId: string }>;
}) {
  const { id, canvasId } = await params;
  const { project, canEdit } = await getProjectContext(id);

  const supabase = await createClient();
  const { data: canvas } = await supabase
    .from("canvases")
    .select("*")
    .eq("id", canvasId)
    .eq("project_id", id)
    .maybeSingle();

  if (!canvas) notFound();

  const [assets, chapters] = await Promise.all([listAssets(id), listChapters(id)]);

  const images: CanvasAsset[] = (assets as Array<Record<string, unknown>>)
    .filter((asset) => {
      const mime = (asset.mime_type as string | null) ?? "";
      return !mime || mime.startsWith("image/");
    })
    .map((asset) => {
      const path = (asset.storage_path as string) ?? "";
      let url = (asset.public_url as string | null) ?? null;
      if (!url && path) {
        try {
          url = publicAssetUrl(path);
        } catch {
          url = null;
        }
      }
      return {
        id: asset.id as string,
        filename: (asset.filename as string) ?? "image",
        url: url ?? "",
        mimeType: (asset.mime_type as string | null) ?? null,
        width: (asset.width as number | null) ?? null,
        height: (asset.height as number | null) ?? null,
      };
    })
    .filter((asset) => asset.url);

  const boardCanvas: BoardCanvas = {
    id: canvas.id as string,
    name: canvas.name as string,
    content: canvas.content,
    updated_at: (canvas.updated_at as string) ?? new Date().toISOString(),
  };

  return (
    <CanvasBoard
      projectId={id}
      projectTitle={project.title}
      canvas={boardCanvas}
      assets={images}
      chapters={chapters.map((chapter) => ({ id: chapter.id, title: chapter.title }))}
      canEdit={canEdit}
    />
  );
}
