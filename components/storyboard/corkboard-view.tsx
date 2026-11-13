"use client";

import * as React from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { toast } from "sonner";
import { cn, formatNumber } from "@/lib/utils";
import { Switch } from "@/components/ui/misc";
import { assetIndex, totalWords } from "./model";
import { buildLegend, colorForValue, labelForValue } from "./colors";
import { CorkboardCard } from "./corkboard-card";
import { useCardReorder } from "./use-card-reorder";
import { usePersistentFlag, usePersistentState } from "./use-persistent-state";
import { ViewSwitcher } from "./view-switcher";
import {
  COLOR_MODES,
  COLOR_MODE_LABEL,
  type ColorMode,
  type StoryboardAsset,
  type StoryboardCardModel,
} from "./types";

export function CorkboardView({
  projectId,
  projectTitle,
  cards: initialCards,
  assets,
  canEdit,
}: {
  projectId: string;
  projectTitle: string;
  cards: StoryboardCardModel[];
  assets: StoryboardAsset[];
  canEdit: boolean;
}) {
  const { cards, pending, reorder } = useCardReorder(projectId, initialCards);
  const [mode, setMode] = usePersistentState<ColorMode>(
    "inkwell:corkboard:color",
    "arc",
    COLOR_MODES,
  );
  const [groupByArc, setGroupByArc] = usePersistentFlag("inkwell:corkboard:group", false);

  const assetMap = React.useMemo(() => assetIndex(assets), [assets]);
  const grouped = mode === "arc" && groupByArc;

  const valueOf = React.useCallback(
    (card: StoryboardCardModel) => (card[mode] ?? "").trim(),
    [mode],
  );

  const legend = React.useMemo(
    () => buildLegend(cards.map((card) => card[mode])),
    [cards, mode],
  );

  const groups = React.useMemo(() => {
    if (!grouped) return [];
    const map = new Map<string, StoryboardCardModel[]>();
    for (const card of cards) {
      const value = valueOf(card);
      const bucket = map.get(value);
      if (bucket) bucket.push(card);
      else map.set(value, [card]);
    }
    return [...map.entries()].map(([value, groupCards]) => ({
      value,
      label: labelForValue(value),
      color: colorForValue(value),
      cards: groupCards,
    }));
  }, [cards, grouped, valueOf]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    if (grouped) {
      const activeCard = cards.find((card) => card.chapterId === active.id);
      const overCard = cards.find((card) => card.chapterId === over.id);
      if (!activeCard || !overCard) return;
      if (valueOf(activeCard) !== valueOf(overCard)) {
        toast.error("Chapters reorder within their arc. Change the arc in the outline first.");
        return;
      }
      const groupIds =
        groups.find((group) => group.value === valueOf(activeCard))?.cards.map((c) => c.chapterId) ??
        [];
      reorder(String(active.id), String(over.id), groupIds);
      return;
    }

    reorder(String(active.id), String(over.id));
  };

  const words = totalWords(cards);

  return (
    <div className="min-h-[calc(100dvh-6rem)] pb-4">
      <header className="px-5 pb-4 pt-6 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-muted">
              Corkboard
            </p>
            <h2 className="mt-1 truncate font-serif text-3xl tracking-[-0.01em] md:text-4xl">
              {projectTitle}
            </h2>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-muted">
              <span className="font-mono text-muted-strong">{cards.length}</span> cards
              <span aria-hidden>·</span>
              <span className="font-mono text-muted-strong">{formatNumber(words)}</span> words
              <span aria-hidden>·</span>
              <span>{canEdit ? "Drag a card to reorder" : "Read-only"}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ViewSwitcher projectId={projectId} current="corkboard" />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/70 pt-3">
          <div className="flex items-center gap-2">
            <span className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-muted">
              Colour by
            </span>
            <div
              role="group"
              aria-label="Colour code cards by"
              className="flex items-center gap-0.5 rounded-md border border-border bg-ink-900/70 p-0.5"
            >
              {COLOR_MODES.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setMode(option)}
                  aria-pressed={mode === option}
                  className={cn(
                    "rounded px-2 py-1 text-[11px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
                    mode === option
                      ? "bg-ink-750 text-foreground shadow-sm"
                      : "text-muted hover:text-muted-strong",
                  )}
                >
                  {COLOR_MODE_LABEL[option]}
                </button>
              ))}
            </div>
          </div>

          {mode === "arc" && (
            <Switch checked={groupByArc} onChange={setGroupByArc} label="Group by arc" />
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {legend.map((entry) => (
            <span
              key={entry.value || "unassigned"}
              className="inline-flex items-center gap-1.5 text-[9.5px] font-medium uppercase tracking-[0.12em] text-muted"
            >
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-strong">{entry.label}</span>
              <span className="font-mono text-[9px] text-muted/80">{entry.count}</span>
            </span>
          ))}
          {canEdit && mode === "arc" && (
            <span className="ml-auto hidden text-[10px] text-muted sm:inline">
              Colour and grouping read from each chapter&rsquo;s arc.
            </span>
          )}
        </div>
      </header>

      <div className="px-5 md:px-8">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          {grouped ? (
            <div className="space-y-8">
              {groups.map((group) => (
                <section key={group.value || "unassigned"} aria-label={`Arc: ${group.label}`}>
                  <header className="mb-3 flex items-center gap-3">
                    <span
                      aria-hidden
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: group.color }}
                    />
                    <h3 className="font-serif text-lg leading-none">{group.label}</h3>
                    <span className="font-mono text-[10px] text-muted">{group.cards.length}</span>
                    <div className="h-px flex-1 bg-border" />
                  </header>
                  <SortableContext
                    items={group.cards.map((card) => card.chapterId)}
                    strategy={rectSortingStrategy}
                  >
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                      {group.cards.map((card) => (
                        <CorkboardCard
                          key={card.chapterId}
                          card={card}
                          primary={
                            card.primaryImageId ? assetMap.get(card.primaryImageId) : undefined
                          }
                          color={colorForValue(card.arc)}
                          label={labelForValue(card.arc)}
                          canEdit={canEdit}
                          disabled={pending}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </section>
              ))}
            </div>
          ) : (
            <SortableContext
              items={cards.map((card) => card.chapterId)}
              strategy={rectSortingStrategy}
            >
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {cards.map((card) => (
                  <CorkboardCard
                    key={card.chapterId}
                    card={card}
                    primary={card.primaryImageId ? assetMap.get(card.primaryImageId) : undefined}
                    color={colorForValue(card[mode])}
                    label={labelForValue(card[mode])}
                    canEdit={canEdit}
                    disabled={pending}
                  />
                ))}
              </div>
            </SortableContext>
          )}
        </DndContext>
      </div>
    </div>
  );
}
