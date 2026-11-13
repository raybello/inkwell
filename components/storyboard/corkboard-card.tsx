"use client";

import * as React from "react";
import Link from "next/link";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowUpRight, GripVertical } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import { padChapterNumber } from "./model";
import { PaperTexture } from "./paper-texture";
import { StatusChip } from "./status-chip";
import type { StoryboardAsset, StoryboardCardModel } from "./types";

/**
 * A physical index card: cream stock, a coloured edge for the active metadata
 * dimension, and a small cover print when one is pinned.
 */
export function CorkboardCard({
  card,
  primary,
  color,
  label,
  canEdit,
  disabled,
}: {
  card: StoryboardCardModel;
  primary?: StoryboardAsset;
  color: string;
  label: string;
  canEdit: boolean;
  disabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.chapterId,
    disabled: !canEdit || disabled,
  });

  return (
    <article
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        borderLeftColor: color,
      }}
      aria-roledescription="Corkboard card"
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-md border border-border-strong border-l-[3px] bg-paper p-4 text-paper-ink shadow-[0_18px_36px_-30px_rgba(0,0,0,0.9)] transition-shadow",
        isDragging
          ? "z-30 opacity-75 shadow-[0_28px_60px_-24px_rgba(0,0,0,0.85)]"
          : "hover:shadow-[0_24px_44px_-28px_rgba(0,0,0,0.95)]",
      )}
    >
      <PaperTexture tone="light" className="opacity-60" />

      <div className="relative flex flex-1 flex-col">
        <div className={cn("flex items-center gap-2", canEdit && "pr-6")}>
          <span className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-ink-500">
            {padChapterNumber(card.number)}
          </span>
          <span className="inline-flex min-w-0 items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-ink-500">
            <span aria-hidden className="size-[5px] shrink-0 rounded-full" style={{ backgroundColor: color }} />
            <span className="truncate">{label}</span>
          </span>
          <StatusChip status={card.status} className="ml-auto shrink-0" />
        </div>

        {canEdit && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Reorder ${card.title}`}
            title="Drag to reorder"
            className="absolute -right-2 -top-1.5 cursor-grab touch-none rounded p-1 text-ink-400 opacity-0 transition hover:text-ink-700 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-deep/50 active:cursor-grabbing group-hover:opacity-100 [@media(hover:none)]:opacity-100"
          >
            <GripVertical className="size-3.5" />
          </button>
        )}

        <div className="mt-2 flex flex-1 items-start gap-3">
          <div className="min-w-0 flex-1">
            <Link
              href={card.href}
              className="line-clamp-2 font-serif text-[19px] font-semibold leading-[1.22] tracking-[-0.01em] text-paper-ink underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-deep/40"
            >
              {card.title}
            </Link>
            <p className="mt-1.5 line-clamp-3 text-[12.5px] leading-[1.5] text-ink-600">
              {card.synopsis?.trim() || "No synopsis yet."}
            </p>
          </div>

          {primary && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={primary.url}
              alt={primary.alt ?? card.title}
              className="h-[78px] w-[58px] shrink-0 rounded-[2px] border border-ink-950/15 object-cover shadow-sm"
              draggable={false}
            />
          )}
        </div>

        {card.notes?.trim() && (
          <p className="mt-2 line-clamp-2 border-l border-ink-950/15 pl-2 text-[10.5px] italic leading-snug text-ink-500">
            {card.notes}
          </p>
        )}

        <div className="mt-3 flex items-center gap-2 border-t border-ink-950/10 pt-2">
          <span className="font-mono text-[10px] text-ink-500">
            {formatNumber(card.wordCount)} words
          </span>
          {card.moodImageIds.length > 0 && (
            <>
              <span aria-hidden className="text-ink-300">
                ·
              </span>
              <span className="text-[10px] text-ink-500">{card.moodImageIds.length} mood</span>
            </>
          )}
          <Link
            href={card.href}
            className="ml-auto inline-flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-ink-500 transition hover:text-accent-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-deep/40"
          >
            Open <ArrowUpRight className="size-2.5" />
          </Link>
        </div>
      </div>
    </article>
  );
}
