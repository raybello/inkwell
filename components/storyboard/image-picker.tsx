"use client";

import * as React from "react";
import { ImageOff, Search } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { StoryboardAsset } from "./types";

/**
 * Light image grid reused for "pin primary" and "add mood image".
 * The tray handles the drag path; this is the keyboard/click path.
 */
export function ImagePicker({
  open,
  onOpenChange,
  title,
  description,
  assets,
  onPick,
  excludeIds,
  emptyHint,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  assets: StoryboardAsset[];
  onPick: (assetId: string) => void;
  excludeIds?: string[];
  emptyHint?: string;
}) {
  const [query, setQuery] = React.useState("");
  const excluded = React.useMemo(() => new Set(excludeIds ?? []), [excludeIds]);

  React.useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return assets.filter(
      (asset) =>
        !excluded.has(asset.id) && (!q || asset.filename.toLowerCase().includes(q)),
    );
  }, [assets, excluded, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} description={description} width="max-w-2xl">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-muted" />
        <Input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search project images…"
          className="pl-8"
          aria-label="Search images"
        />
      </div>

      {filtered.length > 0 ? (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {filtered.map((asset) => (
            <button
              key={asset.id}
              type="button"
              onClick={() => onPick(asset.id)}
              className="group relative aspect-square overflow-hidden rounded-md border border-border bg-ink-850 text-left transition hover:border-accent/70 focus-visible:border-accent focus-visible:outline-none"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={asset.url}
                alt={asset.alt ?? asset.filename}
                className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                draggable={false}
              />
              <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/85 via-black/40 to-transparent px-2 pb-1.5 pt-6 text-[10px] text-ink-100">
                {asset.filename}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-3 flex flex-col items-center gap-2 rounded-lg border border-dashed border-border-strong px-4 py-10 text-center">
          <ImageOff className="size-5 text-muted" />
          <p className="text-sm text-muted">
            {assets.length === 0
              ? emptyHint ?? "No images in this project yet. Upload them in Assets."
              : "No images match that search."}
          </p>
        </div>
      )}
    </Dialog>
  );
}
