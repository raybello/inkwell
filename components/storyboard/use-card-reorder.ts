"use client";

import * as React from "react";
import { arrayMove } from "@dnd-kit/sortable";
import { toast } from "sonner";
import { reorderCards } from "@/lib/actions/storyboard";
import type { StoryboardCardModel } from "./types";

function signatureOf(cards: StoryboardCardModel[]): string {
  return cards
    .map(
      (card) =>
        `${card.chapterId}:${card.position}:${card.primaryImageId ?? "-"}:${card.moodImageIds.join(
          ".",
        )}:${card.notes ?? ""}`,
    )
    .join("|");
}

type ActionResult = { ok: boolean; error?: string };

/**
 * Shared optimistic state for the storyboard lane and corkboard grid:
 * reordering, image pinning, mood images and notes all go through here.
 *
 * `scopeIds` on `reorder` lets the corkboard reorder inside one arc group
 * without disturbing the rest of the outline; omit it for a flat list.
 */
export function useCardReorder(projectId: string, initialCards: StoryboardCardModel[]) {
  const [cards, setCards] = React.useState<StoryboardCardModel[]>(initialCards);
  const [pending, startTransition] = React.useTransition();
  const [busy, setBusy] = React.useState(false);
  const signature = signatureOf(initialCards);

  // Re-sync whenever the server (via revalidatePath) hands us fresh data.
  React.useEffect(() => {
    setCards(initialCards);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  const reorder = React.useCallback(
    (activeId: string, overId: string, scopeIds?: string[]) => {
      if (pending || busy || activeId === overId) return;

      const ids = scopeIds?.length ? scopeIds : cards.map((card) => card.chapterId);
      const from = ids.indexOf(activeId);
      const to = ids.indexOf(overId);
      if (from < 0 || to < 0) return;

      const nextScope = arrayMove(ids, from, to);
      const scope = new Set(ids);
      const byId = new Map(cards.map((card) => [card.chapterId, card]));
      const queue = [...nextScope];

      const previous = cards;
      const next = cards
        .map((card) => {
          if (!scope.has(card.chapterId)) return card;
          const nextId = queue.shift();
          return nextId ? byId.get(nextId) ?? card : card;
        })
        .map((card, index) => ({ ...card, position: index }));

      setCards(next);

      startTransition(async () => {
        try {
          const result = await reorderCards(
            projectId,
            next.map((card) => card.chapterId),
          );
          if (!result.ok) {
            setCards(previous);
            toast.error(result.error ?? "Could not save the new order.");
          }
        } catch {
          setCards(previous);
          toast.error("Could not save the new order.");
        }
      });
    },
    [busy, cards, pending, projectId, startTransition],
  );

  /** Applies an optimistic patch then rolls back if the action fails. */
  const runMutation = React.useCallback(
    async (
      optimistic: (current: StoryboardCardModel[]) => StoryboardCardModel[],
      action: () => Promise<ActionResult>,
      failureMessage?: string,
    ): Promise<boolean> => {
      const previous = cards;
      setBusy(true);
      setCards(optimistic(cards));
      try {
        const result = await action();
        if (!result.ok) {
          setCards(previous);
          toast.error(result.error ?? failureMessage ?? "That change could not be saved.");
          return false;
        }
        return true;
      } catch {
        setCards(previous);
        toast.error(failureMessage ?? "That change could not be saved.");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [cards],
  );

  return { cards, pending: pending || busy, reorder, runMutation };
}
