import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { slugify } from "@/lib/utils";

export const ASSET_BUCKET = "assets";

export function publicAssetUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${ASSET_BUCKET}/${path}`;
}

export async function uploadProjectAsset(params: {
  projectId: string;
  file: File | Blob;
  filename: string;
  contentType?: string;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const ext = params.filename.includes(".") ? params.filename.split(".").pop() : "bin";
  const path = `${params.projectId}/${Date.now()}-${slugify(params.filename.replace(/\.[^.]+$/, ""))}.${ext}`;

  const { error } = await supabase.storage.from(ASSET_BUCKET).upload(path, params.file, {
    contentType: params.contentType,
    upsert: false,
  });
  if (error) throw new Error(error.message);

  const url = publicAssetUrl(path);
  const { data, error: dbError } = await supabase
    .from("assets")
    .insert({
      project_id: params.projectId,
      uploader_id: user.id,
      filename: params.filename,
      storage_path: path,
      public_url: url,
      mime_type: params.contentType ?? null,
      size_bytes: params.file.size,
    })
    .select("*")
    .single();
  if (dbError) throw new Error(dbError.message);
  return data;
}

export async function deleteProjectAsset(assetId: string) {
  const supabase = await createClient();
  const { data: asset } = await supabase.from("assets").select("*").eq("id", assetId).single();
  if (!asset) throw new Error("Asset not found");
  await supabase.storage.from(ASSET_BUCKET).remove([asset.storage_path]);
  const { error } = await supabase.from("assets").delete().eq("id", assetId);
  if (error) throw new Error(error.message);
  return true;
}

export async function signedAssetUrl(path: string, expiresIn = 3600) {
  const admin = createAdminClient();
  const { data } = await admin.storage.from(ASSET_BUCKET).createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}

export async function uploadExport(name: string, body: Uint8Array | Buffer, contentType: string) {
  const admin = createAdminClient();
  const path = `${new Date().toISOString().slice(0, 10)}/${name}`;
  const { error } = await admin.storage.from("exports").upload(path, body, { contentType, upsert: true });
  if (error) throw new Error(error.message);
  const { data } = admin.storage.from("exports").getPublicUrl(path);
  return { path, url: data.publicUrl };
}
