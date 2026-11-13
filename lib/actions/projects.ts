"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile, getSessionUser } from "@/lib/auth";
import { formatProjectsLimit, planLimits, planName } from "@/lib/plans";
import type { ProjectType } from "@/lib/types";

export type ActionState = { error?: string; success?: string } | null;

/**
 * Project quota. Admins (profiles.is_admin) are never limited.
 * Returns an error message when the account is at its plan's cap.
 */
async function projectQuotaError(userId: string): Promise<string | null> {
  const profile = await getProfile();
  if (profile?.is_admin) return null;

  const supabase = await createClient();
  const { count } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId);

  const limit = planLimits(profile?.plan).projects;
  if (limit == null) return null;

  if ((count ?? 0) >= limit) {
    return `The ${planName(profile?.plan)} plan includes ${formatProjectsLimit(limit)}. Delete a project or upgrade to add another.`;
  }
  return null;
}

function str(fd: FormData, key: string) {
  const v = fd.get(key);
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export async function createProjectAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return { error: "You must be signed in." };

  const title = str(fd, "title");
  if (!title) return { error: "Give the project a working title." };

  const quota = await projectQuotaError(user.id);
  if (quota) return { error: quota };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({
      owner_id: user.id,
      title,
      subtitle: str(fd, "subtitle"),
      type: (str(fd, "type") ?? "book") as ProjectType,
      genre: str(fd, "genre"),
      description: str(fd, "description"),
      target_word_count: Number(fd.get("target_word_count") ?? 0) || 0,
      publishing_target: str(fd, "publishing_target"),
      tags: String(fd.get("tags") ?? "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // first chapter so the writer lands somewhere
  await supabase.from("chapters").insert({
    project_id: data.id,
    title: "Chapter One",
    position: 0,
    status: "draft",
    content_md: "",
  });

  revalidatePath("/app");
  redirect(`/app/projects/${data.id}`);
}

export async function updateProjectAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = String(fd.get("id") ?? "");
  if (!id) return { error: "Missing project." };
  const supabase = await createClient();

  const patch: Record<string, unknown> = {};
  for (const key of [
    "title",
    "subtitle",
    "type",
    "genre",
    "description",
    "publishing_target",
    "cover_image_url",
    "status",
  ]) {
    if (fd.has(key)) patch[key] = str(fd, key);
  }
  if (fd.has("target_word_count"))
    patch.target_word_count = Number(fd.get("target_word_count") ?? 0) || 0;
  if (fd.has("tags"))
    patch.tags = String(fd.get("tags") ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

  const { error } = await supabase.from("projects").update(patch).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/app/projects/${id}`);
  revalidatePath("/app");
  return { success: "Project updated." };
}

export async function deleteProjectAction(id: string): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/app");
  redirect("/app");
}

export async function duplicateProjectAction(id: string): Promise<ActionState> {
  const user = await getSessionUser();
  if (!user) return { error: "You must be signed in." };
  const quota = await projectQuotaError(user.id);
  if (quota) return { error: quota };

  const supabase = await createClient();

  const { data: project } = await supabase.from("projects").select("*").eq("id", id).single();
  if (!project) return { error: "Project not found." };

  const { id: _drop, created_at, updated_at, share_token, ...rest } = project;
  const { data: copy, error } = await supabase
    .from("projects")
    .insert({ ...rest, title: `${project.title} (copy)`, owner_id: user.id })
    .select("id")
    .single();
  if (error || !copy) return { error: error?.message ?? "Could not duplicate." };

  const { data: chapters } = await supabase.from("chapters").select("*").eq("project_id", id);
  if (chapters?.length) {
    const rows = chapters.map(({ id: _id, created_at, updated_at, ...c }) => ({
      ...c,
      project_id: copy.id,
    }));
    await supabase.from("chapters").insert(rows);
  }

  revalidatePath("/app");
  redirect(`/app/projects/${copy.id}`);
}
