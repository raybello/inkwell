import { NextResponse } from "next/server";
import { getProjectContext, listAssets } from "@/lib/data";
import { uploadProjectAsset } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity";
import { emitWebhookEvent } from "@/lib/webhooks";
import {
  ALLOWED_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  fileExtension,
  formatBytes,
  normalizeMime,
  parseTags,
} from "@/components/assets/asset-utils";
import type { Asset } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIME_SET = new Set<string>(ALLOWED_MIME_TYPES);

function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function asPositiveInt(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(20000, Math.round(n));
}

function readTags(value: unknown): string[] {
  if (Array.isArray(value)) return parseTags(value.map(String).join(","));
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("[")) {
      try {
        const parsed: unknown = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parseTags(parsed.map(String).join(","));
      } catch {
        // fall through to comma parsing
      }
    }
    return parseTags(trimmed);
  }
  return [];
}

async function projectFor(projectId: string) {
  if (!projectId) return null;
  try {
    return await getProjectContext(projectId);
  } catch {
    return null;
  }
}

function assertSafeRemoteUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === "[::1]"
  ) {
    return null;
  }
  return url;
}

async function readCapped(response: Response, cap: number): Promise<Uint8Array | null> {
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.byteLength;
      if (total > cap) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

const EXTENSION_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  pdf: "application/pdf",
};

function extensionForMime(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/svg+xml") return "svg";
  return mime.split("/")[1] ?? "bin";
}

function filenameFromUrl(url: URL, mime: string): string {
  const last = url.pathname.split("/").filter(Boolean).pop();
  const decoded = last ? decodeURIComponent(last) : "";
  const cleaned = decoded.replace(/[^\w.\-]+/g, "-").replace(/^-+|-+$/g, "");
  if (cleaned && /\.[a-z0-9]+$/i.test(cleaned)) return cleaned.slice(-120);
  if (cleaned) return `${cleaned.slice(0, 100)}.${extensionForMime(mime)}`;
  return `imported-${Date.now()}.${extensionForMime(mime)}`;
}

async function patchAsset(
  assetId: string,
  patch: { alt_text: string | null; tags: string[]; width: number | null; height: number | null; source: string },
): Promise<Asset> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assets")
    .update(patch)
    .eq("id", assetId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as Asset;
}

export async function GET(request: Request) {
  const projectId = new URL(request.url).searchParams.get("projectId") ?? "";
  const ctx = await projectFor(projectId);
  if (!ctx) return fail("Project not found.", 404);

  const assets = (await listAssets(projectId)) as Asset[];
  return NextResponse.json({ assets });
}

