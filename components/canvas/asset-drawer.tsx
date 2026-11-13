"use client";

import * as React from "react";
import { Images, Search, StickyNote, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface CanvasAsset {
  id: string;
  filename: string;
  url: string;
  mimeType: string | null;
  width: number | null;
  height: number | null;
}

export const ASSET_DRAG_TYPE = "application/x-inkwell-asset";

export interface DraggedAsset {
  url: string;
  w: number;
  h: number;
  name: string;
  mimeType: string;
}

export function AssetDrawer({
  open,
  onClose,
  assets,
  onAddImage,
  onAddNote,
  onInsert,
  uploading,
}: {
  open: boolean;
  onClose: () => void;
  assets: CanvasAsset[];
  onAddImage: (file: File) => void;
  onAddNote: () => void;
  onInsert: (asset: DraggedAsset) => void;
  uploading: boolean;
}) {
  const [query, setQuery] = React.useState("");
  const fileRef = React.useRef<HTMLInputElement>(null);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter((a) => a.filename.toLowerCase().includes(q));
  }, [assets, query]);

  return (
    <aside
      aria-hidden={!open}
      inert={!open}
      aria-label="Project assets"
      className={cn(
        "absolute bottom-[84px] right-3 top-[62px] z-[450] flex w-[min(320px,calc(100vw-24px))] flex-col overflow-hidden rounded-xl border border-border-strong bg-ink-900/95 shadow-2xl backdrop-blur-md transition-transform duration-200 ease-out 2xl:bottom-3",
        open ? "translate-x-0" : "pointer-events-none translate-x-[calc(100%+16px)]",
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-3.5 py-3">
        <div className="flex items-center gap-2">
          <Images className="size-4 text-accent" />
          <p className="font-serif text-sm">Assets</p>
          <span className="font-mono text-[10px] text-muted">{assets.length}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close assets"
          className="rounded-md p-1 text-muted transition hover:bg-ink-800 hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      </div>

      <div className="border-b border-border px-3 py-2.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search images"
            aria-label="Search project images"
            className="h-8 pl-8 text-[13px]"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {assets.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <div className="flex size-10 items-center justify-center rounded-full border border-border-strong bg-ink-850 text-muted">
              <Images className="size-4" />
            </div>
            <p className="text-[13px] text-muted-strong">No images yet</p>
            <p className="text-[11px] leading-relaxed text-muted">
              Upload a reference image here, or add files from the project&apos;s asset library.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-2 py-8 text-center text-[12px] text-muted">Nothing matches “{query}”.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {filtered.map((asset) => {
              const payload: DraggedAsset = {
                url: asset.url,
                w: asset.width ?? 0,
                h: asset.height ?? 0,
                name: asset.filename,
                mimeType: asset.mimeType ?? "image/png",
              };
              return (
                <button
                  key={asset.id}
                  type="button"
                  draggable
                  onClick={() => onInsert(payload)}
                  onDragStart={(e) => {
                    e.dataTransfer.setData(ASSET_DRAG_TYPE, JSON.stringify(payload));
                    e.dataTransfer.setData("text/uri-list", asset.url);
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  className="group cursor-grab overflow-hidden rounded-lg border border-border bg-ink-850 text-left transition hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 active:cursor-grabbing"
                  title={`Drag “${asset.filename}” onto the canvas, or click to place it`}
                >
                  <div className="aspect-square overflow-hidden bg-ink-950">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={asset.url}
                      alt={asset.filename}
                      draggable={false}
                      loading="lazy"
                      className="size-full object-cover transition duration-200 group-hover:scale-[1.03]"
                    />
                  </div>
                  <p className="truncate px-1.5 py-1 text-[10px] text-muted">{asset.filename}</p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="space-y-1.5 border-t border-border bg-ink-850/60 p-2.5">
        <Button
          variant="secondary"
          size="sm"
          className="w-full justify-start"
          onClick={() => fileRef.current?.click()}
          loading={uploading}
        >
          <Upload /> Add image
        </Button>
        <Button variant="ghost" size="sm" className="w-full justify-start" onClick={onAddNote}>
          <StickyNote /> Add note
        </Button>
        <p className="px-1 pt-0.5 text-[10px] leading-relaxed text-muted/80">
          Drag a thumbnail onto the board, or click to drop it in the middle. Use the toolbar for
          shapes, arrows and freehand drawing.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onAddImage(file);
            e.target.value = "";
          }}
        />
      </div>
    </aside>
  );
}
