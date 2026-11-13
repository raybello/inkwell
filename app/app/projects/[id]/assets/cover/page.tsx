import { getProjectContext } from "@/lib/data";
import { CoverStudio } from "@/components/cover/cover-studio";

export default async function CoverStudioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { project, profile, canEdit } = await getProjectContext(id);

  return (
    <CoverStudio
      projectId={id}
      projectTitle={project.title}
      projectSubtitle={project.subtitle}
      authorName={profile?.display_name ?? null}
      coverUrl={project.cover_image_url}
      canEdit={canEdit}
    />
  );
}
