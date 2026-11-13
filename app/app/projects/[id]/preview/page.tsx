import { getProjectContext, listChapters } from "@/lib/data";
import { markdownToTiptap, tiptapToHtml } from "@/lib/markdown";
import { normalizeSceneBreaks, stripLeadingTitleHeading } from "@/lib/export/html-parse";
import { PreviewWorkbench } from "@/components/preview/preview-workbench";

export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ chapter?: string }>;
}) {
  const { id } = await params;
  const { chapter: requestedChapter } = await searchParams;
  const { project, profile } = await getProjectContext(id);
  const chapters = await listChapters(id);

  const rendered = chapters.map((chapter) => {
    let html = "";
    try {
      html = tiptapToHtml(chapter.content);
    } catch {
      html = "";
    }
    if (!html.trim() && chapter.content_md) {
      html = tiptapToHtml(markdownToTiptap(chapter.content_md));
    }
    return {
      id: chapter.id,
      title: chapter.title,
      synopsis: chapter.synopsis,
      html: normalizeSceneBreaks(stripLeadingTitleHeading(html, chapter.title)),
      wordCount: chapter.word_count,
    };
  });

  const initialChapterId =
    (requestedChapter && rendered.some((chapter) => chapter.id === requestedChapter) ? requestedChapter : null) ??
    rendered[0]?.id ??
    null;

  return (
    <PreviewWorkbench
      project={{
        title: project.title,
        subtitle: project.subtitle,
        author: profile?.display_name ?? "",
        coverUrl: project.cover_image_url,
        updatedAt: project.updated_at,
      }}
      chapters={rendered}
      initialChapterId={initialChapterId}
    />
  );
}
