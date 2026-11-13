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
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { Pin, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { cn, formatNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  addMoodImage,
  removeMoodImage,
  setPrimaryImage,
  syncCardsFromChapters,
  updateCardNotes,
} from "@/lib/actions/storyboard";
import { assetIndex, totalWords } from "./model";
import { AssetTray, useTrayOpen } from "./asset-tray";
import { CardNotesDialog } from "./card-notes-dialog";
import { ImagePicker } from "./image-picker";
import { StoryboardCard } from "./storyboard-card";
import { useCardReorder } from "./use-card-reorder";
import { usePersistentState } from "./use-persistent-state";
import { ViewSwitcher } from "./view-switcher";
import {
  CARD_WIDTHS,
  CARD_ZOOMS,
  MOOD_LIMIT,
  type CardZoom,
  type StoryboardAsset,
  type StoryboardCardModel,
} from "./types";

const ZOOM_LABEL: Record<CardZoom, string> = {
  s: "Small cards",
  m: "Medium cards",
  l: "Large cards",
};

export function StoryboardView({
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
  const { cards, pending, reorder, runMutation } = useCardReorder(projectId, initialCards);
  const [zoom, setZoom] = usePersistentState<CardZoom>("inkwell:storyboard:zoom", "m", CARD_ZOOMS);
  const [trayOpen, setTrayOpen] = useTrayOpen();

  const assetMap = React.useMemo(() => assetIndex(assets), [assets]);
  const words = totalWords(cards);

  const [notesFor, setNotesFor] = React.useState<string | null>(null);
  const [picker, setPicker] = React.useState<{
    chapterId: string;
    mode: "primary" | "mood";
  } | null>(null);
  const [syncing, setSyncing] = React.useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    reorder(String(active.id), String(over.id));
  };

  const pinPrimary = (chapterId: string, assetId: string | null) => {
    if (!canEdit) return;
    void runMutation(
      (current) =>
        current.map((card) =>
          card.chapterId === chapterId
            ? {
                ...card,
                primaryImageId: assetId,
                moodImageIds: assetId
                  ? card.moodImageIds.filter((id) => id !== assetId)
                  : card.moodImageIds,
              }
            : card,
        ),
      () => setPrimaryImage(projectId, chapterId, assetId),
      assetId ? "Could not pin that image." : "Could not remove the pinned image.",
    );
  };

  const addMood = (chapterId: string, assetId: string) => {
    if (!canEdit) return;
    const card = cards.find((entry) => entry.chapterId === chapterId);
    if (!card) return;
    if (card.primaryImageId === assetId) {
      toast("That image is already the cover.");
      return;
    }
    if (card.moodImageIds.includes(assetId)) {
      toast("Already on the mood board.");
      return;
    }
    if (card.moodImageIds.length >= MOOD_LIMIT) {
      toast.error(`A card holds ${MOOD_LIMIT} mood images. Remove one first.`);
      return;
    }
    void runMutation(
      (current) =>
        current.map((entry) =>
          entry.chapterId === chapterId
            ? { ...entry, moodImageIds: [...entry.moodImageIds, assetId] }
            : entry,
        ),
      () => addMoodImage(projectId, chapterId, assetId),
      "Could not add that mood image.",
    );
  };

  const removeMood = (chapterId: string, assetId: string) => {
    if (!canEdit) return;
    void runMutation(
      (current) =>
        current.map((entry) =>
          entry.chapterId === chapterId
            ? { ...entry, moodImageIds: entry.moodImageIds.filter((id) => id !== assetId) }
            : entry,
        ),
      () => removeMoodImage(projectId, chapterId, assetId),
      "Could not remove that mood image.",
    );
  };

  const saveNotes = async (chapterId: string, notes: string | null) => {
    if (!canEdit) return false;
    return runMutation(
      (current) =>
        current.map((entry) => (entry.chapterId === chapterId ? { ...entry, notes } : entry)),
      () => updateCardNotes(projectId, chapterId, notes),
      "Could not save those notes.",
    );
  };

  const sync = async () => {
    if (!canEdit || syncing) return;
    setSyncing(true);
    try {
      const result = await syncCardsFromChapters(projectId);
      if (result.ok) {
        toast.success(
          result.data?.created
            ? `Storyboard synced · ${result.data.created} card(s) added`
            : "Storyboard synced with the outline",
        );
      } else {
        toast.error(result.error ?? "Could not sync the storyboard.");
      }
    } catch {
      toast.error("Could not sync the storyboard.");
    } finally {
      setSyncing(false);
    }
  };

  const notesCard = notesFor ? cards.find((card) => card.chapterId === notesFor) ?? null : null;
  const pickerCard = picker
    ? cards.find((card) => card.chapterId === picker.chapterId) ?? null
    : null;

  // ---------------- snap-scroll edge fades ----------------
  const laneRef = React.useRef<HTMLDivElement>(null);
  const [edges, setEdges] = React.useState({ start: true, end: false });

  const updateEdges = React.useCallback(() => {
    const el = laneRef.current;
    if (!el) return;
    const start = el.scrollLeft <= 8;
    const end = el.scrollLeft + el.clientWidth >= el.scrollWidth - 8;
    setEdges((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
  }, []);

  React.useEffect(() => {
    updateEdges();
    const el = laneRef.current;
    if (!el) return;
    const observer = new ResizeObserver(updateEdges);
    observer.observe(el);
    return () => observer.disconnect();
  }, [updateEdges, cards.length, zoom, trayOpen]);

  return (
    <div className="flex min-h-[calc(100dvh-6rem)] flex-col">
      <header className="flex flex-wrap items-end justify-between gap-4 px-5 pb-4 pt-6 md:px-8">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-muted">
            Storyboard
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
          <ViewSwitcher projectId={projectId} current="storyboard" />

          <div
            role="group"
            aria-label="Card size"
            className="flex items-center gap-0.5 rounded-md border border-border bg-ink-900/70 p-0.5"
          >
            {CARD_ZOOMS.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => setZoom(size)}
                aria-pressed={zoom === size}
                title={ZOOM_LABEL[size]}
                className={cn(
                  "size-6 rounded font-mono text-[10px] uppercase transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60",
                  zoom === size
                    ? "bg-ink-750 text-foreground shadow-sm"
                    : "text-muted hover:text-muted-strong",
                )}
              >
                {size}
              </button>
            ))}
          </div>

          {canEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={sync}
              loading={syncing}
              title="Reconcile storyboard cards with the outline"
            >
              <RefreshCw /> Sync
            </Button>
          )}
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 px-5 pb-3 text-[11px] text-muted md:px-8">
        <span className="inline-flex items-center gap-1 rounded-full border border-border bg-ink-900/60 px-2 py-0.5 text-[9.5px] uppercase tracking-[0.14em] text-muted-strong">
          <Pin className="size-3 text-accent" /> Pin images
        </span>
        <span>
          Drag a cover from the tray onto a card. Shift-drop — or drop straight on the strip —
          adds it to the mood board.
        </span>
      </div>

      <div className="relative flex-1">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToHorizontalAxis]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={cards.map((card) => card.chapterId)}
            strategy={horizontalListSortingStrategy}
          >
            <div
              ref={laneRef}
              onScroll={updateEdges}
              className="flex snap-x snap-mandatory items-start gap-5 overflow-x-auto scroll-smooth px-5 pb-10 pt-1 md:px-8"
            >
              {cards.map((card) => (
                <StoryboardCard
                  key={card.chapterId}
                  card={card}
                  assetMap={assetMap}
                  width={CARD_WIDTHS[zoom]}
                  canEdit={canEdit}
                  disabled={pending}
                  onEditNotes={(target) => setNotesFor(target.chapterId)}
                  onPickMood={(target) =>
                    setPicker({ chapterId: target.chapterId, mode: "mood" })
                  }
                  onSetPrimary={pinPrimary}
                  onAddMood={addMood}
                  onRemoveMood={removeMood}
                />
              ))}
              <div aria-hidden className="w-2 shrink-0" />
            </div>
          </SortableContext>
        </DndContext>

        {!edges.start && (
          <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-background via-background/70 to-transparent" />
        )}
        {!edges.end && (
          <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-background via-background/70 to-transparent" />
        )}
      </div>

      <AssetTray
        assets={assets}
        canEdit={canEdit}
        projectId={projectId}
        open={trayOpen}
        onOpenChange={setTrayOpen}
      />

      <CardNotesDialog
        card={notesCard}
        open={!!notesCard}
        onOpenChange={(open) => {
          if (!open) setNotesFor(null);
        }}
        onSave={saveNotes}
      />

      <ImagePicker
        open={!!pickerCard}
        onOpenChange={(open) => {
          if (!open) setPicker(null);
        }}
        title={picker?.mode === "mood" ? "Add a mood image" : "Pin a cover image"}
        description={pickerCard?.title}
        assets={assets}
        excludeIds={picker?.mode === "mood" ? pickerCard?.moodImageIds : undefined}
        onPick={(assetId) => {
          if (!picker) return;
          if (picker.mode === "mood") addMood(picker.chapterId, assetId);
          else pinPrimary(picker.chapterId, assetId);
          setPicker(null);
        }}
      />
    </div>
  );
}
