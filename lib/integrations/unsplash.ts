/**
 * Unsplash integration.
 *
 * Live search uses the Unsplash REST API when `UNSPLASH_ACCESS_KEY` is set.
 * Without a key we return a curated, hotlinked set of twelve photographs so the
 * picker is still usable, clearly labelled as a fallback.
 *
 * Attribution: live results carry the photographer's name and profile link, as
 * the Unsplash API guidelines require. The curated fallback only has CDN ids,
 * not photographer metadata, so it credits "Unsplash" rather than inventing a
 * name — the picker links back to unsplash.com.
 */

export interface UnsplashPhoto {
  id: string;
  /** Full-size URL for the asset / cover. */
  url: string;
  /** Smaller URL for the picker grid. */
  thumbUrl: string;
  alt: string;
  credit: string;
  creditUrl: string;
  width?: number;
  height?: number;
  /** Present on live results; used to satisfy Unsplash's download tracking. */
  downloadLocation?: string;
}

export interface UnsplashSearchResult {
  photos: UnsplashPhoto[];
  /** True when the results came from the live API. */
  live: boolean;
  query: string;
  total?: number;
  /** Honest explanation shown above the grid when live search is unavailable. */
  notice?: string;
  error?: string;
}

const UNSPLASH_API = "https://api.unsplash.com";
const ATTRIBUTION_URL = "https://unsplash.com/?utm_source=inkwell_studio&utm_medium=referral";

export function isUnsplashConfigured(): boolean {
  return Boolean(process.env.UNSPLASH_ACCESS_KEY);
}

