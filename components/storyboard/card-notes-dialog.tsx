"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import type { StoryboardCardModel } from "./types";

const NOTES_LIMIT = 4000;

export function CardNotesDialog({
  card,
  open,
  onOpenChange,
  onSave,
}: {
  card: StoryboardCardModel | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (chapterId: string, notes: string | null) => Promise<boolean>;
}) {
  const [value, setValue] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open || !card) return;
    setValue(card.notes ?? "");
    // Only reset when the dialog opens for a different card — never mid-typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, card?.chapterId]);

  const save = async () => {
    if (!card || saving) return;
    setSaving(true);
    const trimmed = value.trim().slice(0, NOTES_LIMIT);
    const ok = await onSave(card.chapterId, trimmed ? trimmed : null);
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog
      open={open && !!card}
      onOpenChange={onOpenChange}
      title="Storyboard notes"
      description={card ? card.title : undefined}
      width="max-w-lg"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" loading={saving} onClick={save}>
            Save notes
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        <Textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          maxLength={NOTES_LIMIT}
          rows={6}
          autoFocus
          placeholder="What should this scene feel like? Camera notes, visual motifs, references…"
          aria-label="Storyboard notes"
        />
        <div className="flex items-center justify-between text-[11px] text-muted">
          <span>Shown beneath the synopsis on the card.</span>
          <span className="font-mono">
            {value.length}/{NOTES_LIMIT}
          </span>
        </div>
      </div>
    </Dialog>
  );
}
