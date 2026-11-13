"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth";
import { getProjectContext } from "@/lib/data";
import { collaboratorInviteEmail, sendEmail } from "@/lib/email";
import { logActivity, notify } from "@/lib/activity";
import type { Role } from "@/lib/types";

const INVITABLE_ROLES: Role[] = ["editor", "reviewer", "viewer"];

export interface InviteResult {
  ok: boolean;
  error?: string;
  /** Always returned so the owner can copy a link when email is unavailable. */
  link?: string;
  emailed?: boolean;
  inviteId?: string;
}

async function siteOrigin() {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const proto = h.get("x-forwarded-proto") ?? "https";
    if (host) return `${proto}://${host}`;
  } catch {
    // headers() unavailable (static context) — fall through
  }
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/**
 * Invitation email — rendered and delivered through lib/email, which reports
 * `{ sent: false }` when RESEND_API_KEY is absent. The caller always returns a
 * copyable link so invitations work with no email provider at all.
 */
async function sendInviteEmail(input: {
  to: string;
  projectTitle: string;
  inviterName: string;
  role: Role;
  link: string;
  replyTo?: string | null;
}): Promise<boolean> {
  try {
    const rendered = collaboratorInviteEmail({
      inviterName: input.inviterName,
      projectTitle: input.projectTitle,
      role: input.role,
      acceptUrl: input.link,
    });
    const result = await sendEmail({
      to: input.to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      replyTo: input.replyTo ?? undefined,
    });
    return result.sent;
  } catch {
    // Email must never break the invite; the link is still returned.
    return false;
  }
}

export async function inviteMember(input: {
  projectId: string;
  email: string;
  role: Role;
}): Promise<InviteResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sign in first." };

  const email = (input.email ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Enter a valid email address." };
  if (!INVITABLE_ROLES.includes(input.role)) return { ok: false, error: "Pick a role: editor, reviewer or viewer." };

  let ctx: Awaited<ReturnType<typeof getProjectContext>> | null = null;
  try {
    ctx = await getProjectContext(input.projectId);
  } catch {
    ctx = null;
  }
  if (!ctx) return { ok: false, error: "You do not have access to this project." };
  if (!ctx.isOwner) return { ok: false, error: "Only the project owner can invite collaborators." };

  const supabase = await createClient();

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id, email, display_name")
    .ilike("email", email)
    .maybeSingle();

  if (existingProfile) {
    if (existingProfile.id === ctx.project.owner_id) return { ok: false, error: "That person already owns this project." };
    const already = ctx.members.find((m) => m.user_id === existingProfile.id);
    if (already) return { ok: false, error: `${email} is already a collaborator.` };
  }

  const { data: pending } = await supabase
    .from("project_invites")
    .select("id, token")
    .eq("project_id", input.projectId)
    .eq("email", email)
    .is("accepted_at", null)
    .maybeSingle();

  let inviteId: string;
  let token: string;

  if (pending) {
    const { data, error } = await supabase
      .from("project_invites")
      .update({
        role: input.role,
        invited_by: user.id,
        expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
      })
      .eq("id", pending.id)
      .select("id, token")
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Could not update the invitation." };
    inviteId = data.id;
    token = data.token;
  } else {
    const { data, error } = await supabase
      .from("project_invites")
      .insert({
        project_id: input.projectId,
        email,
        role: input.role,
        invited_by: user.id,
      })
      .select("id, token")
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Could not create the invitation." };
    inviteId = data.id;
    token = data.token;
  }

  const link = `${await siteOrigin()}/invite/${token}`;
  const inviterName = ctx.profile?.display_name ?? user.email?.split("@")[0] ?? "A collaborator";
  const emailed = await sendInviteEmail({
    to: email,
    projectTitle: ctx.project.title,
    inviterName,
    role: input.role,
    link,
    replyTo: ctx.profile?.email ?? null,
  });

  if (existingProfile?.id) {
    await notify({
      userId: existingProfile.id,
      projectId: input.projectId,
      kind: "invite",
      title: `${inviterName} invited you to “${ctx.project.title}”`,
      body: `You've been invited as ${input.role}.`,
      link: `/invite/${token}`,
    });
  }

  await logActivity({
    projectId: input.projectId,
    action: "member.invited",
    targetType: "invite",
    targetId: inviteId,
    summary: `invited ${email} as ${input.role}`,
  });

  revalidatePath(`/app/projects/${input.projectId}/settings`);
  return { ok: true, link, emailed, inviteId };
}

export async function revokeInvite(inviteId: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sign in first." };

  const supabase = await createClient();
  const { data: invite } = await supabase
    .from("project_invites")
    .select("id, project_id, email")
    .eq("id", inviteId)
    .maybeSingle();
  if (!invite) return { ok: false, error: "That invitation no longer exists." };

  let ctx: Awaited<ReturnType<typeof getProjectContext>> | null = null;
  try {
    ctx = await getProjectContext(invite.project_id);
  } catch {
    ctx = null;
  }
  if (!ctx?.isOwner) return { ok: false, error: "Only the project owner can revoke invitations." };

  const { error } = await supabase.from("project_invites").delete().eq("id", inviteId);
  if (error) return { ok: false, error: error.message };

  await logActivity({
    projectId: invite.project_id,
    action: "member.invite_revoked",
    targetType: "invite",
    targetId: inviteId,
    summary: `revoked the invitation for ${invite.email}`,
  });

  revalidatePath(`/app/projects/${invite.project_id}/settings`);
  return { ok: true };
}