export async function POST(request: Request) {
  const contentType = normalizeMime(request.headers.get("content-type"));
  try {
    if (contentType === "application/json") {
      return await handleUrlImport(request);
    }
    return await handleMultipart(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    return fail(message, 500);
  }
}

async function handleMultipart(request: Request): Promise<NextResponse> {
  const form = await request.formData();
  const projectId = String(form.get("projectId") ?? "").trim();
  const ctx = await projectFor(projectId);
  if (!ctx) return fail("Project not found.", 404);
  if (!ctx.canEdit) return fail("You do not have permission to upload assets to this project.", 403);

  const file = form.get("file");
  if (!(file instanceof File)) return fail("No file was received.");

  if (file.size <= 0) return fail("That file is empty.");
  if (file.size > MAX_UPLOAD_BYTES) {
    return fail(`Files must be ${formatBytes(MAX_UPLOAD_BYTES)} or smaller.`, 413);
  }

  const originalName = (file.name || `asset-${Date.now()}`).replace(/[/\\]/g, "-").slice(-160);
  let mime = normalizeMime(file.type);
  if (!mime) mime = EXTENSION_MIME[fileExtension(originalName)] ?? "";
  if (!MIME_SET.has(mime)) {
    return fail("Unsupported file type. Use JPEG, PNG, WebP, GIF, SVG, MP4 or PDF.", 415);
  }

  const altText = String(form.get("altText") ?? "").trim().slice(0, 300) || null;
  const tags = readTags(form.get("tags"));
  const width = asPositiveInt(form.get("width"));
  const height = asPositiveInt(form.get("height"));
  const source = String(form.get("source") ?? "upload") === "url" ? "url" : "upload";

  const created = await uploadProjectAsset({
    projectId,
    file,
    filename: originalName,
    contentType: mime,
  });

  const asset = await patchAsset(String(created.id), {
    alt_text: altText,
    tags,
    width,
    height,
    source,
  });

  await logActivity({
    projectId,
    action: "asset.uploaded",
    targetType: "asset",
    targetId: asset.id,
    summary: `Uploaded ${asset.filename}`,
  });
  void emitWebhookEvent("asset.uploaded", projectId, {
    id: asset.id,
    filename: asset.filename,
    public_url: asset.public_url,
    mime_type: asset.mime_type,
    size_bytes: asset.size_bytes,
  }).catch(() => undefined);

  return NextResponse.json({ asset }, { status: 201 });
}

async function handleUrlImport(request: Request): Promise<NextResponse> {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return fail("Invalid JSON body.");
  }

  const projectId = String(body.projectId ?? "").trim();
  const ctx = await projectFor(projectId);
  if (!ctx) return fail("Project not found.", 404);
  if (!ctx.canEdit) return fail("You do not have permission to upload assets to this project.", 403);

  const rawUrl = String(body.url ?? "").trim();
  const url = assertSafeRemoteUrl(rawUrl);
  if (!url) return fail("Enter a valid public http(s) image URL.");

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
      headers: { Accept: "image/*,application/pdf,video/mp4;q=0.9,*/*;q=0.1" },
    });
  } catch {
    return fail("Could not reach that URL.", 422);
  }
  if (!response.ok) return fail(`That URL responded with HTTP ${response.status}.`, 422);

  const declared = normalizeMime(response.headers.get("content-type"));
  let mime = MIME_SET.has(declared) ? declared : "";
  if (!mime) {
    const guessed = EXTENSION_MIME[fileExtension(url.pathname)];
    if (guessed && MIME_SET.has(guessed)) mime = guessed;
  }
  if (!mime) return fail("That URL did not return a supported image, video or PDF.", 415);

  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_UPLOAD_BYTES) {
    return fail(`Files must be ${formatBytes(MAX_UPLOAD_BYTES)} or smaller.`, 413);
  }

  const bytes = await readCapped(response, MAX_UPLOAD_BYTES);
  if (!bytes) return fail(`That file is larger than ${formatBytes(MAX_UPLOAD_BYTES)}.`, 413);
  if (!bytes.byteLength) return fail("That URL returned an empty file.", 422);

  const filenameField = String(body.filename ?? "").trim();
  const filename = (filenameField || filenameFromUrl(url, mime)).replace(/[/\\]/g, "-").slice(-160);
  const altText = String(body.altText ?? "").trim().slice(0, 300) || null;
  const tags = readTags(body.tags);

  const blobBytes = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(blobBytes).set(bytes);
  const blob = new Blob([blobBytes], { type: mime });
  const created = await uploadProjectAsset({
    projectId,
    file: blob,
    filename,
    contentType: mime,
  });

  const asset = await patchAsset(String(created.id), {
    alt_text: altText,
    tags,
    width: asPositiveInt(body.width),
    height: asPositiveInt(body.height),
    source: "url",
  });

  await logActivity({
    projectId,
    action: "asset.imported",
    targetType: "asset",
    targetId: asset.id,
    summary: `Imported ${asset.filename} from URL`,
  });
  void emitWebhookEvent("asset.uploaded", projectId, {
    id: asset.id,
    filename: asset.filename,
    public_url: asset.public_url,
    mime_type: asset.mime_type,
    size_bytes: asset.size_bytes,
    source: "url",
  }).catch(() => undefined);

  return NextResponse.json({ asset }, { status: 201 });
}
