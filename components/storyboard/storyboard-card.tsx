"use client";

import * as React from "react";
import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowUpRight, GripVertical, Images, Pencil, Plus, X } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import { padChapterNumber } from "./model";
import { PaperTexture } from "./paper-texture";
import { StatusChip } from "./status-chip";
import {
  ASSET_DRAG_TYPE,
  MOOD_LIMIT,
  type StoryboardAsset,
  type StoryboardCardModel,
} from "./types";

type DropZone = "card" | "mood";

function readAssetId(event: React.DragEvent) {
  return (
    event.dataTransfer.getData(ASSET_DRAG_TYPE) || event.dataTransfer.getData("text/plain")
  );
}

function carriesAsset(event: React.DragEvent) {
  return Array.from(event.dataTransfer.types).includes(ASSET_DRAG_TYPE);
}

export function StoryboardCard({
  card,
  assetMap,
  width,
  canEdit,
  disabled,
  onEditNotes,
  onPickMood,
  onSetPrimary,
  onAddMood,
  onRemoveMood,
}: {
  card: StoryboardCardModel;
  assetMap: Map<string, StoryboardAsset>;
  width: number;
  canEdit: boolean;
  disabled?: boolean;
  onEditNotes: (card: StoryboardCardModel) => void;
  onPickMood: (card: StoryboardCardModel) => void;
  onSetPrimary: (chapterId: string, assetId: string | null) => void;
  onAddMood: (chapterId: string, assetId: string) => void;
  onRemoveMood: (chapterId: string, assetId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.chapterId,
    disabled: !canEdit || disabled,
  });

  const primary = card.primaryImageId ? assetMap.get(card.primaryImageId) : undefined;
  const moodAssets = card.moodImageIds
    .map((id) => assetMap.get(id))
    .filter((asset): asset is StoryboardAsset => !!asset);

  const [over, setOver] = React.useState<DropZone | null>(null);
  const depth = React.useRef(0);

  const resetDrop = () => {
    depth.current = 0;
    setOver(null);
  };

  // HTML5 dragleave can be missed when a drag ends outside the card — make
  // sure the drop overlay never sticks.
  React.useEffect(() => {
    const clear = () => {
      depth.current = 0;
      setOver(null);
    };
    window.addEventListener("dragend", clear);
    window.addEventListener("drop", clear);
    return () => {
      window.removeEventListener("dragend", clear);
      window.removeEventListener("drop", clear);
    };
  }, []);

  const cardDropProps = canEdit
    ? {
        onDragEnter: (event: React.DragEvent) => {
          if (!carriesAsset(event)) return;
          depth.current += 1;
          setOver("card");
        },
        onDragOver: (event: React.DragEvent) => {
          if (!carriesAsset(event)) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        },
        onDragLeave: (event: React.DragEvent) => {
          if (!carriesAsset(event)) return;
          depth.current = Math.max(0, depth.current - 1);
          if (depth.current === 0) setOver(null);
        },
        onDrop: (event: React.DragEvent) => {
          if (!canEdit) return;
          event.preventDefault();
          const assetId = readAssetId(event);
          const toMood = event.shiftKey;
          resetDrop();
          if (!assetId) return;
          if (toMood) onAddMood(card.chapterId, assetId);
          else onSetPrimary(card.chapterId, assetId);
        },
      }
    : {};

  const moodDropProps = canEdit
    ? {
        onDragEnter: (event: React.DragEvent) => {
          if (!carriesAsset(event)) return;
          event.stopPropagation();
          depth.current += 1;
          setOver("mood");
        },
        onDragOver: (event: React.DragEvent) => {
          if (!carriesAsset(event)) return;
          event.preventDefault();
          event.stopPropagation();
          event.dataTransfer.dropEffect = "copy";
        },
        onDragLeave: (event: React.DragEvent) => {
          if (!carriesAsset(event)) return;
          event.stopPropagation();
          depth.current = Math.max(0, depth.current - 1);
          if (depth.current === 0) setOver(null);
        },
        onDrop: (event: React.DragEvent) => {
          if (!canEdit) return;
          event.preventDefault();
          event.stopPropagation();
          const assetId = readAssetId(event);
          resetDrop();
          if (assetId) onAddMood(card.chapterId, assetId);
        },
      }
    : {};

  const number = padChapterNumber(card.number);

  return (
    <article
      ref={setNodeRef}
      style={{ width, transform: CSS.Transform.toString(transform), transition }}
      aria-roledescription="Storyboard card"
      className={cn(
        "group/card relative flex h-full shrink-0 snap-start flex-col",
        isDragging && "z-30",
        over === "card" && "z-20",
      )}
      {...cardDropProps}
    >
      <div
        className={cn(
          "relative flex h-full flex-col overflow-hidden rounded-md border bg-ink-900 shadow-[0_22px_44px_-32px_rgba(0,0,0,0.95)] transition-[border-color,box-shadow,opacity,transform] duration-200 group-hover/card:-translate-y-0.5",
          isDragging
            ? "border-accent/60 opacity-70 shadow-[0_30px_60px_-24px_rgba(0,0,0,0.9)]"
            : over
              ? "border-accent/70 shadow-[0_26px_50px_-28px_rgba(200,129,74,0.55)]"
              : "border-border-strong group-hover/card:border-ink-600",
        )}
      >
        {/* ---------------- image area ---------------- */}
        <div className="relative h-[clamp(150px,30vh,290px)] w-full overflow-hidden bg-ink-850">
          <Link
            href={card.href}
            aria-label={`Open ${card.title} in the editor`}
            className="absolute inset-0 block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/70"
          >
            {primary ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={primary.url}
                alt={primary.alt ?? card.title}
                className="h-full w-full object-cover transition duration-700 group-hover/card:scale-[1.03]"
                draggable={false}
              />
            ) : (
              <span className="absolute inset-0 block">
                <PaperTexture />
                <span className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <span className="font-serif text-[64px] leading-none text-ink-200/30">
                    {number}
                  </span>
                  <span className="text-[9px] uppercase tracking-[0.36em] text-ink-300/45">
                    Chapter
                  </span>
                </span>
              </span>
            )}
            {primary && (
              <>
                <span className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                <span className="pointer-events-none absolute left-2 top-2 rounded-[3px] border border-white/10 bg-ink-950/55 px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-100 backdrop-blur-sm">
                  {number}
                </span>
              </>
            )}
            <span className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-1 rounded-[3px] bg-paper/90 px-1.5 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-800 opacity-0 transition group-hover/card:opacity-100">
              Open <ArrowUpRight className="size-2.5" />
            </span>
            <span className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/[0.06]" />
          </Link>

          {canEdit && (
            <button
              type="button"
              {...attributes}
              {...listeners}
              aria-label={`Reorder ${card.title}`}
              title="Drag to reorder"
              className="absolute right-2 top-2 cursor-grab touch-none rounded-[3px] border border-white/10 bg-ink-950/60 p-1.5 text-ink-200 opacity-0 backdrop-blur-sm transition hover:bg-ink-950/90 hover:text-ink-50 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 active:cursor-grabbing group-hover/card:opacity-100 [@media(hover:none)]:opacity-100"
            >
              <GripVertical className="size-3.5" />
            </button>
          )}

          {canEdit && primary && (
            <button
              type="button"
              onClick={() => onSetPrimary(card.chapterId, null)}
              aria-label="Remove pinned image"
              title="Remove pinned image"
              className="absolute right-2 top-10 rounded-[3px] border border-white/10 bg-ink-950/60 p-1.5 text-ink-200 opacity-0 backdrop-blur-sm transition hover:bg-ink-950/90 hover:text-ink-50 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70 group-hover/card:opacity-100 [@media(hover:none)]:opacity-100"
            >
              <X className="size-3.5" />
            </button>
          )}

          {over === "card" && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-ink-950/55">
              <span className="rounded-full border border-accent/50 bg-ink-900/90 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-accent-soft">
                {card.primaryImageId ? "Replace cover" : "Pin as cover"}
              </span>
            </div>
          )}
        </div>

        {/* ---------------- caption on index-card stock ---------------- */}
        <div className="relative flex flex-1 flex-col border-t border-ink-950/10 bg-paper px-3.5 pb-3 pt-2.5 text-ink-900">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-ink-500">
              {number}
            </span>
            <StatusChip status={card.status} />
            <span className="ml-auto font-mono text-[9.5px] text-ink-500">
              {formatNumber(card.wordCount)} w
            </span>
          </div>

          <Link
            href={card.href}
            className="mt-1 line-clamp-2 font-serif text-[17px] font-semibold leading-[1.25] tracking-[-0.01em] text-ink-950 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-deep/50"
          >
            {card.title}
          </Link>

          <p className="mt-1 line-clamp-2 text-[12px] leading-[1.45] text-ink-600">
            {card.synopsis?.trim() || "No synopsis yet."}
          </p>

          {card.notes?.trim() && (
            <p className="mt-2 line-clamp-2 border-l border-ink-950/15 pl-2 text-[10.5px] italic leading-snug text-ink-500">
              {card.notes}
            </p>
          )}

          <div className="mt-2.5 flex items-center gap-3 border-t border-ink-950/10 pt-2">
            {canEdit ? (
              <>
                <button
                  type="button"
                  onClick={() => onPickMood(card)}
                  className="inline-flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-ink-500 transition hover:text-accent-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-deep/40"
                >
                  <Images className="size-3" /> Mood
                </button>
                <button
                  type="button"
                  onClick={() => onEditNotes(card)}
                  className="inline-flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-ink-500 transition hover:text-accent-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-deep/40"
                >
                  <Pencil className="size-3" /> Notes
                </button>
              </>
            ) : null}
            <span className="ml-auto font-mono text-[9.5px] text-ink-500">
              {moodAssets.length}/{MOOD_LIMIT}
            </span>
          </div>

          {(canEdit || moodAssets.length > 0) && (
            <div
              {...moodDropProps}
              className={cn(
                "mt-2 rounded-sm border border-dashed p-1 transition-colors",
                over === "mood"
                  ? "border-accent-deep/60 bg-accent/10"
                  : "border-ink-950/15 bg-ink-950/[0.02]",
              )}
            >
              <div className="flex items-center gap-1">
                {moodAssets.map((asset) => (
                  <span key={asset.id} className="group/mood relative block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={asset.url}
                      alt={asset.alt ?? asset.filename}
                      className="size-8 rounded-[2px] border border-ink-950/15 object-cover"
                      draggable={false}
                    />
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => onRemoveMood(card.chapterId, asset.id)}
                        aria-label={`Remove ${asset.filename} from the mood board`}
                        title="Remove from mood board"
                        className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-ink-950 text-ink-100 opacity-0 shadow transition hover:bg-red-900 focus-visible:opacity-100 group-hover/mood:opacity-100"
                      >
                        <X className="size-2.5" />
                      </button>
                    )}
                  </span>
                ))}

                {canEdit && moodAssets.length < MOOD_LIMIT && (
                  <button
                    type="button"
                    onClick={() => onPickMood(card)}
                    aria-label="Add a mood image"
                    title="Add a mood image"
                    className="flex size-8 items-center justify-center rounded-[2px] border border-dashed border-ink-950/25 text-ink-400 transition hover:border-accent-deep/60 hover:text-accent-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-deep/40"
                  >
                    <Plus className="size-3" />
                  </button>
                )}

                {moodAssets.length === 0 && (
                  <span className="pl-1 text-[10px] leading-tight text-ink-500">
                    Drop a mood image
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
