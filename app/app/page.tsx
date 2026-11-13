import Link from "next/link";
import { BookOpen, LayoutGrid, List, Plus, Sparkles } from "lucide-react";
import { listProjects } from "@/lib/data";
import { getProfile } from "@/lib/auth";
import { formatNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LibraryView } from "@/components/projects/library-view";

export const metadata = { title: "Library" };

export default async function LibraryPage() {
  const [projects, profile] = await Promise.all([listProjects(), getProfile()]);
  const totalWords = projects.reduce((s, p) => s + p.wordCount, 0);
  const chapters = projects.reduce((s, p) => s + p.chapterCount, 0);
  const firstName = (profile?.display_name ?? "Writer").split(" ")[0];

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 md:px-10">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-accent">Library</p>
          <h1 className="mt-2 font-serif text-4xl font-semibold tracking-[-0.02em]">
            Evening, {firstName}.
          </h1>
          <p className="mt-2 max-w-md text-sm text-muted">
            {projects.length === 0
              ? "Every book starts with one sentence. Let's get it down."
              : `${formatNumber(totalWords)} words across ${chapters} chapters. Pick up a thread.`}
          </p>
        </div>
        <Link href="/app/projects/new">
          <Button variant="primary" size="lg">
            <Plus /> New project
          </Button>
        </Link>
      </div>

      <div className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
        {[
          { label: "Projects", value: formatNumber(projects.length) },
          { label: "Chapters", value: formatNumber(chapters) },
          { label: "Words written", value: formatNumber(totalWords) },
          {
            label: "Last edited",
            value:
              projects[0]?.updated_at
                ? new Date(projects[0].updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                : "—",
          },
        ].map((s) => (
          <div key={s.label} className="bg-card px-5 py-4">
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted">{s.label}</p>
            <p className="mt-1 font-serif text-2xl">{s.value}</p>
          </div>
        ))}
      </div>

      {projects.length === 0 ? (
        <div className="mt-12 overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <div className="flex size-14 items-center justify-center rounded-full border border-accent/25 bg-accent/10 text-accent">
              <BookOpen className="size-6" />
            </div>
            <h2 className="mt-5 font-serif text-2xl">The blank shelf</h2>
            <p className="mt-2 max-w-sm text-sm text-muted">
              Create a project and Inkwell sets up your chapters, outline, storyboard and export
              pipeline in one go.
            </p>
            <Link href="/app/projects/new" className="mt-6">
              <Button variant="primary" size="lg">
                <Plus /> Create your first project
              </Button>
            </Link>
            <p className="mt-6 flex items-center gap-1.5 text-[11px] text-muted">
              <Sparkles className="size-3 text-accent" /> Free plan includes one full project.
            </p>
          </div>
        </div>
      ) : (
        <LibraryView projects={projects} />
      )}
    </div>
  );
}
