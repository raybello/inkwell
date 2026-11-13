import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withApi, json, apiError } from "@/lib/api/respond";
import { authorize } from "@/lib/api/auth";
import { createProjectSchema, paginationSchema } from "@/lib/api/schemas";
import { serializeProject } from "@/lib/api/serialize";
import { validateBody, validateQuery } from "@/lib/api/validate";
import type { Project } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const listQuerySchema = paginationSchema;

export const GET = withApi(async (request: NextRequest, _ctx: unknown, meta) => {
  const auth = await authorize(request, meta, "projects:read");
  if (!auth.ok) return auth.response;

  const query = validateQuery(request, listQuerySchema, auth.meta);
  if (!query.ok) return query.response;

  const admin = createAdminClient();
  const { data: memberships, error: memberError } = await admin
    .from("project_members")
    .select("project_id, role")
    .eq("user_id", auth.auth.userId)
    .not("accepted_at", "is", null);
  if (memberError) throw new Error(memberError.message);

  const roles = new Map<string, string>(
    (memberships ?? []).map((m: { project_id: string; role: string }) => [m.project_id, m.role]),
  );
  const ids = Array.from(roles.keys());

  // Owners are members via trigger, but include owner_id explicitly so a project
  // can never disappear from the list if a membership row is missing.
  let listQuery = admin.from("projects").select("*", { count: "exact" });
  listQuery = ids.length
    ? listQuery.or(`owner_id.eq.${auth.auth.userId},id.in.(${ids.join(",")})`)
    : listQuery.eq("owner_id", auth.auth.userId);

  const { data: projects, count: totalCount, error } = await listQuery
    .order("updated_at", { ascending: false })
    .range(query.data.offset, query.data.offset + query.data.limit - 1);
  if (error) throw new Error(error.message);

  const rows = (projects ?? []) as Project[];
  const pageIds = rows.map((p) => p.id);
  const counts = new Map<string, { chapters: number; words: number }>();
  if (pageIds.length) {
    const { data: chapters } = await admin
      .from("chapters")
      .select("project_id, word_count")
      .in("project_id", pageIds);
    for (const chapter of (chapters ?? []) as { project_id: string; word_count: number }[]) {
      const current = counts.get(chapter.project_id) ?? { chapters: 0, words: 0 };
      current.chapters += 1;
      current.words += chapter.word_count ?? 0;
      counts.set(chapter.project_id, current);
    }
  }

  return json(
    {
      data: rows.map((project) => {
        const stat = counts.get(project.id) ?? { chapters: 0, words: 0 };
        return serializeProject(project, {
          role: project.owner_id === auth.auth.userId ? "owner" : (roles.get(project.id) ?? null),
          chapter_count: stat.chapters,
          word_count: stat.words,
        });
      }),
      pagination: { limit: query.data.limit, offset: query.data.offset, total: totalCount ?? rows.length },
    },
    auth.meta,
  );
});

export const POST = withApi(async (request: NextRequest, _ctx: unknown, meta) => {
  const auth = await authorize(request, meta, "projects:write");
  if (!auth.ok) return auth.response;

  const body = await validateBody(request, createProjectSchema, auth.meta);
  if (!body.ok) return body.response;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("projects")
    .insert({
      owner_id: auth.auth.userId,
      title: body.data.title,
      subtitle: body.data.subtitle ?? null,
      type: body.data.type,
      genre: body.data.genre ?? null,
      description: body.data.description ?? null,
      cover_image_url: body.data.cover_image_url ?? null,
      target_word_count: body.data.target_word_count ?? 0,
      publishing_target: body.data.publishing_target ?? null,
      tags: body.data.tags ?? [],
      settings: body.data.settings ?? {},
    })
    .select("*")
    .single<Project>();

  if (error || !data) {
    return apiError(500, "internal_error", error?.message ?? "Could not create project.", undefined, auth.meta);
  }

  return json({ data: serializeProject(data, { role: "owner", chapter_count: 0, word_count: 0 }) }, auth.meta, {
    status: 201,
    headers: { Location: `/api/v1/projects/${data.id}` },
  });
});
