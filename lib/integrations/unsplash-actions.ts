"use server";

import { searchUnsplash, trackUnsplashDownload, type UnsplashSearchResult } from "@/lib/integrations/unsplash";

export async function searchUnsplashAction(query: string): Promise<UnsplashSearchResult> {
  try {
    return await searchUnsplash(query);
  } catch (error) {
    return {
      photos: [],
      live: false,
      query: query.slice(0, 120),
      error: error instanceof Error ? error.message : "Search failed.",
    };
  }
}

/** Fire-and-forget attribution ping; the picker ignores the result. */
export async function trackUnsplashDownloadAction(downloadLocation: string): Promise<boolean> {
  return trackUnsplashDownload(downloadLocation);
}
