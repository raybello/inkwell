"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid, List, Search } from "lucide-react";
import { toast } from "sonner";
import { ProjectCard } from "@/components/projects/project-card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Select } from "@/components/ui/input";
import { Tabs } from "@/components/ui/misc";
import { duplicateProjectAction, deleteProjectAction } from "@/lib/actions/projects";
import type { ProjectSummary } from "@/lib/data";

export function LibraryView({ projects }: { projects: ProjectSummary[] }) {
  const router = useRouter();
  const [view, setView] = React.useState<"grid" | "list">("grid");
  const [sort, setSort] = React.useState("modified");
  const [type, setType] = React.useState("all");
  const [q, setQ] = React.useState("");
  const [deleting, setDeleting] = React.useState<ProjectSummary | null>(null);
  const [pending, setPending] = React.useState(false);

  const filtered = React.useMemo(() => {
    let list = [...projects];
    if (type !== "all") list = list.filter((p) => p.type === type);
    if (q.trim())
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q.toLowerCase()) ||
          (p.genre ?? "").toLowerCase().includes(q.toLowerCase()),
      );
    list.sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "words") return b.wordCount - a.wordCount;
      if (sort === "chapters") return b.chapterCount - a.chapterCount;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
    return list;
  }, [projects, type, q, sort]);

  return (
    <div className="mt-8">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 md:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter projects…"
            className="h-8 pl-8 text-[13px]"
          />
        </div>
        <Select value={type} onChange={(e) => setType(e.target.value)} className="h-8 w-auto text-[13px]">
          <option value="all">All types</option>
          <option value="book">Books</option>
          <option value="ebook">E-books</option>
          <option value="article">Articles</option>
          <option value="blog">Blogs</option>
          <option value="custom">Custom</option>
        </Select>
        <Select value={sort} onChange={(e) => setSort(e.target.value)} className="h-8 w-auto text-[13px]">
          <option value="modified">Last modified</option>
          <option value="title">Title A–Z</option>
          <option value="words">Most words</option>
          <option value="chapters">Most chapters</option>
        </Select>
        <div className="ml-auto flex items-center gap-1 rounded-md border border-border p-0.5">
          <button
            onClick={() => setView("grid")}
            className={`rounded p-1 ${view === "grid" ? "bg-ink-750 text-foreground" : "text-muted"}`}
            aria-label="Grid view"
          >
            <LayoutGrid className="size-3.5" />
          </button>
          <button
            onClick={() => setView("list")}
            className={`rounded p-1 ${view === "list" ? "bg-ink-750 text-foreground" : "text-muted"}`}
            aria-label="List view"
          >
            <List className="size-3.5" />
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-border bg-card px-4 py-10 text-center text-sm text-muted">
          Nothing matches “{q}”.
        </p>
      ) : (
        <div className={view === "grid" ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "space-y-2"}>
          {filtered.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              view={view}
              canManage={p.role === "owner"}
              onDuplicate={(id) => {
                toast.promise(duplicateProjectAction(id), {
                  loading: "Duplicating…",
                  success: "Project duplicated",
                  error: "Could not duplicate",
                });
              }}
              onDelete={setDeleting}
            />
          ))}
        </div>
      )}

      <Dialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete project?"
        description={`“${deleting?.title}” and all of its chapters, assets and versions will be removed.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button
              variant="danger"
              loading={pending}
              onClick={async () => {
                if (!deleting) return;
                setPending(true);
                await deleteProjectAction(deleting.id);
                setPending(false);
                setDeleting(null);
                toast.success("Project deleted");
                router.refresh();
              }}
            >
              Delete permanently
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">This cannot be undone. Export first if you need a backup.</p>
      </Dialog>
    </div>
  );
}