export async function changeRole(input: {
  projectId: string;
  userId: string;
  role: Role;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sign in first." };
  if (!INVITABLE_ROLES.includes(input.role)) return { ok: false, error: "Owners can hand over ownership from the Danger zone." };

  let ctx: Awaited<ReturnType<typeof getProjectContext>> | null = null;
  try {
    ctx = await getProjectContext(input.projectId);
  } catch {
    ctx = null;
  }
  if (!ctx?.isOwner) return { ok: false, error: "Only the project owner can change roles." };
  if (input.userId === ctx.project.owner_id) return { ok: false, error: "The owner's role can't be changed here." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("project_members")
    .update({ role: input.role })
    .eq("project_id", input.projectId)
    .eq("user_id", input.userId);
  if (error) return { ok: false, error: error.message };

  await logActivity({
    projectId: input.projectId,
    action: "member.role_changed",
    targetType: "member",
    targetId: input.userId,
    summary: `changed a collaborator's role to ${input.role}`,
  });

  await notify({
    userId: input.userId,
    projectId: input.projectId,
    kind: "role",
    title: `Your role in “${ctx.project.title}” is now ${input.role}`,
    link: `/app/projects/${input.projectId}`,
  });

  revalidatePath(`/app/projects/${input.projectId}/settings`);
  return { ok: true };
}

export async function removeMember(input: {
  projectId: string;
  userId: string;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sign in first." };

  let ctx: Awaited<ReturnType<typeof getProjectContext>> | null = null;
  try {
    ctx = await getProjectContext(input.projectId);
  } catch {
    ctx = null;
  }
  if (!ctx) return { ok: false, error: "You do not have access to this project." };
  if (input.userId === ctx.project.owner_id) return { ok: false, error: "The owner can't be removed." };

  const leaving = input.userId === user.id;
  if (!ctx.isOwner && !leaving) return { ok: false, error: "Only the project owner can remove collaborators." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("project_members")
    .delete()
    .eq("project_id", input.projectId)
    .eq("user_id", input.userId);
  if (error) return { ok: false, error: error.message };

  await logActivity({
    projectId: input.projectId,
    action: leaving ? "member.left" : "member.removed",
    targetType: "member",
    targetId: input.userId,
  });

  revalidatePath(`/app/projects/${input.projectId}/settings`);
  return { ok: true };
}

/**
 * Accepting an invitation writes a project_members row for the *invitee*, which
 * the owner-only RLS policy on project_members forbids for a session client.
 * The service-role client is therefore used here — after the token, expiry and
 * identity have been verified server-side.
 */
export async function acceptInvite(token: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sign in to accept this invitation." };

  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("project_invites")
    .select("*")
    .eq("token", token)
    .maybeSingle();

  if (!invite) return { ok: false, error: "This invitation link is not valid." };
  if (invite.accepted_at) return { ok: false, error: "This invitation has already been used." };
  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now())
    return { ok: false, error: "This invitation has expired. Ask the owner for a new link." };

  // If the invited email belongs to an existing account, that account must accept it.
  const { data: owner } = await admin
    .from("profiles")
    .select("id, email, display_name")
    .ilike("email", invite.email)
    .maybeSingle();
  if (owner && owner.id !== user.id) {
    return {
      ok: false,
      error: `This invitation was sent to ${invite.email}. Sign in with that address to accept it.`,
    };
  }

  // Never downgrade an existing membership when an older link is accepted.
  const { data: existing } = await admin
    .from("project_members")
    .select("role, accepted_at")
    .eq("project_id", invite.project_id)
    .eq("user_id", user.id)
    .maybeSingle();
  const rank: Record<string, number> = { owner: 4, editor: 3, reviewer: 2, viewer: 1 };
  const role =
    existing?.role && (rank[existing.role as string] ?? 0) >= (rank[invite.role as string] ?? 0)
      ? (existing.role as Role)
      : (invite.role as Role);

  const { error: memberError } = await admin.from("project_members").upsert(
    {
      project_id: invite.project_id,
      user_id: user.id,
      role,
      invited_by: invite.invited_by,
      invited_at: invite.created_at,
      accepted_at: existing?.accepted_at ?? new Date().toISOString(),
    },
    { onConflict: "project_id,user_id" },
  );
  if (memberError) return { ok: false, error: memberError.message };

  await admin.from("project_invites").update({ accepted_at: new Date().toISOString() }).eq("id", invite.id);

  const { data: project } = await admin.from("projects").select("id, title, owner_id").eq("id", invite.project_id).maybeSingle();
  if (project) {
    await notify({
      userId: project.owner_id,
      projectId: project.id,
      kind: "member",
      title: `${user.email ?? "A collaborator"} joined “${project.title}”`,
      body: `Joined as ${invite.role}.`,
      link: `/app/projects/${project.id}/settings?tab=collaborators`,
    });
    await logActivity({
      projectId: project.id,
      action: "member.joined",
      targetType: "member",
      targetId: user.id,
      summary: `joined as ${invite.role}`,
    });
  }

  revalidatePath("/app");
  revalidatePath(`/app/projects/${invite.project_id}`);
  revalidatePath(`/app/projects/${invite.project_id}/settings`);
  redirect(`/app/projects/${invite.project_id}`);
}

export async function declineInvite(token: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sign in first." };

  const admin = createAdminClient();
  const { data: invite } = await admin.from("project_invites").select("id, email").eq("token", token).maybeSingle();
  if (!invite) return { ok: false, error: "This invitation link is not valid." };

  const { error } = await admin.from("project_invites").delete().eq("id", invite.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
