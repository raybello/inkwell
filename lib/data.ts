import { notFound } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Chapter, Project, ProjectMember, Role } from "@/lib/types";

export interface ProjectSummary extends Project {
  wordCount: number;
  chapterCount: number;
  memberCount: number;
  role: Role | null;
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .order("updated_at", { ascending: false });
  if (!projects?.length) return [];

  const ids = projects.map((p) => p.id);
  const [{ data: chapters }, { data: members }] = await Promise.all([
    supabase.from("chapters").select("project_id, word_count").in("project_id", ids),
    supabase.from("project_members").select("project_id, user_id, role").in("project_id", ids),
  ]);

  return (projects as Project[]).map((p) => {
    const chs = (chapters ?? []).filter((c) => c.project_id === p.id);
    const mem = (members ?? []).filter((m) => m.project_id === p.id);
    const mine = mem.find((m) => m.user_id === user?.id);
    const role: Role | null =
      p.owner_id === user?.id ? "owner" : ((mine?.role as Role | undefined) ?? null);
    return {
      ...p,
      wordCount: chs.reduce((sum, c) => sum + (c.word_count ?? 0), 0),
      chapterCount: chs.length,
      memberCount: mem.length,
      role,
    };
  });
}

export const getProject = cache(async (id: string) => {
  const supabase = await createClient();
  const { data } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
  return (data as Project) ?? null;
});

export const getProjectContext = cache(async (id: string) => {
  const supabase = await createClient();
  const { data: project } = await supabase.from("projects").select("*").eq("id", id).maybeSingle();
  if (!project) notFound();

  const [{ data: role }, { data: membership }, { data: profile }] = await Promise.all([
    supabase.rpc("project_role", { p: id }),
    supabase.from("project_members").select("*").eq("project_id", id),
    supabase.from("profiles").select("*").eq("id", (await supabase.auth.getUser()).data.user?.id ?? "").maybeSingle(),
  ]);

  const myRole = (role as unknown as Role | null) ?? (project.owner_id === profile?.id ? "owner" : null);
  if (!myRole) notFound();

  const members: ProjectMember[] = (membership ?? []) as ProjectMember[];
  if (members.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .in("id", members.map((m) => m.user_id));
    for (const m of members) m.profile = profiles?.find((p) => p.id === m.user_id) ?? null;
  }

  return {
    project: project as Project,
    role: myRole,
    canEdit: myRole === "owner" || myRole === "editor",
    canComment: myRole !== "viewer",
    isOwner: myRole === "owner",
    members,
    profile: profile ?? null,
  };
});

export async function listChapters(projectId: string): Promise<Chapter[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("chapters")
    .select("*")
    .eq("project_id", projectId)
    .order("position", { ascending: true });
  return (data ?? []) as Chapter[];
}

export async function listAssets(projectId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("assets")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export function projectWordCount(chapters: Chapter[]) {
  return chapters.reduce((s, c) => s + (c.word_count ?? 0), 0);
}
