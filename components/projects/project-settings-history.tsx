"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Camera, Clock, FileClock, GitCompareArrows, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { ChangeTrackingDialog } from "@/components/comments/change-tracking";
import { createChapterVersionAction } from "@/lib/actions/versions";
import { cn, formatDate, formatNumber, relativeTime } from "@/lib/utils";

export interface HistoryChapter {
  id: string;
  title: string;
  content_md: string;
  word_count: number;
}

export interface HistoryVersion {
  id: string;
  chapter_id: string;
  label: string | null;
  kind: "auto" | "manual";
  created_at: string;
  word_count: number;
  author: string | null;
  content_md: string;
}

export function ProjectSettingsHistory({
  projectId,
  chapters,
  versions,
  canEdit,
}: {
  projectId: string;
  chapters: HistoryChapter[];
  versions: HistoryVersion[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const firstWithVersions = chapters.find((c) => versions.some((v) => v.chapter_id === c.id))?.id ?? chapters[0]?.id ?? null;
  const [selected, setSelected] = React.useState<string | null>(firstWithVersions);
  const [reviewing, setReviewing] = React.useState<HistoryVersion | null>(null);
  const [snapshotting, setSnapshotting] = React.useState(false);

  const chapter = chapters.find((c) => c.id === selected) ?? null;
  const chapterVersions = React.useMemo(
    () =>
      versions
        .filter((v) => v.chapter_id === selected)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [versions, selected],
  );

  async function snapshot() {
    if (!chapter) return;
    setSnapshotting(true);
    const res = await createChapterVersionAction(chapter.id, "Manual snapshot");
    setSnapshotting(false);
    if (!res.ok) {
      toast.error(res.error ?? "Could not record a snapshot.");
      return;
    }
    toast.success("Snapshot recorded");
    router.refresh();
  }

  if (!chapters.length) {
    return (
      <div className="rounded-xl border border-border bg-card">
        <EmptyState
          icon={<FileClock />}
          title="No chapters yet"
          description="Version history follows the manuscript. Create a chapter in the editor and snapshots will appear here."
        />
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="rounded-xl border border-border bg-card p-2">
        <p className="px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted/70">Chapters</p>
        <ul className="space-y-0.5">
          {chapters.map((c) => {
            const count = versions.filter((v) => v.chapter_id === c.id).length;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => setSelected(c.id)}
                  aria-current={selected === c.id ? "true" : undefined}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition",
                    selected === c.id ? "bg-ink-800 text-foreground" : "text-muted-strong hover:bg-ink-850 hover:text-foreground",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{c.title}</span>
                  <span className="shrink-0 font-mono text-[10px] text-muted/70">{count}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <section className="min-w-0 space-y-4">
        {chapter && (
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-serif text-xl leading-tight">{chapter.title}</h2>
              <p className="mt-0.5 text-xs text-muted">
                {formatNumber(chapter.word_count)} words now · {chapterVersions.length} snapshot
                {chapterVersions.length === 1 ? "" : "s"} on file
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="flex items-center gap-1.5 text-[11px] text-muted">
                <Clock className="size-3" /> Snapshots are taken automatically at most every ten minutes of editing.
              </p>
              <Button variant="secondary" size="sm" onClick={() => void snapshot()} loading={snapshotting} disabled={!canEdit}>
                <Camera /> Snapshot now
              </Button>
            </div>
          </div>
        )}

        {chapterVersions.length === 0 ? (
          <div className="rounded-xl border border-border bg-card">
            <EmptyState
              icon={<FileClock />}
              title="No snapshots for this chapter"
              description="Keep writing — Inkwell records a version when the text changes. You can then compare any version with the current draft and accept the changes you want."
              action={
                canEdit ? (
                  <Button variant="secondary" onClick={() => void snapshot()} loading={snapshotting}>
                    <Camera /> Record a snapshot now
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <ol className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {chapterVersions.map((version) => (
              <li key={version.id} className="flex flex-wrap items-center gap-3 px-4 py-3 transition hover:bg-ink-850/40">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[13px] text-ink-100">
                      {version.label ?? (version.kind === "manual" ? "Manual snapshot" : "Auto snapshot")}
                    </p>
                    <Badge tone={version.kind === "manual" ? "accent" : "neutral"} className="shrink-0">
                      {version.kind}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {relativeTime(version.created_at)} · {formatDate(version.created_at)} ·{" "}
                    {formatNumber(version.word_count)} words{version.author ? ` · ${version.author}` : ""}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!canEdit}
                  title={canEdit ? "Compare with the current draft" : "Only editors and the owner can apply changes"}
                  onClick={() => setReviewing(version)}
                >
                  {canEdit ? <GitCompareArrows /> : <Lock />} Review
                </Button>
              </li>
            ))}
          </ol>
        )}
      </section>

      {chapter && (
        <ChangeTrackingDialog
          open={!!reviewing}
          onOpenChange={(open) => !open && setReviewing(null)}
          projectId={projectId}
          chapterId={chapter.id}
          chapterTitle={chapter.title}
          versionLabel={
            reviewing
              ? `${reviewing.label ?? (reviewing.kind === "manual" ? "Manual snapshot" : "Auto snapshot")} · ${relativeTime(reviewing.created_at)}`
              : "Snapshot"
          }
          base={reviewing?.content_md ?? ""}
          current={chapter.content_md}
          onApplied={() => router.refresh()}
        />
      )}
    </div>
  );
}
