"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  LayoutTemplate,
  MoreHorizontal,
  Pencil,
  Plus,
  Shapes,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { Dropdown, DropdownItem, DropdownLabel } from "@/components/ui/dropdown";
import { EmptyState } from "@/components/ui/misc";
import { cn, relativeTime } from "@/lib/utils";
import { createCanvas, deleteCanvas, renameCanvas } from "@/lib/actions/canvas";
import type { CanvasPreviewData } from "./canvas-preview";
import { CanvasThumb } from "./canvas-thumb";

export interface CanvasCardData {
  id: string;
  name: string;
  updatedAt: string;
  preview: CanvasPreviewData | null;
  shapeCount: number;
}

export function CanvasGallery({
  projectId,
  canEdit,
  canvases,
}: {
  projectId: string;
  canEdit: boolean;
  canvases: CanvasCardData[];
}) {
  const router = useRouter();
  const base = `/app/projects/${projectId}/canvas`;

  const [createOpen, setCreateOpen] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  const [renameTarget, setRenameTarget] = React.useState<CanvasCardData | null>(null);
  const [renameValue, setRenameValue] = React.useState("");
  const [renaming, setRenaming] = React.useState(false);

  const [deleteTarget, setDeleteTarget] = React.useState<CanvasCardData | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    try {
      const result = await createCanvas(projectId, newName);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Canvas created");
      setCreateOpen(false);
      setNewName("");
      router.push(`${base}/${result.data.id}`);
    } catch {
      toast.error("Could not create the canvas. Check your connection and try again.");
    } finally {
      setCreating(false);
    }
  }

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    if (!renameTarget || renaming) return;
    setRenaming(true);
    try {
      const result = await renameCanvas(renameTarget.id, renameValue);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Canvas renamed");
      setRenameTarget(null);
      router.refresh();
    } catch {
      toast.error("Could not rename the canvas.");
    } finally {
      setRenaming(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    try {
      const result = await deleteCanvas(deleteTarget.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Canvas deleted");
      setDeleteTarget(null);
      router.refresh();
    } catch {
      toast.error("Could not delete the canvas.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 md:px-8 md:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Idea space</p>
          <h1 className="font-serif text-3xl md:text-4xl">Canvas</h1>
          <p className="max-w-xl text-sm text-muted">
            Map the story before it is prose. Plot arcs, character webs and world maps, kept
            side by side with the manuscript and clipped back into it when something clicks.
          </p>
        </div>
        {canEdit && (
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus /> New canvas
          </Button>
        )}
      </div>

      <div className="mt-8">
        {canvases.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border-strong bg-ink-900/40">
            <EmptyState
              icon={<Shapes />}
              title="A blank wall, waiting"
              description="Canvases are infinite whiteboards for the parts of a book that are not sentences yet: the shape of a plot, the web between characters, the map of a place. Drop in sticky notes, sketch arcs, drag reference images from your asset library, then clip what matters into a chapter note or storyboard card."
              action={
                canEdit ? (
                  <Button variant="primary" onClick={() => setCreateOpen(true)}>
                    <Plus /> Start a canvas
                  </Button>
                ) : undefined
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {canvases.map((canvas) => (
              <div key={canvas.id} className="group relative">
                <Link
                  href={`${base}/${canvas.id}`}
                  className="block overflow-hidden rounded-xl border border-border bg-card transition hover:border-border-strong hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                >
                  <CanvasThumb
                    preview={canvas.preview}
                    className="aspect-[16/10] w-full border-b border-border"
                  />
                  <div className="flex items-start justify-between gap-3 px-4 py-3.5">
                    <div className="min-w-0">
                      <p className="truncate font-serif text-[15px] leading-tight text-foreground">
                        {canvas.name}
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted">
                        <span className="font-mono">{canvas.shapeCount}</span>
                        <span>{canvas.shapeCount === 1 ? "item" : "items"}</span>
                        <span className="text-muted/50">·</span>
                        <span>Edited {relativeTime(canvas.updatedAt)}</span>
                      </p>
                    </div>
                    <span
                      className={cn(
                        "mt-0.5 flex shrink-0 items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[10px] text-muted transition",
                        "opacity-0 group-hover:border-accent/40 group-hover:text-accent-soft group-hover:opacity-100 group-focus-within:opacity-100",
                      )}
                      aria-hidden
                    >
                      Open <ArrowUpRight className="size-3" />
                    </span>
                  </div>
                </Link>

                {canEdit && (
                  <div className="absolute right-2.5 top-2.5 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                    <Dropdown
                      trigger={
                        <button
                          type="button"
                          aria-label={`Actions for ${canvas.name}`}
                          className="flex size-7 items-center justify-center rounded-md border border-border bg-ink-900/85 text-muted backdrop-blur transition hover:text-foreground"
                        >
                          <MoreHorizontal className="size-3.5" />
                        </button>
                      }
                    >
                      <DropdownLabel>Canvas</DropdownLabel>
                      <DropdownItem
                        icon={<Pencil />}
                        onClick={() => {
                          setRenameTarget(canvas);
                          setRenameValue(canvas.name);
                        }}
                      >
                        Rename
                      </DropdownItem>
                      <DropdownItem icon={<Trash2 />} danger onClick={() => setDeleteTarget(canvas)}>
                        Delete
                      </DropdownItem>
                    </Dropdown>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="mt-8 flex items-center gap-2 text-[11px] text-muted">
        <LayoutTemplate className="size-3.5" />
        Everything saves automatically while you draw — reopening a canvas returns you to the same
        view.
      </p>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setNewName("");
        }}
        title="New canvas"
        description="Name it for the question it answers — “Plot arcs”, “Ashcombe map”, “Who knows what”."
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)} type="button">
              Cancel
            </Button>
            <Button variant="primary" form="new-canvas-form" type="submit" loading={creating}>
              Create & open
            </Button>
          </>
        }
      >
        <form id="new-canvas-form" onSubmit={handleCreate} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="canvas-name">Canvas name</Label>
            <Input
              id="canvas-name"
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Character web"
              maxLength={120}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["Plot arcs", "Character web", "World map", "Timeline"].map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setNewName(suggestion)}
                className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted transition hover:border-border-strong hover:text-foreground"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </form>
      </Dialog>

      <Dialog
        open={!!renameTarget}
        onOpenChange={(open) => !open && setRenameTarget(null)}
        title="Rename canvas"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenameTarget(null)} type="button">
              Cancel
            </Button>
            <Button variant="primary" form="rename-canvas-form" type="submit" loading={renaming}>
              Save name
            </Button>
          </>
        }
      >
        <form id="rename-canvas-form" onSubmit={handleRename} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="rename-canvas">Canvas name</Label>
            <Input
              id="rename-canvas"
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              maxLength={120}
            />
          </div>
        </form>
      </Dialog>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete canvas"
        description="This removes the canvas and everything on it. Notes and storyboard cards you already clipped are kept."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} type="button">
              Keep it
            </Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting}>
              <Trash2 /> Delete canvas
            </Button>
          </>
        }
      >
        <div className="flex items-center gap-3 rounded-lg border border-border bg-ink-850/60 p-3">
          <CanvasThumb preview={deleteTarget?.preview ?? null} className="size-12 shrink-0 rounded-md" compact />
          <div className="min-w-0">
            <p className="truncate text-sm">{deleteTarget?.name}</p>
            <p className="text-[11px] text-muted">
              {deleteTarget?.shapeCount ?? 0} items · edited {relativeTime(deleteTarget?.updatedAt)}
            </p>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
