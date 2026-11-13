"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Copy, Link2, Mail, Trash2, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { Dialog } from "@/components/ui/dialog";
import { changeRole, inviteMember, removeMember, revokeInvite } from "@/lib/actions/members";
import type { Role } from "@/lib/types";
import { cn, formatDate, relativeTime } from "@/lib/utils";

export interface MemberView {
  user_id: string;
  role: Role;
  invited_at: string | null;
  accepted_at: string | null;
  name: string;
  email: string | null;
  avatar_url: string | null;
}

export interface InviteView {
  id: string;
  email: string;
  role: Role;
  created_at: string;
  expires_at: string;
  link: string;
}

const ROLE_TONE: Record<Role, "accent" | "plum" | "sage" | "neutral"> = {
  owner: "accent",
  editor: "plum",
  reviewer: "sage",
  viewer: "neutral",
};

const ROLE_HELP: Record<string, string> = {
  owner: "Full control, including collaborators, webhooks and deletion.",
  editor: "Can write chapters, comment and resolve threads.",
  reviewer: "Can comment and resolve, but not edit the manuscript.",
  viewer: "Read-only access to the project and its exports.",
};

export function ProjectSettingsCollaborators({
  projectId,
  members,
  invites,
  isOwner,
  currentUserId,
}: {
  projectId: string;
  members: MemberView[];
  invites: InviteView[];
  isOwner: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<Role>("editor");
  const [sending, setSending] = React.useState(false);
  const [inviteResult, setInviteResult] = React.useState<{ link: string; emailed: boolean } | null>(null);
  const [busyRow, setBusyRow] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState<string | null>(null);

  const owner = members.find((m) => m.role === "owner");
  const others = members.filter((m) => m.role !== "owner");

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      toast.success("Link copied");
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000);
    } catch {
      toast.error("Your browser blocked clipboard access — select the link and copy it.");
    }
  }

  async function submitInvite(event: React.FormEvent) {
    event.preventDefault();
    setSending(true);
    const res = await inviteMember({ projectId, email: email.trim(), role });
    setSending(false);
    if (!res.ok) {
      toast.error(res.error ?? "Could not send that invitation.");
      return;
    }
    setInviteResult({ link: res.link ?? "", emailed: !!res.emailed });
    toast.success(res.emailed ? "Invitation emailed" : "Invitation ready to share");
    router.refresh();
  }

  function closeInvite() {
    setInviteOpen(false);
    setInviteResult(null);
    setEmail("");
    setRole("editor");
  }

  async function onRoleChange(member: MemberView, next: Role) {
    setBusyRow(member.user_id);
    const res = await changeRole({ projectId, userId: member.user_id, role: next });
    setBusyRow(null);
    if (!res.ok) {
      toast.error(res.error ?? "Could not change that role.");
      return;
    }
    toast.success(`${member.name} is now ${next}`);
    router.refresh();
  }

  async function onRemove(member: MemberView) {
    setBusyRow(member.user_id);
    const res = await removeMember({ projectId, userId: member.user_id });
    setBusyRow(null);
    if (!res.ok) {
      toast.error(res.error ?? "Could not remove that collaborator.");
      return;
    }
    toast.success(`${member.name} removed`);
    router.refresh();
  }

  async function onRevoke(invite: InviteView) {
    setBusyRow(invite.id);
    const res = await revokeInvite(invite.id);
    setBusyRow(null);
    if (!res.ok) {
      toast.error(res.error ?? "Could not revoke that invitation.");
      return;
    }
    toast.success("Invitation revoked");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 className="font-serif text-lg leading-tight">People with access</h2>
            <p className="mt-0.5 text-xs text-muted">{members.length} collaborator{members.length === 1 ? "" : "s"} on this project.</p>
          </div>
          {isOwner && (
            <Button variant="primary" onClick={() => setInviteOpen(true)}>
              <UserPlus /> Invite
            </Button>
          )}
        </div>

        <div className="hidden grid-cols-[minmax(0,1fr)_150px_130px_40px] gap-3 border-b border-border/70 px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted/70 md:grid">
          <span>Collaborator</span>
          <span>Role</span>
          <span>Joined</span>
          <span className="sr-only">Actions</span>
        </div>

        <ul className="divide-y divide-border/70">
          {owner && (
            <MemberRow
              member={owner}
              isOwner={isOwner}
              currentUserId={currentUserId}
              busy={false}
              onRoleChange={onRoleChange}
              onRemove={onRemove}
            />
          )}
          {others.map((member) => (
            <MemberRow
              key={member.user_id}
              member={member}
              isOwner={isOwner}
              currentUserId={currentUserId}
              busy={busyRow === member.user_id}
              onRoleChange={onRoleChange}
              onRemove={onRemove}
            />
          ))}
        </ul>

        {invites.length > 0 && (
          <div className="border-t border-border bg-ink-900/40">
            <p className="px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted/70">
              Pending invitations · {invites.length}
            </p>
            <ul className="divide-y divide-border/50">
              {invites.map((invite) => (
                <li
                  key={invite.id}
                  className="grid gap-2 px-5 py-3 md:grid-cols-[minmax(0,1fr)_150px_130px_auto] md:items-center md:gap-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] text-ink-200">{invite.email}</p>
                    <p className="text-[11px] text-muted">
                      Invited {relativeTime(invite.created_at)} · expires {formatDate(invite.expires_at)}
                    </p>
                  </div>
                  <div>
                    <Badge tone={ROLE_TONE[invite.role]} className="capitalize">
                      {invite.role}
                    </Badge>
                  </div>
                  <span className="text-[11px] text-muted">Awaiting response</span>
                  {isOwner && (
                    <div className="flex items-center gap-1 md:justify-end">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Copy invite link for ${invite.email}`}
                        title="Copy invite link"
                        onClick={() => void copy(invite.link, invite.id)}
                      >
                        {copied === invite.id ? <Check className="text-sage" /> : <Link2 />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Revoke invitation for ${invite.email}`}
                        title="Revoke"
                        loading={busyRow === invite.id}
                        onClick={() => void onRevoke(invite)}
                        className="text-muted hover:text-red-400"
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {members.length <= 1 && invites.length === 0 && (
          <EmptyState
            icon={<Users />}
            title="It's just you"
            description="Invite an editor to mark up the manuscript, or a reviewer to leave comments without editing."
            className="border-t border-border py-10"
          />
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-serif text-lg leading-tight">Roles</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
          {(["editor", "reviewer", "viewer"] as Role[]).map((r) => (
            <div key={r} className="rounded-lg border border-border/70 bg-ink-900/40 p-3">
              <dt className="flex items-center gap-2 text-[13px] capitalize text-ink-100">
                <Badge tone={ROLE_TONE[r]} className="capitalize">
                  {r}
                </Badge>
              </dt>
              <dd className="mt-1.5 text-[11.5px] leading-relaxed text-muted">{ROLE_HELP[r]}</dd>
            </div>
          ))}
        </dl>
      </section>

      <Dialog
        open={inviteOpen}
        onOpenChange={(open) => (open ? setInviteOpen(true) : closeInvite())}
        title="Invite a collaborator"
        description="They'll get access to this project only — other work stays private."
        footer={
          inviteResult ? (
            <Button variant="primary" onClick={closeInvite}>
              Done
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={closeInvite}>
                Cancel
              </Button>
              <Button variant="primary" onClick={submitInvite} loading={sending} disabled={!email.trim()}>
                <Mail /> Send invitation
              </Button>
            </>
          )
        }
      >
        {inviteResult ? (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-md border border-sage/30 bg-sage/10 px-3 py-2 text-[12px] text-sage">
              <Check className="mt-0.5 size-3.5 shrink-0" />
              {inviteResult.emailed
                ? `Invitation emailed to ${email} as ${role}.`
                : "Email isn't configured in this environment — share the link below instead."}
            </div>
            <Field label="Invitation link" hint="Anyone signed in with the invited address can accept it. Expires in 14 days.">
              <div className="flex gap-2">
                <Input readOnly value={inviteResult.link} onFocus={(e) => e.currentTarget.select()} className="font-mono text-[11.5px]" />
                <Button variant="secondary" onClick={() => void copy(inviteResult.link, "dialog")} className="shrink-0">
                  {copied === "dialog" ? <Check /> : <Copy />} Copy
                </Button>
              </div>
            </Field>
          </div>
        ) : (
          <form onSubmit={submitInvite} className="space-y-4">
            <Field label="Email address">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="editor@example.com"
                autoFocus
                required
              />
            </Field>
            <Field label="Role" hint={ROLE_HELP[role]}>
              <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
                <option value="editor">Editor — write and comment</option>
                <option value="reviewer">Reviewer — comment only</option>
                <option value="viewer">Viewer — read only</option>
              </Select>
            </Field>
          </form>
        )}
      </Dialog>
    </div>
  );
}

function MemberRow({
  member,
  isOwner,
  currentUserId,
  busy,
  onRoleChange,
  onRemove,
}: {
  member: MemberView;
  isOwner: boolean;
  currentUserId: string;
  busy: boolean;
  onRoleChange: (member: MemberView, role: Role) => void;
  onRemove: (member: MemberView) => void;
}) {
  const isSelf = member.user_id === currentUserId;
  const isProjectOwner = member.role === "owner";
  return (
    <li className={cn("grid gap-2 px-5 py-3 md:grid-cols-[minmax(0,1fr)_150px_130px_40px] md:items-center md:gap-3", busy && "opacity-60")}>
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={member.name} src={member.avatar_url} size={32} />
        <div className="min-w-0">
          <p className="truncate text-[13px] text-ink-100">
            {member.name}
            {isSelf && <span className="ml-1.5 text-[11px] text-muted">(you)</span>}
          </p>
          <p className="truncate text-[11px] text-muted">{member.email ?? "No email on file"}</p>
        </div>
      </div>

      <div>
        {isOwner && !isProjectOwner ? (
          <Select
            value={member.role}
            onChange={(e) => onRoleChange(member, e.target.value as Role)}
            aria-label={`Role for ${member.name}`}
            className="h-8 text-[12px] capitalize"
          >
            <option value="editor">Editor</option>
            <option value="reviewer">Reviewer</option>
            <option value="viewer">Viewer</option>
          </Select>
        ) : (
          <Badge tone={ROLE_TONE[member.role]} className="capitalize">
            {member.role}
          </Badge>
        )}
      </div>

      <span className="text-[11px] text-muted">
        {member.accepted_at ? formatDate(member.accepted_at) : member.invited_at ? `Invited ${relativeTime(member.invited_at)}` : "—"}
      </span>

      <div className="md:justify-self-end">
        {isOwner && !isProjectOwner && !isSelf && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove ${member.name}`}
            title="Remove from project"
            loading={busy}
            onClick={() => onRemove(member)}
            className="text-muted hover:text-red-400"
          >
            <Trash2 />
          </Button>
        )}
      </div>
    </li>
  );
}
