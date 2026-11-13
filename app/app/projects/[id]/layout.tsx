import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import { getProjectContext, listChapters } from "@/lib/data";
import { ProjectNav } from "@/components/projects/project-nav";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";
import { ShareButton } from "@/components/projects/share-button";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { project, role, members } = await getProjectContext(id);
  const chapters = await listChapters(id);
  const firstChapterId = (chapters.find((c) => !c.parent_id) ?? chapters[0])?.id ?? null;
  const words = chapters.reduce((s, c) => s + c.word_count, 0);

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
        <div className="flex h-14 items-center gap-3 px-4 pl-12 md:px-6 md:pl-6">
          <Link href="/app" className="rounded-md p-1.5 text-muted hover:bg-ink-800 hover:text-foreground">
            <ArrowLeft className="size-4" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate font-serif text-[15px] font-semibold leading-tight">{project.title}</h1>
              {role !== "owner" && <Badge tone="plum">{role}</Badge>}
            </div>
            <p className="text-[11px] text-muted">
              {formatNumber(chapters.length)} chapters · {formatNumber(words)} words
              {project.target_word_count ? ` · target ${formatNumber(project.target_word_count)}` : ""}
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            {members.length > 1 && (
              <span className="hidden items-center gap-1 text-[11px] text-muted sm:flex">
                <Users className="size-3.5" /> {members.length}
              </span>
            )}
            <ShareButton projectId={id} isPublic={project.is_public} shareToken={project.share_token} />
          </div>
        </div>
        <div className="px-4 pb-1.5 md:px-6">
          <ProjectNav projectId={id} firstChapterId={firstChapterId} />
        </div>
      </header>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
