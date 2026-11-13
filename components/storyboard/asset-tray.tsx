"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, GripVertical, Image as ImageIcon, Images, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { usePersistentFlag } from "./use-persistent-state";
import { ASSET_DRAG_TYPE, type StoryboardAsset } from "./types";

/**
 * Collapsible image tray. Thumbnails are HTML5 drag sources — dragging one
 * onto a card pins it; Shift-drop (or dropping on the mood strip) adds it to
 * the mood board instead.
 */
export function AssetTray({
  assets,
  canEdit,
  projectId,
  open,
  onOpenChange,
}: {
  assets: StoryboardAsset[];
  canEdit: boolean;
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [draggingId, setDraggingId] = React.useState<string | null>(null);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter((asset) => asset.filename.toLowerCase().includes(q));
  }, [assets, query]);

  const startDrag = (event: React.DragEvent, asset: StoryboardAsset) => {
    if (!canEdit) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.setData(ASSET_DRAG_TYPE, asset.id);
    event.dataTransfer.setData("text/plain", asset.id);
    event.dataTransfer.effectAllowed = "copy";
    setDraggingId(asset.id);
  };

  return (
    <section
      aria-label="Project image tray"
      className="sticky bottom-0 z-30 border-t border-border bg-ink-900/95 shadow-[0_-18px_36px_-30px_rgba(0,0,0,0.9)] backdrop-blur"
    >
      <div className="flex h-12 items-center gap-3 px-4 md:px-6">
        <button
          type="button"
          onClick={() => onOpenChange(!open)}
          aria-expanded={open}
          aria-controls="storyboard-image-tray"
          className="flex items-center gap-2 rounded-md px-1 py-1 text-[12px] text-muted-strong transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
        >
          <Images className="size-4 text-accent" />
          <span className="font-medium">Image tray</span>
          <span className="font-mono text-[10px] text-muted">{assets.length}</span>
          <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
        </button>

        <p className="hidden text-[11px] text-muted lg:block">
          {canEdit
            ? "Drag an image onto a card to pin it as the cover. Shift-drop, or drop on the strip, for the mood board."
            : "Read-only view — images can be browsed but not pinned."}
        </p>

        {open && assets.length > 0 && (
          <div className="relative ml-auto w-44 shrink-0 sm:w-56">
            <Search className="pointer-events-none absolute left-2 top-1.5 size-3.5 text-muted" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search images"
              aria-label="Search project images"
              className="h-7 bg-ink-950/60 pl-7 text-[12px]"
            />
          </div>
        )}
      </div>

      <div
        id="storyboard-image-tray"
        className={cn(
          "overflow-hidden transition-[max-height,opacity] duration-300 ease-out",
          open ? "max-h-[196px] opacity-100" : "max-h-0 opacity-0",
        )}
      >
        {assets.length === 0 ? (
          <div className="flex items-center gap-2 px-4 pb-4 text-xs text-muted md:px-6">
            <ImageIcon className="size-3.5" />
            <span>
              No images in this project yet.{" "}
              <Link
                href={`/app/projects/${projectId}/assets`}
                className="text-accent underline-offset-4 hover:underline"
              >
                Upload in Assets
              </Link>
              .
            </span>
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-4 pb-4 text-xs text-muted md:px-6">No images match “{query}”.</p>
        ) : (
          <div className="flex gap-2.5 overflow-x-auto px-4 pb-4 pt-0.5 md:px-6">
            {filtered.map((asset) => (
              <div
                key={asset.id}
                draggable={canEdit}
                onDragStart={(event) => startDrag(event, asset)}
                onDragEnd={() => setDraggingId(null)}
                title={canEdit ? `${asset.filename} — drag onto a card` : asset.filename}
                aria-label={asset.filename}
                className={cn(
                  "group relative h-[88px] w-[108px] shrink-0 select-none overflow-hidden rounded-md border border-border-strong bg-ink-850 transition",
                  canEdit
                    ? "cursor-grab hover:border-accent/60 active:cursor-grabbing"
                    : "cursor-default",
                  draggingId === asset.id && "opacity-40",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={asset.url}
                  alt={asset.alt ?? asset.filename}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                  draggable={false}
                />
                <span className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/85 via-black/40 to-transparent px-1.5 pb-1 pt-5 text-[9px] text-ink-100">
                  {asset.filename}
                </span>
                {canEdit && (
                  <GripVertical className="pointer-events-none absolute right-1 top-1 size-3 text-ink-100/70 opacity-0 transition group-hover:opacity-100" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/** Tray visibility is a per-browser preference. */
export function useTrayOpen(): [boolean, (open: boolean) => void] {
  return usePersistentFlag("inkwell:storyboard:tray", true);
}
