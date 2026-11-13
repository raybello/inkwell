import { getProjectContext, listAssets } from "@/lib/data";
import { AssetLibrary } from "@/components/assets/asset-library";
import type { Asset } from "@/lib/types";

export default async function AssetsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { project, canEdit } = await getProjectContext(id);
  const assets = (await listAssets(id)) as Asset[];

  return (
    <AssetLibrary
      projectId={id}
      projectTitle={project.title}
      assets={assets}
      coverUrl={project.cover_image_url}
      canEdit={canEdit}
    />
  );
}
