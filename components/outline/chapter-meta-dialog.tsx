"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { STATUS_LABEL } from "@/components/ui/badge";
import { updateChapterMeta } from "@/lib/actions/outline";
import { cn } from "@/lib/utils";
import type { Chapter, ChapterStatus } from "@/lib/types";

export const CHAPTER_COLORS = [
  { value: "#c8814a", label: "Amber" },
  { value: "#7d9a7e", label: "Sage" },
  { value: "#8b6b8f", label: "Plum" },
  { value: "#5f7d8b", label: "Steel" },
  { value: "#a8825f", label: "Ochre" },
  { value: "#9c5f31", label: "Rust" },
] as const;

const STATUS_OPTIONS: ChapterStatus[] = ["draft", "in_progress", "complete", "needs_review"];

export function ChapterMetaDialog({
  projectId,
  chapter,
  onClose,
  onSaved,
}: {
  projectId: string;
  chapter: Chapter;
  onClose: () => void;
  onSaved: (chapter: Chapter) => void;
}) {
  const [synopsis, setSynopsis] = React.useState(chapter.synopsis ?? "");
  const [status, setStatus] = React.useState<ChapterStatus>(chapter.status);
  const [pov, setPov] = React.useState(chapter.pov ?? "");
  const [arc, setArc] = React.useState(chapter.arc ?? "");
  const [subplot, setSubplot] = React.useState(chapter.subplot ?? "");
  const [color, setColor] = React.useState<string | null>(chapter.color ?? null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const result = await updateChapterMeta(projectId, chapter.id, {
      synopsis: synopsis.trim() || null,
      status,
      pov: pov.trim() || null,
      arc: arc.trim() || null,
      subplot: subplot.trim() || null,
      color,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success("Outline card updated");
    onSaved(result.data);
    onClose();
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => !next && onClose()}
      title="Edit synopsis"
      description={chapter.title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} loading={saving}>
            Save card
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Synopsis" hint="Shown on the corkboard, storyboard and this overview.">
          <Textarea
            value={synopsis}
            onChange={(e) => setSynopsis(e.target.value)}
            rows={4}
            placeholder="One or two sentences on what happens here."
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value as ChapterStatus)}>
              {STATUS_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {STATUS_LABEL[value]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="POV">
            <Input value={pov} onChange={(e) => setPov(e.target.value)} placeholder="Mira" />
          </Field>
          <Field label="Arc">
            <Input value={arc} onChange={(e) => setArc(e.target.value)} placeholder="Act I" />
          </Field>
          <Field label="Subplot">
            <Input value={subplot} onChange={(e) => setSubplot(e.target.value)} placeholder="The survey" />
          </Field>
        </div>

        <Field label="Colour">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setColor(null)}
              aria-label="No colour"
              aria-pressed={color === null}
              className={cn(
                "size-6 rounded-full border border-border-strong text-[10px] text-muted transition hover:border-ink-500",
                color === null && "ring-2 ring-accent/60 ring-offset-2 ring-offset-ink-900",
              )}
            >
              —
            </button>
            {CHAPTER_COLORS.map((swatch) => (
              <button
                key={swatch.value}
                type="button"
                onClick={() => setColor(swatch.value)}
                aria-label={swatch.label}
                aria-pressed={color === swatch.value}
                className={cn(
                  "size-6 rounded-full border border-black/20 transition hover:scale-105",
                  color === swatch.value && "ring-2 ring-accent/60 ring-offset-2 ring-offset-ink-900",
                )}
                style={{ backgroundColor: swatch.value }}
              />
            ))}
          </div>
        </Field>

        {error && <p className="text-xs text-red-400">{error}</p>}
        {saving && (
          <p className="flex items-center gap-1.5 text-[11px] text-muted">
            <Loader2 className="size-3 animate-spin" /> Saving
          </p>
        )}
      </div>
    </Dialog>
  );
}
