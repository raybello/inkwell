"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Columns3, Loader2, Scissors, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { clipSelection } from "@/lib/actions/canvas";

export type ClipPayload = { text: string; shapeCount: number };

export function ClipDialog({
  open,
  onOpenChange,
  canvasId,
  canvasName,
  chapters,
  selection,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canvasId: string;
  canvasName: string;
  chapters: { id: string; title: string }[];
  selection: ClipPayload;
}) {
  const router = useRouter();
  const [mode, setMode] = React.useState<"note" | "storyboard">("note");
  const [title, setTitle] = React.useState("");
  const [chapterId, setChapterId] = React.useState("");
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setTitle(`${canvasName} clip`);
    setChapterId(chapters[0]?.id ?? "");
  }, [open, canvasName, chapters]);

  const preview = selection.text.trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    if (!preview && selection.shapeCount === 0) {
      toast.error("Select something on the canvas first.");
      return;
    }
    setPending(true);
    try {
      const result = await clipSelection({
        canvasId,
        mode,
        title,
        text: preview,
        chapterId: mode === "storyboard" ? chapterId : null,
        shapeCount: selection.shapeCount,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.data.label);
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Could not clip that selection.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Clip to project"
      description={`${selection.shapeCount} selected item${selection.shapeCount === 1 ? "" : "s"} — keep the thinking, leave the board behind.`}
      width="max-w-xl"
      footer={
        <>
          <Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="clip-form" loading={pending}>
            <Scissors /> Clip selection
          </Button>
        </>
      }
    >
      <form id="clip-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setMode("note")}
            aria-pressed={mode === "note"}
            className={cn(
              "flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition",
              mode === "note"
                ? "border-accent/60 bg-accent/[0.07]"
                : "border-border bg-ink-850/50 hover:border-border-strong",
            )}
          >
            <span className="flex items-center gap-2 text-[13px] font-medium text-foreground">
              <StickyNote className="size-3.5 text-accent" /> Chapter note
            </span>
            <span className="text-[11px] leading-relaxed text-muted">
              A note in the project&apos;s research panel, with the canvas text and a link back.
            </span>
          </button>
          <button
            type="button"
            onClick={() => setMode("storyboard")}
            aria-pressed={mode === "storyboard"}
            className={cn(
              "flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition",
              mode === "storyboard"
                ? "border-accent/60 bg-accent/[0.07]"
                : "border-border bg-ink-850/50 hover:border-border-strong",
            )}
          >
            <span className="flex items-center gap-2 text-[13px] font-medium text-foreground">
              <Columns3 className="size-3.5 text-accent" /> Storyboard notes
            </span>
            <span className="text-[11px] leading-relaxed text-muted">
              Append the mood and text to a chapter&apos;s card so the board follows the draft.
            </span>
          </button>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="clip-title">{mode === "note" ? "Note title" : "Clip label"}</Label>
          <Input
            id="clip-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder={`${canvasName} clip`}
          />
        </div>

        {mode === "storyboard" && (
          <div className="space-y-1.5">
            <Label htmlFor="clip-chapter">Chapter</Label>
            {chapters.length === 0 ? (
              <p className="text-[12px] text-muted">
                This project has no chapters yet — create one to use the storyboard.
              </p>
            ) : (
              <Select id="clip-chapter" value={chapterId} onChange={(e) => setChapterId(e.target.value)}>
                {chapters.map((chapter) => (
                  <option key={chapter.id} value={chapter.id}>
                    {chapter.title}
                  </option>
                ))}
              </Select>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="clip-text">Captured text</Label>
            <span className="text-[10px] uppercase tracking-[0.14em] text-muted">
              {preview.length} chars
            </span>
          </div>
          {preview ? (
            <Textarea
              id="clip-text"
              value={preview}
              readOnly
              className="min-h-[120px] max-h-[220px] font-mono text-[12px] leading-relaxed"
            />
          ) : (
            <p className="rounded-md border border-dashed border-border-strong px-3 py-4 text-[12px] text-muted">
              The selection has no text shapes. Only the item count will be captured.
            </p>
          )}
        </div>

        <p className="flex items-center gap-1.5 text-[11px] text-muted">
          {pending && <Loader2 className="size-3 animate-spin" />}
          Images and drawings stay on the canvas — only text and counts travel.
        </p>
      </form>
    </Dialog>
  );
}
