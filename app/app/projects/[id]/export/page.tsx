import { getProjectContext, listChapters } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { ExportWorkbench } from "@/components/export/export-workbench";
import type { ExportJob } from "@/lib/types";

export default async function ExportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { project, canEdit } = await getProjectContext(id);
  const chapters = await listChapters(id);
  const supabase = await createClient();
  const { data: jobs } = await supabase
    .from("export_jobs")
    .select("*")
    .eq("project_id", id)
    .order("created_at", { ascending: false })
    .limit(12);

  const shareUrl = project.is_public && project.share_token ? `/share/${project.share_token}` : null;

  return (
    <ExportWorkbench
      projectId={project.id}
      projectTitle={project.title}
      hasCover={Boolean(project.cover_image_url)}
      chapters={chapters.map((chapter) => ({
        id: chapter.id,
        title: chapter.title,
        wordCount: chapter.word_count,
        position: chapter.position,
      }))}
      initialJobs={(jobs ?? []) as ExportJob[]}
      shareUrl={shareUrl}
      canExport={canEdit}
    />
  );
}
