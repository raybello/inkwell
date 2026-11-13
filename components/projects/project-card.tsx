"use client";

import Link from "next/link";
import { BookOpen, FileText, MoreHorizontal, PenLine, Trash2, Copy, Image as ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dropdown, DropdownItem, DropdownSeparator } from "@/components/ui/dropdown";
import { cn, formatNumber, relativeTime } from "@/lib/utils";
import type { ProjectSummary } from "@/lib/data";

const TYPE_LABEL: Record<string, string> = {
  book: "Book",
  ebook: "E-book",
  article: "Article",
  blog: "Blog",
  custom: "Project",
};

export function ProjectCard({
  project,
  view,
  onDuplicate,
  onDelete,
}: {
  project: ProjectSummary;
  view: "grid" | "list";
  onDuplicate: (id: string) => void;
  onDelete: (project: ProjectSummary) => void;
}) {
  const progress =
    project.target_word_count && project.target_word_count > 0
      ? Math.round((project.wordCount / project.target_word_count) * 100)
      : null;

  const meta = (
    <div className="flex items-center gap-2 text-[11px] text-muted">
      <span className="inline-flex items-center gap-1">
        <FileText className="size-3" /> {formatNumber(project.chapterCount)} ch
      </span>
      <span>·</span>
      <span>{formatNumber(project.wordCount)} words</span>
      {progress !== null && (
        <>
          <span>·</span>
          <span className={progress >= 100 ? "text-sage" : ""}>{progress}%</span>
        </>
      )}
    </div>
  );

  const menu = (
    <Dropdown
      trigger={
        <button className="rounded-md p-1.5 text-muted opacity-0 transition group-hover:opacity-100 hover:bg-ink-750 hover:text-foreground">
          <MoreHorizontal className="size-4" />
        </button>
      }
    >
      {(close) => (
        <>
          <DropdownItem icon={<PenLine />} onClick={() => (window.location.href = `/app/projects/${project.id}`)}>
            Open project
          </DropdownItem>
          <DropdownItem
            icon={<Copy />}
            onClick={() => {
              close();
              onDuplicate(project.id);
            }}
          >
            Duplicate
          </DropdownItem>
          <DropdownSeparator />
          <DropdownItem
            icon={<Trash2 />}
            danger
            onClick={() => {
              close();
              onDelete(project);
            }}
          >
            Delete project
          </DropdownItem>
        </>
      )}
    </Dropdown>
  );

  if (view === "list") {
    return (
      <div className="group flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3 transition hover:border-border-strong hover:bg-card-hover">
        <Link href={`/app/projects/${project.id}`} className="flex min-w-0 flex-1 items-center gap-4">
          <Cover project={project} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate font-medium">{project.title}</p>
              <Badge>{TYPE_LABEL[project.type]}</Badge>
            </div>
            <div className="mt-1 flex items-center gap-2">
              {meta}
              <span className="text-[11px] text-muted/60">· {relativeTime(project.updated_at)}</span>
            </div>
          </div>
        </Link>
        {menu}
      </div>
    );
  }

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition hover:border-border-strong hover:bg-card-hover">
      <Link href={`/app/projects/${project.id}`} className="block">
        <div className="relative aspect-[3/2] overflow-hidden border-b border-border bg-ink-850">
          {project.cover_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={project.cover_image_url}
              alt=""
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-[radial-gradient(120%_100%_at_50%_0%,rgba(200,129,74,0.14),transparent_70%)]">
              <div className="text-center">
                <p className="mx-auto max-w-[80%] font-serif text-xl leading-tight text-ink-200">{project.title}</p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted">
                  {project.genre ?? TYPE_LABEL[project.type]}
                </p>
              </div>
            </div>
          )}
        </div>
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/app/projects/${project.id}`} className="min-w-0 flex-1">
            <p className="truncate font-medium leading-tight">{project.title}</p>
            <p className="mt-0.5 truncate text-[12px] text-muted">
              {project.subtitle || project.genre || TYPE_LABEL[project.type]}
            </p>
          </Link>
          {menu}
        </div>
        <div className="mt-auto flex items-center justify-between">
          {meta}
          <span className="text-[11px] text-muted/60">{relativeTime(project.updated_at)}</span>
        </div>
        {progress !== null && (
          <div className="h-1 w-full overflow-hidden rounded-full bg-ink-750">
            <div
              className={cn("h-full rounded-full", progress >= 100 ? "bg-sage" : "bg-accent")}
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function Cover({ project, size }: { project: ProjectSummary; size: "sm" }) {
  if (project.cover_image_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={project.cover_image_url} alt="" className="size-10 shrink-0 rounded object-cover" />;
  }
  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded border border-border bg-ink-850 text-muted">
      {project.type === "article" || project.type === "blog" ? <ImageIcon className="size-4" /> : <BookOpen className="size-4" />}
    </div>
  );
}
