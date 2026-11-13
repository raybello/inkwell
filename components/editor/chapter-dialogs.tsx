"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Badge, STATUS_LABEL, STATUS_TONE } from "@/components/ui/badge";
import type { ChapterListItem } from "./types";

export function RenameChapterDialog({
  open,
  onOpenChange,
  initialTitle,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTitle: string;
  onSave: (title: string) => void;
  saving?: boolean;
}) {
  const [title, setTitle] = React.useState(initialTitle);

  React.useEffect(() => {
    if (open) setTitle(initialTitle);
  }, [open, initialTitle]);

  const submit = () => {
    const next = title.trim();
    if (!next) return;
    onSave(next);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Rename chapter"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} disabled={!title.trim()} onClick={submit}>
            Rename
          </Button>
        </>
      }
    >
      <Input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        autoFocus
        maxLength={200}
        onKeyDown={(event) => {
          if (event.key === "Enter") submit();
        }}
      />
    </Dialog>
  );
}

export function DeleteChapterDialog({
  open,
  onOpenChange,
  chapter,
  onConfirm,
  deleting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chapter: ChapterListItem | null;
  onConfirm: () => void;
  deleting?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete chapter?"
      description="The chapter, its snapshots and its comments are removed. This cannot be undone."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="danger" loading={deleting} onClick={onConfirm}>
            Delete chapter
          </Button>
        </>
      }
    >
      {chapter && (
        <div className="rounded-md border border-border bg-ink-850/60 px-3 py-2">
          <p className="font-serif text-[15px] text-foreground">{chapter.title}</p>
          <p className="mt-0.5 font-mono text-[11px] text-muted">{chapter.word_count.toLocaleString("en-US")} words</p>
        </div>
      )}
    </Dialog>
  );
}

export function ChapterDetailsDialog({
  open,
  onOpenChange,
  chapter,
  canEdit,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chapter: ChapterListItem;
  canEdit: boolean;
  onSave: (synopsis: string) => void;
  saving?: boolean;
}) {
  const [synopsis, setSynopsis] = React.useState(chapter.synopsis ?? "");

  React.useEffect(() => {
    if (open) setSynopsis(chapter.synopsis ?? "");
  }, [open, chapter.id, chapter.synopsis]);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Chapter details"
      description="The synopsis shows up on the storyboard and corkboard."
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} disabled={!canEdit} onClick={() => onSave(synopsis)}>
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-ink-850/60 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate font-serif text-[15px]">{chapter.title}</p>
            <p className="font-mono text-[11px] text-muted">{chapter.word_count.toLocaleString("en-US")} words</p>
          </div>
          <Badge tone={STATUS_TONE[chapter.status] ?? "neutral"}>{STATUS_LABEL[chapter.status] ?? chapter.status}</Badge>
        </div>

        <label className="block space-y-1.5">
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-strong">Synopsis</span>
          <Textarea
            value={synopsis}
            onChange={(event) => setSynopsis(event.target.value)}
            placeholder="One or two sentences on what happens in this chapter…"
            rows={5}
            maxLength={2000}
            disabled={!canEdit}
          />
        </label>
      </div>
    </Dialog>
  );
}
