import { createAdminClient } from "@/lib/supabase/admin";
import { publicAssetUrl } from "@/lib/storage";
import { slugify } from "@/lib/utils";
import { ALLOWED_ASSET_MIME, MAX_ASSET_BYTES } from "@/lib/api/schemas";

export interface StoredAsset {
  id: string;
  filename: string;
  storage_path: string;
  public_url: string | null;
  mime_type: string | null;
  size_bytes: number;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  source: string;
  tags: string[] | null;
  created_at: string;
}

function extensionFor(filename: string, mimeType: string): string {
  const fromName = /\.([a-z0-9]{1,8})$/i.exec(filename);
  if (fromName) return fromName[1].toLowerCase();
  const byMime: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/svg+xml": "svg",
    "video/mp4": "mp4",
    "application/pdf": "pdf",
  };
  return byMime[mimeType] ?? "bin";
}

export function assertAllowedMime(mimeType: string): string | null {
  const normalized = mimeType.split(";")[0].trim().toLowerCase();
  if (!(ALLOWED_ASSET_MIME as readonly string[]).includes(normalized)) {
    return `Unsupported media type "${mimeType}". Allowed: ${ALLOWED_ASSET_MIME.join(", ")}.`;
  }
  return null;
}

/**
 * Uploads bytes to the public `assets` bucket and inserts the `assets` row using
 * the service-role client. API-key requests have no user session, so
 * `uploadProjectAsset` (session-scoped) cannot be used here — this mirrors it
 * with an explicit uploader id.
 */
export async function storeProjectAsset(params: {
  projectId: string;
  uploaderId: string | null;
  bytes: ArrayBuffer | Uint8Array;
  filename: string;
  mimeType: string;
  altText?: string | null;
  tags?: string[];
  source?: "upload" | "ai" | "url";
  width?: number | null;
  height?: number | null;
}): Promise<StoredAsset> {
  const size = params.bytes instanceof ArrayBuffer ? params.bytes.byteLength : params.bytes.byteLength;
  if (size > MAX_ASSET_BYTES) {
    throw new Error(`Asset exceeds the ${Math.round(MAX_ASSET_BYTES / 1024 / 1024)} MB limit.`);
  }

  const mimeError = assertAllowedMime(params.mimeType);
  if (mimeError) throw new Error(mimeError);

  const admin = createAdminClient();
  const ext = extensionFor(params.filename, params.mimeType);
  const path = `${params.projectId}/${Date.now()}-${slugify(
    params.filename.replace(/\.[^.]+$/, ""),
  ).slice(0, 60) || "asset"}.${ext}`;

  const body = params.bytes instanceof ArrayBuffer ? new Uint8Array(params.bytes) : params.bytes;
  const { error: uploadError } = await admin.storage
    .from("assets")
    .upload(path, body, { contentType: params.mimeType, upsert: false });
  if (uploadError) throw new Error(`Storage upload failed: ${uploadError.message}`);

  const url = publicAssetUrl(path);
  const { data, error } = await admin
    .from("assets")
    .insert({
      project_id: params.projectId,
      uploader_id: params.uploaderId,
      filename: params.filename,
      storage_path: path,
      public_url: url,
      mime_type: params.mimeType,
      size_bytes: size,
      width: params.width ?? null,
      height: params.height ?? null,
      alt_text: params.altText ?? null,
      source: params.source ?? "upload",
      tags: params.tags ?? [],
    })
    .select(
      "id, filename, storage_path, public_url, mime_type, size_bytes, width, height, alt_text, source, tags, created_at",
    )
    .single<StoredAsset>();

  if (error || !data) throw new Error(`Asset record insert failed: ${error?.message ?? "unknown"}`);
  return data;
}

export async function removeProjectAsset(projectId: string, assetId: string) {
  const admin = createAdminClient();
  const { data: asset, error } = await admin
    .from("assets")
    .select("id, storage_path")
    .eq("id", assetId)
    .eq("project_id", projectId)
    .maybeSingle<{ id: string; storage_path: string }>();
  if (error) throw new Error(error.message);
  if (!asset) return false;

  await admin.storage.from("assets").remove([asset.storage_path]);
  const { error: deleteError } = await admin
    .from("assets")
    .delete()
    .eq("id", assetId)
    .eq("project_id", projectId);
  if (deleteError) throw new Error(deleteError.message);
  return true;
}
