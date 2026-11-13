import { headers } from "next/headers";
import { getProjectContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { ProjectSettingsTabs, type SettingsTab } from "@/components/projects/project-settings-tabs";
import { ProjectSettingsGeneral } from "@/components/projects/project-settings-general";
import {
  ProjectSettingsCollaborators,
  type InviteView,
  type MemberView,
} from "@/components/projects/project-settings-collaborators";
import { ProjectSettingsDanger } from "@/components/projects/project-settings-danger";
import { WebhooksSection } from "@/components/webhooks/webhooks-section";
import { Badge } from "@/components/ui/badge";
import type { Role } from "@/lib/types";

export const metadata = { title: "Project settings" };

const TABS: SettingsTab[] = ["general", "collaborators", "history", "webhooks", "danger"];

async function siteOrigin() {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const proto = h.get("x-forwarded-proto") ?? "https";
    if (host) return `${proto}://${host}`;
  } catch {
    // ignore
  }
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export default async function ProjectSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab: rawTab } = await searchParams;
  const tab: SettingsTab = TABS.find((t) => t === rawTab) ?? "general";

  const { project, role, canEdit, isOwner, members, profile } = await getProjectContext(id);

  const memberViews: MemberView[] = members
    .map((m) => ({
      user_id: m.user_id,
      role: m.role,
      invited_at: m.invited_at,
      accepted_at: m.accepted_at,
      name: m.profile?.display_name ?? m.profile?.email?.split("@")[0] ?? "Collaborator",
      email: m.profile?.email ?? null,
      avatar_url: m.profile?.avatar_url ?? null,
    }))
    .sort((a, b) => (a.role === "owner" ? -1 : b.role === "owner" ? 1 : a.name.localeCompare(b.name)));

  // The owner always appears, even if their project_members row is missing.
  if (!memberViews.some((m) => m.role === "owner")) {
    const isMe = profile?.id === project.owner_id;
    memberViews.unshift({
      user_id: project.owner_id,
      role: "owner",
      invited_at: project.created_at,
      accepted_at: project.created_at,
      name: isMe ? profile?.display_name ?? "Owner" : "Project owner",
      email: isMe ? profile?.email ?? null : null,
      avatar_url: isMe ? profile?.avatar_url ?? null : null,
    });
  }

  let invites: InviteView[] = [];
  if (isOwner) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("project_invites")
      .select("id, email, role, created_at, expires_at, token")
      .eq("project_id", id)
      .is("accepted_at", null)
      .order("created_at", { ascending: false });
    const origin = await siteOrigin();
    invites = (data ?? []).map((invite) => ({
      id: invite.id as string,
      email: invite.email as string,
      role: invite.role as Role,
      created_at: invite.created_at as string,
      expires_at: invite.expires_at as string,
      link: `${origin}/invite/${invite.token as string}`,
    }));
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 md:px-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-accent">Project settings</p>
          <h1 className="mt-1.5 font-serif text-3xl font-semibold tracking-[-0.01em]">{project.title}</h1>
          <p className="mt-1 text-sm text-muted">Identity, collaborators and the paper trail.</p>
        </div>
        <Badge tone={role === "owner" ? "accent" : "plum"} className="capitalize">
          {role}
        </Badge>
      </div>

      <div className="mt-6">
        <ProjectSettingsTabs projectId={id} active={tab} />
      </div>

      <div className="mt-6">
        {tab === "general" && <ProjectSettingsGeneral project={project} canEdit={canEdit} />}

        {tab === "collaborators" && (
          <ProjectSettingsCollaborators
            projectId={id}
            members={memberViews}
            invites={invites}
            isOwner={isOwner}
            currentUserId={profile?.id ?? ""}
          />
        )}

        {tab === "webhooks" && (
          <section className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4">
              <h2 className="font-serif text-lg leading-tight">Webhooks</h2>
              <p className="mt-0.5 text-xs leading-relaxed text-muted">
                Send signed events to your own endpoints when chapters, assets, exports or comments change.
              </p>
            </div>
            {isOwner ? (
              <WebhooksSection projectId={id} />
            ) : (
              <p className="rounded-md border border-border bg-ink-900/50 px-3 py-2 text-xs text-muted">
                Only the project owner can view and manage webhooks.
              </p>
            )}
          </section>
        )}

        {tab === "danger" && (
          <ProjectSettingsDanger
            projectId={id}
            projectTitle={project.title}
            isOwner={isOwner}
            members={memberViews.map((m) => ({ user_id: m.user_id, name: m.name, role: m.role }))}
          />
        )}
      </div>
    </div>
  );
}
