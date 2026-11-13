import type { Asset } from "@/lib/types";

/** Shared upload rules — the client validates early, the API route enforces them. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "video/mp4",
  "application/pdf",
] as const;

export const UPLOAD_ACCEPT = ALLOWED_MIME_TYPES.join(",");

export type AssetKind = "image" | "video" | "pdf" | "file";

export function normalizeMime(mime: string | null | undefined): string {
  return (mime ?? "").split(";")[0].trim().toLowerCase();
}

export function isAllowedMime(mime: string | null | undefined): boolean {
  const value = normalizeMime(mime);
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(value);
}

export function assetKind(asset: Pick<Asset, "mime_type" | "filename"> | { mime_type?: string | null; filename?: string | null }): AssetKind {
  const mime = normalizeMime(asset.mime_type);
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime === "application/pdf") return "pdf";
  const name = (asset.filename ?? "").toLowerCase();
  if (/\.(jpe?g|png|webp|gif|svg|avif)$/.test(name)) return "image";
  if (/\.(mp4|mov|webm)$/.test(name)) return "video";
  if (name.endsWith(".pdf")) return "pdf";
  return "file";
}

export function isImageAsset(asset: Pick<Asset, "mime_type" | "filename">): boolean {
  return assetKind(asset) === "image";
}

export function formatBytes(bytes: number | null | undefined): string {
  const value = bytes ?? 0;
  if (value <= 0) return "0 KB";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  const mb = value / (1024 * 1024);
  return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`;
}

export function dimensionLabel(width: number | null | undefined, height: number | null | undefined): string | null {
  if (!width || !height) return null;
  return `${width} × ${height}`;
}

export function assetMeta(asset: Asset): string {
  const kind = assetKind(asset);
  const parts = [formatBytes(asset.size_bytes)];
  const dims = dimensionLabel(asset.width, asset.height);
  if (dims && (kind === "image" || kind === "video")) parts.unshift(dims);
  if (kind === "pdf") parts.push("PDF");
  if (kind === "video") parts.push("MP4");
  return parts.join(" · ");
}

export function parseTags(input: string): string[] {
  return Array.from(
    new Set(
      input
        .split(/[,\n]/)
        .map((tag) => tag.trim().toLowerCase().replace(/\s+/g, "-"))
        .filter(Boolean)
        .map((tag) => tag.slice(0, 24)),
    ),
  ).slice(0, 12);
}

export function markdownForAsset(asset: Pick<Asset, "public_url" | "alt_text" | "filename">): string {
  const alt = asset.alt_text?.trim() || asset.filename.replace(/\.[^.]+$/, "");
  return `![${alt}](${asset.public_url ?? ""})`;
}

export function fileExtension(name: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(name);
  return match ? match[1].toLowerCase() : "bin";
}

/** POSTs a file to the upload endpoint with progress events. */
export function uploadAssetFile(
  projectId: string,
  file: File,
  options?: { onProgress?: (pct: number) => void; width?: number | null; height?: number | null; tags?: string[]; altText?: string },
): Promise<Asset> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("projectId", projectId);
    form.append("file", file);
    if (options?.altText) form.append("altText", options.altText);
    if (options?.tags?.length) form.append("tags", options.tags.join(","));
    if (options?.width) form.append("width", String(options.width));
    if (options?.height) form.append("height", String(options.height));

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/assets");
    xhr.timeout = 120_000;
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && options?.onProgress) {
        options.onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      try {
        const payload = JSON.parse(xhr.responseText) as { asset?: Asset; error?: string };
        if (xhr.status >= 200 && xhr.status < 300 && payload.asset) resolve(payload.asset);
        else reject(new Error(payload.error ?? `Upload failed (HTTP ${xhr.status}).`));
      } catch {
        reject(new Error(`Upload failed (HTTP ${xhr.status}).`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.ontimeout = () => reject(new Error("Upload timed out."));
    xhr.send(form);
  });
}

/** Reads intrinsic dimensions client-side before upload so tiles can show them immediately. */
export function readImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  if (typeof window === "undefined" || !normalizeMime(file.type).startsWith("image/")) {
    return Promise.resolve(null);
  }
  if (normalizeMime(file.type) === "image/svg+xml") {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(url);
    };
    image.onerror = () => {
      resolve(null);
      URL.revokeObjectURL(url);
    };
    image.src = url;
  });
}
