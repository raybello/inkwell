import { createAdminClient } from "@/lib/supabase/admin";
import { toMarkdown, type TipTapDoc } from "@/lib/api/content";
import type { Chapter } from "@/lib/types";

export async function loadApiChapter(projectId: string, chapterId: string): Promise<Chapter | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("chapters")
    .select("*")
    .eq("id", chapterId)
    .eq("project_id", projectId)
    .maybeSingle<Chapter>();
  if (error) throw new Error(error.message);
  return data;
}

/** Writes a TipTap doc back to `content` and keeps `content_md` in sync. */
export async function persistChapterContent(
  projectId: string,
  chapterId: string,
  doc: TipTapDoc,
  extra: Record<string, unknown> = {},
): Promise<Chapter> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("chapters")
    .update({ ...extra, content: doc, content_md: toMarkdown(doc) })
    .eq("id", chapterId)
    .eq("project_id", projectId)
    .select("*")
    .single<Chapter>();
  if (error || !data) throw new Error(error?.message ?? "Could not save chapter content.");
  return data;
}
