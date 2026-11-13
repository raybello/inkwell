import type { ChapterStatus } from "@/lib/types";

export interface ChapterListItem {
  id: string;
  title: string;
  word_count: number;
  status: ChapterStatus;
  position: number;
  updated_at: string;
  synopsis?: string | null;
}

export interface AssetOption {
  id: string;
  filename: string;
  public_url: string | null;
  alt_text: string | null;
  mime_type: string | null;
}

export interface VersionItem {
  id: string;
  label: string | null;
  kind: "auto" | "manual";
  word_count: number;
  created_at: string;
  saved_by: string | null;
}

export interface EditorUser {
  id: string;
  name: string;
  color: string;
  avatarUrl?: string | null;
}

export const STATUS_ORDER: ChapterStatus[] = ["draft", "in_progress", "complete", "needs_review"];
