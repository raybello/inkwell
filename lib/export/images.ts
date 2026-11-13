import type { FetchedImage, ImageMap } from "./types";

const MAX_IMAGES = 80;
const MAX_BYTES = 12 * 1024 * 1024;
const TIMEOUT_MS = 12_000;

function extFromMime(mime: string): FetchedImage["ext"] | null {
  switch (mime.toLowerCase()) {
    case "image/png":
      return "png";
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/gif":
      return "gif";
    case "image/webp":
      return "webp";
    case "image/svg+xml":
      return "svg";
    default:
      return null;
  }
}

function sniffMime(bytes: Uint8Array): string | null {
  if (bytes.length > 8) {
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "image/gif";
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[8] === 0x57) return "image/webp";
    const head = new TextDecoder("utf-8").decode(bytes.slice(0, 300)).trimStart();
    if (head.startsWith("<svg") || head.startsWith("<?xml")) return "image/svg+xml";
  }
  return null;
}

/** PNG / JPEG / GIF intrinsic dimensions, used for print placement. */
export function imageSize(bytes: Uint8Array): { width: number; height: number } | null {
  // PNG
  if (bytes.length > 24 && bytes[0] === 0x89 && bytes[1] === 0x50) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  // GIF
  if (bytes.length > 10 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return { width: bytes[6] | (bytes[7] << 8), height: bytes[8] | (bytes[9] << 8) };
  }
  // JPEG: walk markers to a Start Of Frame segment
  if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = bytes[offset + 1];
      if (marker === 0xd8 || marker === 0xd9) {
        offset += 2;
        continue;
      }
      const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
      if (length < 2) return null;
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        const height = (bytes[offset + 5] << 8) | bytes[offset + 6];
        const width = (bytes[offset + 7] << 8) | bytes[offset + 8];
        return { width, height };
      }
      offset += 2 + length;
    }
  }
  return null;
}

function decodeDataUri(src: string): FetchedImage | null {
  const match = src.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([\s\S]+)$/);
  if (!match) return null;
  const mime = match[1].toLowerCase();
  const ext = extFromMime(mime);
  if (!ext) return null;
  try {
    const bytes = new Uint8Array(Buffer.from(match[2], "base64"));
    if (!bytes.length || bytes.length > MAX_BYTES) return null;
    const size = imageSize(bytes);
    return { url: src, bytes, mime, ext, ...(size ?? {}) };
  } catch {
    return null;
  }
}

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function absoluteImageUrl(src: string): string {
  if (!src) return src;
  if (/^(https?:|data:)/i.test(src)) return src;
  if (src.startsWith("//")) return `https:${src}`;
  if (src.startsWith("/")) return `${baseUrl()}${src}`;
  return src;
}

async function fetchOne(src: string): Promise<FetchedImage | null> {
  if (src.startsWith("data:")) return decodeDataUri(src);
  const url = absoluteImageUrl(src);
  if (!/^https?:\/\//i.test(url)) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
    if (!res.ok) return null;
    const declared = res.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "";
    const buffer = new Uint8Array(await res.arrayBuffer());
    if (!buffer.length || buffer.length > MAX_BYTES) return null;
    const mime = extFromMime(declared) ? declared : sniffMime(buffer);
    if (!mime) return null;
    const ext = extFromMime(mime);
    if (!ext) return null;
    const size = imageSize(buffer);
    return { url: src, bytes: buffer, mime, ext, ...(size ?? {}) };
  } catch {
    return null;
  }
}

/**
 * Fetch cover + inline images concurrently. Failures are silent: an export must
 * never fail because a remote illustration 404'd — the alt text stays behind.
 */
export async function fetchImages(urls: string[]): Promise<ImageMap> {
  const unique = [...new Set(urls.filter(Boolean))].slice(0, MAX_IMAGES);
  const map: ImageMap = new Map();
  const results = await Promise.all(unique.map(async (url) => ({ url, image: await fetchOne(url) })));
  for (const { url, image } of results) {
    if (image) map.set(url, image);
  }
  return map;
}
