"use client";

import * as React from "react";
import { Bookmark, History, Loader2, RotateCcw, Eye, Camera } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import {
  createChapterVersionAction,
  getChapterVersionAction,
  restoreChapterVersionAction,
} from "@/lib/actions/versions";
import { generateHTML } from "@tiptap/html";
import { baseExtensions } from "@/lib/editor/extensions";
import { formatNumber, relativeTime } from "@/lib/utils";
import type { VersionItem } from "./types";

function renderPreview(content: unknown) {
  try {
    if (!content || typeof content !== "object") return "<p><em>This snapshot is empty.</em></p>";
    return generateHTML(content as never, baseExtensions as never) || "<p><em>This snapshot is empty.</em></p>";
  } catch {
    return "<p><em>This snapshot could not be rendered.</em></p>";
  }
}

export function VersionsPanel({
  chapterId,
  canEdit,
  versions,
  loading,
  onRefresh,
  onRestored,
  flushPending,
  className,
}: {
  chapterId: string;
  canEdit: boolean;
  versions: VersionItem[];
  loading?: boolean;
  onRefresh: () => void;
  onRestored: (content: unknown, wordCount: number) => void;
  flushPending?: () => Promise<unknown>;
  className?: string;
}) {
  const [snapshotOpen, setSnapshotOpen] = React.useState(false);
  const [label, setLabel] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const [previewId, setPreviewId] = React.useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [preview, setPreview] = React.useState<{ id: string; content: unknown; label: string; words: number } | null>(null);

  const [restoreTarget, setRestoreTarget] = React.useState<VersionItem | null>(null);
  const [restoring, setRestoring] = React.useState(false);

  const openSnapshot = () => {
    const stamp = new Date().toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    setLabel(`Draft — ${stamp}`);
    setSnapshotOpen(true);
  };

  const submitSnapshot = async () => {
    setSaving(true);
    try {
      await flushPending?.();
    } catch {
      // snapshot what is stored even if the flush failed
    }
    const result = await createChapterVersionAction(chapterId, label);
    setSaving(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Snapshot saved.");
    setSnapshotOpen(false);
    onRefresh();
  };

  const openPreview = async (version: VersionItem) => {
    setPreviewId(version.id);
    setPreview(null);
    setPreviewLoading(true);
    const result = await getChapterVersionAction(version.id);
    setPreviewLoading(false);
    if (!result.ok) {
      toast.error(result.error);
      setPreviewId(null);
      return;
    }
    setPreview({
      id: version.id,
      content: result.data.content,
      label: version.label ?? (version.kind === "manual" ? "Named snapshot" : "Auto snapshot"),
      words: version.word_count,
    });
  };

  const closePreview = () => {
    setPreviewId(null);
    setPreview(null);
  };

  const confirmRestore = async () => {
    if (!restoreTarget) return;
    setRestoring(true);
    try {
      await flushPending?.();
    } catch {
      // the restore action keeps its own backup snapshot
    }
    const result = await restoreChapterVersionAction(restoreTarget.id);
    setRestoring(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    // reload the restored body so the live editor reflects it immediately
    const fresh = await getChapterVersionAction(restoreTarget.id);
    if (fresh.ok) onRestored(fresh.data.content, result.data.wordCount);
    toast.success("Chapter restored. A restore snapshot was added to the history.");
    setRestoreTarget(null);
    closePreview();
    onRefresh();
  };

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
          History
          {versions.length > 0 && <span className="ml-1.5 font-mono tracking-normal text-muted/70">{versions.length}</span>}
        </span>
        <Button size="sm" variant="ghost" onClick={openSnapshot} disabled={!canEdit} className="h-7 gap-1 px-2 text-[12px]">
          <Camera className="size-3.5" /> Snapshot
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted">
            <Loader2 className="size-4 animate-spin" />
          </div>
        ) : versions.length === 0 ? (
          <EmptyState
            icon={<History />}
            title="No snapshots yet"
            description="Automatic snapshots appear as you write. Take a named one before a big revision."
            className="py-10"
          />
        ) : (
          <ul className="divide-y divide-border/60">
            {versions.map((version) => (
              <li key={version.id} className="group px-3 py-2.5 transition hover:bg-ink-850/60">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      {version.kind === "manual" ? (
                        <Bookmark className="size-3 shrink-0 text-accent" />
                      ) : (
                        <History className="size-3 shrink-0 text-muted" />
                      )}
                      <p className="truncate text-[12.5px] text-muted-strong">
                        {version.label ?? (version.kind === "manual" ? "Named snapshot" : "Auto snapshot")}
                      </p>
                    </div>
                    <p className="mt-0.5 pl-[18px] font-mono text-[10px] text-muted">
                      {relativeTime(version.created_at)} · {formatNumber(version.word_count)} words
                    </p>
                  </div>
                  <Badge tone={version.kind === "manual" ? "accent" : "neutral"} className="shrink-0 scale-90">
                    {version.kind}
                  </Badge>
                </div>

                <div className="mt-1.5 flex items-center gap-1 pl-[18px] opacity-0 transition focus-within:opacity-100 group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => void openPreview(version)}
                    className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted transition hover:bg-ink-750 hover:text-foreground"
                  >
                    <Eye className="size-3" /> Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => canEdit && setRestoreTarget(version)}
                    disabled={!canEdit}
                    className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted transition hover:bg-ink-750 hover:text-foreground"
                  >
                    <RotateCcw className="size-3" /> Restore
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* New named snapshot */}
      <Dialog
        open={snapshotOpen}
        onOpenChange={setSnapshotOpen}
        title="Snapshot this chapter"
        description="Named snapshots are never pruned and can be restored at any time."
        footer={
          <>
            <Button variant="ghost" onClick={() => setSnapshotOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={saving} onClick={() => void submitSnapshot()}>
              Save snapshot
            </Button>
          </>
        }
      >
        <label className="block space-y-1.5">
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-strong">Label</span>
          <Input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="e.g. Before the rewrite of the harbour scene"
            maxLength={120}
            autoFocus
            onKeyDown={(event) => {
              if (event.key === "Enter") void submitSnapshot();
            }}
          />
        </label>
      </Dialog>

      {/* Read-only preview */}
      <Dialog
        open={previewId !== null}
        onOpenChange={(open) => (!open ? closePreview() : undefined)}
        title={preview?.label ?? "Snapshot"}
        description={preview ? `${formatNumber(preview.words)} words · read-only preview` : "Loading snapshot…"}
        width="max-w-3xl"
        footer={
          <>
            <Button variant="ghost" onClick={closePreview}>
              Close
            </Button>
            {preview && (
              <Button
                variant="primary"
                disabled={!canEdit}
                onClick={() => {
                  const version = versions.find((item) => item.id === preview.id);
                  if (version) setRestoreTarget(version);
                }}
              >
                <RotateCcw /> Restore this version
              </Button>
            )}
          </>
        }
      >
        {previewLoading ? (
          <div className="flex items-center justify-center py-16 text-muted">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : preview ? (
          <div className="rounded-md bg-paper px-6 py-7 text-[#241f1a] sm:px-10 sm:py-9">
            <div
              className="ink-prose mx-auto max-w-[68ch]"
              // trusted: generated from our own TipTap JSON through the shared extension set
              dangerouslySetInnerHTML={{ __html: renderPreview(preview.content) }}
            />
          </div>
        ) : null}
      </Dialog>

      {/* Restore confirm */}
      <Dialog
        open={restoreTarget !== null}
        onOpenChange={(open) => (!open ? setRestoreTarget(null) : undefined)}
        title="Restore this snapshot?"
        description="The current text is kept in history as an automatic snapshot. The restored version is labelled in the timeline."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRestoreTarget(null)}>
              Cancel
            </Button>
            <Button variant="primary" loading={restoring} onClick={() => void confirmRestore()}>
              Restore
            </Button>
          </>
        }
      >
        {restoreTarget && (
          <p className="text-sm text-muted-strong">
            You are restoring{" "}
            <span className="text-foreground">
              {restoreTarget.label ?? (restoreTarget.kind === "manual" ? "a named snapshot" : "an automatic snapshot")}
            </span>{" "}
            from {relativeTime(restoreTarget.created_at)} ({formatNumber(restoreTarget.word_count)} words).
          </p>
        )}
      </Dialog>
    </div>
  );
}
