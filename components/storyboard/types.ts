import type { ChapterStatus } from "@/lib/types";

/** MIME-ish type used by the HTML5 drag from the asset tray onto cards. */
export const ASSET_DRAG_TYPE = "application/x-inkwell-asset";

/** Keep in sync with lib/actions/storyboard.ts */
export const MOOD_LIMIT = 5;

export const CARD_WIDTHS = { s: 236, m: 292, l: 356 } as const;
export const CARD_ZOOMS = ["s", "m", "l"] as const;
export type CardZoom = (typeof CARD_ZOOMS)[number];

export const COLOR_MODES = ["pov", "arc", "subplot"] as const;
export type ColorMode = (typeof COLOR_MODES)[number];
export const COLOR_MODE_LABEL: Record<ColorMode, string> = {
  pov: "POV",
  arc: "Arc",
  subplot: "Subplot",
};

export interface StoryboardAsset {
  id: string;
  url: string;
  filename: string;
  width: number | null;
  height: number | null;
  alt: string | null;
}

export interface StoryboardCardModel {
  chapterId: string;
  cardId: string | null;
  /** Display number, 1-based, in storyboard order. */
  number: number;
  /** Effective sort position (card position, falling back to chapter position). */
  position: number;
  title: string;
  synopsis: string | null;
  status: ChapterStatus;
  wordCount: number;
  primaryImageId: string | null;
  moodImageIds: string[];
  notes: string | null;
  pov: string | null;
  arc: string | null;
  subplot: string | null;
  href: string;
}

export type StoryboardDropTarget = "primary" | "mood";
