"use client";

import * as React from "react";
import { Check, ImageOff, Info, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { searchUnsplashAction, trackUnsplashDownloadAction } from "@/lib/integrations/unsplash-actions";
import type { UnsplashSearchResult } from "@/lib/integrations/unsplash";

export interface UnsplashPick {
  url: string;
  alt: string;
  credit: string;
}

/**
 * Stock photography picker.
 *
 * Live Unsplash search when `UNSPLASH_ACCESS_KEY` is configured; otherwise a
 * curated fallback set with a visible banner. The parent owns what happens to
 * the picked image — this component only hands back `{ url, alt, credit }`.
 */
export function UnsplashPicker({
  onPick,
  className,
}: {
  onPick: (image: UnsplashPick) => void;
  className?: string;
}) {
  const [query, setQuery] = React.useState("");
  const [result, setResult] = React.useState<UnsplashSearchResult | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [pickedId, setPickedId] = React.useState<string | null>(null);
  const requestId = React.useRef(0);

  const runSearch = React.useCallback(async (term: string) => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const next = await searchUnsplashAction(term);
      if (id === requestId.current) setResult(next);
    } catch {
      if (id === requestId.current) {
        setResult({ photos: [], live: false, query: term, error: "Search failed. Try again." });
      }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void runSearch("");
  }, [runSearch]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runSearch(query);
  }

  function handlePick(photo: UnsplashSearchResult["photos"][number]) {
    setPickedId(photo.id);
    onPick({ url: photo.url, alt: photo.alt, credit: photo.credit });
    if (photo.downloadLocation) {
      void trackUnsplashDownloadAction(photo.downloadLocation);
    }
  }

  const photos = result?.photos ?? [];
  const showBanner = result ? !result.live || Boolean(result.error) : false;

  return (
    <div className={cn("space-y-3", className)}>
      <form onSubmit={handleSubmit} className="flex items-center gap-2" role="search">
        <label htmlFor="unsplash-search" className="sr-only">
          Search stock photographs
        </label>
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted"
            aria-hidden
          />
          <Input
            id="unsplash-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search photographs — fog, coast, night sky…"
            className="pl-8"
            autoComplete="off"
          />
        </div>
        <Button type="submit" variant="secondary" size="md" loading={loading}>
          {loading ? "Searching" : "Search"}
        </Button>
      </form>

      {showBanner && result && (
        <div
          className={cn(
            "flex items-start gap-2 rounded-md border px-3 py-2 text-xs leading-relaxed",
            result.error
              ? "border-amber-700/40 bg-amber-800/10 text-amber-200"
              : "border-border-strong bg-ink-850/70 text-muted-strong",
          )}
        >
          <Info className="mt-px size-3.5 shrink-0" aria-hidden />
          <div className="space-y-0.5">
            {result.error ? (
              <p>{result.error}</p>
            ) : (
              <p>
                Add <span className="font-mono text-[11px] text-foreground">UNSPLASH_ACCESS_KEY</span> for live
                search. Showing a curated set of twelve photographs.
              </p>
            )}
            {result.error && result.notice && <p className="text-muted">{result.notice}</p>}
          </div>
        </div>
      )}

      {loading && !result ? (
        <div className="columns-2 gap-2 sm:columns-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className={cn("mb-2 w-full break-inside-avoid", i % 3 === 0 ? "h-36" : "h-28")} />
          ))}
        </div>
      ) : photos.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border-strong px-4 py-10 text-center">
          <ImageOff className="size-5 text-muted" aria-hidden />
          <p className="text-sm text-muted-strong">No photographs found</p>
          <p className="max-w-xs text-xs text-muted">
            {result?.query
              ? `Nothing matched “${result.query}”. Try a broader word like “light” or “coast”.`
              : "Search for a mood, place or object to begin."}
          </p>
          {result?.query && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-1"
              onClick={() => {
                setQuery("");
                void runSearch("");
              }}
            >
              Clear search
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-muted">
            <span>
              {photos.length} photograph{photos.length === 1 ? "" : "s"}
            </span>
            <span>{result?.live ? "Unsplash" : "Unsplash · curated"}</span>
          </div>
          <div className="columns-2 gap-2 sm:columns-3">
            {photos.map((photo) => {
              const selected = pickedId === photo.id;
              return (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => handlePick(photo)}
                  aria-label={`Use photograph: ${photo.alt}`}
                  aria-pressed={selected}
                  className="group relative mb-2 block w-full break-inside-avoid overflow-hidden rounded-md border border-border bg-ink-850 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-accent/60"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.thumbUrl}
                    alt={photo.alt}
                    loading="lazy"
                    width={photo.width}
                    height={photo.height}
                    className="block w-full object-cover transition duration-300 group-hover:opacity-90"
                  />
                  <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-950/85 via-ink-950/10 to-transparent opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100" />
                  <span className="pointer-events-none absolute inset-x-0 bottom-6 flex items-end justify-between gap-2 p-2 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
                    <span className="min-w-0 truncate text-[11px] text-ink-100">{photo.credit}</span>
                    <span className="rounded-full bg-ink-950/70 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-ink-100">
                      Use
                    </span>
                  </span>
                  <span className="block truncate px-2 py-1 text-[10px] text-muted">{photo.credit}</span>
                  {selected && (
                    <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-accent text-ink-950">
                      <Check className="size-3" aria-hidden />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] leading-relaxed text-muted">
            Photographs are hotlinked from Unsplash and stay under the{" "}
            <a
              href="https://unsplash.com/license"
              target="_blank"
              rel="noreferrer noopener"
              className="text-accent hover:text-accent-soft"
            >
              Unsplash licence
            </a>
            . Keep the credit when you publish.
          </p>
        </>
      )}

      {loading && result && (
        <p className="flex items-center gap-1.5 text-[11px] text-muted">
          <Loader2 className="size-3 animate-spin" aria-hidden /> Updating results…
        </p>
      )}
    </div>
  );
}