function cdn(id: string, width: number, quality = 80): string {
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${width}&q=${quality}`;
}

interface CuratedSeed {
  id: string;
  alt: string;
  /** Extra words that should match this photo in demo search. */
  tags: string[];
}

const CURATED_SEEDS: CuratedSeed[] = [
  {
    id: "1506905925346-21bda4d32df4",
    alt: "Snow-capped mountains rising above a sea of clouds at sunrise",
    tags: ["mountain", "clouds", "sunrise", "alpine", "epic", "landscape"],
  },
  {
    id: "1441974231531-c6227db76b6e",
    alt: "Sunlight falling through tall pines onto a forest path",
    tags: ["forest", "trees", "path", "light", "woods", "nature"],
  },
  {
    id: "1470071459604-3b5ec3a7fe05",
    alt: "Green glen with low mist and sunbeams breaking through",
    tags: ["valley", "mist", "hills", "green", "scotland", "landscape"],
  },
  {
    id: "1507525428034-b723cf961d3e",
    alt: "Pale sand beach meeting a calm sea at dawn",
    tags: ["beach", "sea", "coast", "sand", "calm", "ocean"],
  },
  {
    id: "1519681393784-d120267933ba",
    alt: "The Milky Way arcing over dark mountain ridges",
    tags: ["night", "stars", "sky", "milky way", "mountain", "dark"],
  },
  {
    id: "1465146344425-f00d5f5c8f07",
    alt: "Field of red poppies in warm evening light",
    tags: ["flowers", "poppies", "field", "summer", "warm", "meadow"],
  },
  {
    id: "1447752875215-b2761acb3c5d",
    alt: "Wooden boardwalk leading into a dense green forest",
    tags: ["forest", "boardwalk", "path", "green", "woods", "moody"],
  },
  {
    id: "1500530855697-b586d89ba3ee",
    alt: "Layered red rock walls of a desert canyon",
    tags: ["desert", "canyon", "rock", "red", "arid", "travel"],
  },
  {
    id: "1518837695005-2083093ee35b",
    alt: "Open ocean swell under a soft blue horizon",
    tags: ["ocean", "waves", "sea", "blue", "minimal", "water"],
  },
  {
    id: "1472214103451-9374bd1c798e",
    alt: "Sunlit green valley between mountain ridges at dusk",
    tags: ["valley", "green", "sunset", "hills", "landscape", "golden hour"],
  },
  {
    id: "1433086966358-54859d0ed716",
    alt: "Waterfall plunging into a mossy gorge beneath a bridge",
    tags: ["waterfall", "gorge", "water", "green", "moss", "nature"],
  },
  {
    id: "1490750967868-88aa4486c946",
    alt: "Blue water catching scattered light, abstract and calm",
    tags: ["water", "abstract", "blue", "light", "calm", "texture"],
  },
];

export const CURATED_PHOTOS: UnsplashPhoto[] = CURATED_SEEDS.map((seed) => ({
  id: seed.id,
  url: cdn(seed.id, 1600),
  thumbUrl: cdn(seed.id, 600, 70),
  alt: seed.alt,
  credit: "Unsplash",
  creditUrl: ATTRIBUTION_URL,
}));

const CURATED_TAGS = new Map(CURATED_SEEDS.map((seed) => [seed.id, seed.tags]));

export const FALLBACK_NOTICE =
  "Add UNSPLASH_ACCESS_KEY for live search. Showing a curated set of twelve photographs.";

function filterCurated(query: string): UnsplashPhoto[] {
  const q = query.trim().toLowerCase();
  if (!q) return CURATED_PHOTOS;
  const terms = q.split(/\s+/).filter(Boolean);
  return CURATED_PHOTOS.filter((photo) => {
    const haystack = [photo.alt.toLowerCase(), ...(CURATED_TAGS.get(photo.id) ?? [])].join(" ");
    return terms.every((term) => haystack.includes(term));
  });
}

interface UnsplashApiPhoto {
  id: string;
  alt_description?: string | null;
  description?: string | null;
  width?: number;
  height?: number;
  urls?: { raw?: string; full?: string; regular?: string; small?: string };
  user?: { name?: string; username?: string; links?: { html?: string } };
  links?: { html?: string; download_location?: string };
}

interface UnsplashApiSearchResponse {
  total?: number;
  results?: UnsplashApiPhoto[];
  errors?: string[];
}

function mapLivePhoto(photo: UnsplashApiPhoto): UnsplashPhoto {
  const url = photo.urls?.regular ?? photo.urls?.full ?? photo.urls?.raw ?? "";
  const credit = photo.user?.name ?? photo.user?.username ?? "Unsplash contributor";
  const creditUrl = photo.user?.links?.html ?? photo.links?.html ?? ATTRIBUTION_URL;
  return {
    id: photo.id,
    url,
    thumbUrl: photo.urls?.small ?? url,
    alt: photo.alt_description ?? photo.description ?? "Unsplash photograph",
    credit,
    creditUrl,
    width: photo.width,
    height: photo.height,
    downloadLocation: photo.links?.download_location,
  };
}

/**
 * Search Unsplash. Never throws: failures return curated results plus an
 * `error` string the picker can show.
 */
export async function searchUnsplash(query: string, perPage = 24): Promise<UnsplashSearchResult> {
  const cleanQuery = query.trim().slice(0, 120);
  const key = process.env.UNSPLASH_ACCESS_KEY;

  if (!key) {
    const photos = filterCurated(cleanQuery);
    return {
      photos,
      live: false,
      query: cleanQuery,
      notice: FALLBACK_NOTICE,
      ...(cleanQuery && photos.length === 0
        ? { error: `No curated photograph matches “${cleanQuery}”. Live search needs an Unsplash key.` }
        : {}),
    };
  }

  if (!cleanQuery) {
    return { photos: CURATED_PHOTOS, live: false, query: "", notice: FALLBACK_NOTICE };
  }

  const url = new URL(`${UNSPLASH_API}/search/photos`);
  url.searchParams.set("query", cleanQuery);
  url.searchParams.set("per_page", String(Math.min(30, Math.max(1, perPage))));
  url.searchParams.set("content_filter", "high");

  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Client-ID ${key}`,
        "Accept-Version": "v1",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const detail = res.status === 401 ? "the access key was rejected" : `Unsplash returned HTTP ${res.status}`;
      return {
        photos: filterCurated(cleanQuery),
        live: false,
        query: cleanQuery,
        notice: FALLBACK_NOTICE,
        error: `Live search unavailable — ${detail}. Showing the curated set instead.`,
      };
    }

    const payload = (await res.json()) as UnsplashApiSearchResponse;
    const photos = (payload.results ?? []).map(mapLivePhoto).filter((p) => Boolean(p.url));
    return { photos, live: true, query: cleanQuery, total: payload.total ?? photos.length };
  } catch {
    return {
      photos: filterCurated(cleanQuery),
      live: false,
      query: cleanQuery,
      notice: FALLBACK_NOTICE,
      error: "Live search failed (network). Showing the curated set instead.",
    };
  }
}

/**
 * Unsplash requires pinging the download endpoint when a photo is used.
 * Only api.unsplash.com URLs are accepted so this cannot be used as an SSRF
 * gadget.
 */
export async function trackUnsplashDownload(downloadLocation: string): Promise<boolean> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return false;

  let url: URL;
  try {
    url = new URL(downloadLocation);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.hostname !== "api.unsplash.com") return false;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Client-ID ${key}`, "Accept-Version": "v1" },
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}
