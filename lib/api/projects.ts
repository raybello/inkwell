import { createAdminClient } from "@/lib/supabase/admin";
import type { Project } from "@/lib/types";
import type { ApiAuth, ProjectRole } from "@/lib/api/types";

export interface ProjectAccessOk {
  ok: true;
  project: Project;
  role: ProjectRole;
  canEdit: boolean;
}

export interface ProjectAccessErr {
  ok: false;
  status: 403 | 404;
  code: "not_found" | "forbidden";
  message: string;
}

export type ProjectAccess = ProjectAccessOk | ProjectAccessErr;

const WRITE_ROLES: ProjectRole[] = ["owner", "editor"];

/**
 * Verifies that the API key's workspace can reach the project.
 *
 * API calls have no session, so this uses the service-role client and checks
 * membership explicitly. `need: "write"` requires owner/editor.
 *
 * Non-members get a 404 (not 403) so the API never leaks the existence of a
 * project the key cannot see.
 */
export async function getApiProject(
  auth: ApiAuth,
  projectId: string,
  need: "read" | "write" = "read",
): Promise<ProjectAccess> {
  if (!isUuid(projectId)) {
    return { ok: false, status: 404, code: "not_found", message: "Project not found." };
  }

  const admin = createAdminClient();
  const { data: project, error } = await admin
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle<Project>();

  if (error) throw new Error(`projects lookup failed: ${error.message}`);

  if (!project) {
    return { ok: false, status: 404, code: "not_found", message: "Project not found." };
  }

  let role: ProjectRole | null = project.owner_id === auth.userId ? "owner" : null;

  if (!role) {
    const { data: member, error: memberError } = await admin
      .from("project_members")
      .select("role, accepted_at")
      .eq("project_id", projectId)
      .eq("user_id", auth.userId)
      .not("accepted_at", "is", null)
      .maybeSingle<{ role: ProjectRole; accepted_at: string | null }>();
    if (memberError) throw new Error(`project_members lookup failed: ${memberError.message}`);
    role = member?.role ?? null;
  }

  if (!role) {
    return { ok: false, status: 404, code: "not_found", message: "Project not found." };
  }

  const canEdit = WRITE_ROLES.includes(role);

  if (need === "write" && !canEdit) {
    return {
      ok: false,
      status: 403,
      code: "forbidden",
      message: "This key's workspace has read-only access to this project.",
    };
  }

  return { ok: true, project, role, canEdit };
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
