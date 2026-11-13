import { getProjectContext, listAssets } from "@/lib/data";
import { CoverEditor } from "@/components/cover-editor/cover-editor";

export const metadata = { title: "Cover" };

export default async function CoverPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ project, canEdit, profile }, assets] = await Promise.all([
    getProjectContext(id),
    listAssets(id),
  ]);

  const settings = (project.settings ?? {}) as Record<string, unknown>;
  const author =
    (typeof settings.author === "string" && settings.author.trim()) || profile?.display_name || "";

  const images = (assets ?? [])
    .filter((asset) => typeof asset.public_url === "string" && (asset.mime_type ?? "").startsWith("image/"))
    .map((asset) => ({
      id: asset.id as string,
      filename: asset.filename as string,
      url: asset.public_url as string,
      mime: (asset.mime_type as string | null) ?? null,
    }));

  return (
    <div className="mx-auto max-w-[1500px]">
      <CoverEditor
        projectId={id}
        canEdit={canEdit}
        assets={images}
        project={{
          title: project.title,
          subtitle: project.subtitle,
          author,
          description: project.description,
          coverFront: (project as unknown as { cover_front?: unknown }).cover_front ?? null,
          coverBack: (project as unknown as { cover_back?: unknown }).cover_back ?? null,
          coverFrontUrl: (project as unknown as { cover_front_url?: string | null }).cover_front_url ?? null,
          coverBackUrl: (project as unknown as { cover_back_url?: string | null }).cover_back_url ?? null,
        }}
      />
    </div>
  );
}
