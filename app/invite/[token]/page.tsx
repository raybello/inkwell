import Link from "next/link";
import { Feather, MailX } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth";
import { InviteActions } from "./invite-actions";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invitation" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await getSessionUser();
  const admin = createAdminClient();

  const { data: invite } = await admin
    .from("project_invites")
    .select("id, project_id, email, role, invited_by, accepted_at, expires_at")
    .eq("token", token)
    .maybeSingle();

  const [{ data: project }, { data: inviter }] = invite
    ? await Promise.all([
        admin.from("projects").select("id, title, subtitle, type, owner_id").eq("id", invite.project_id).maybeSingle(),
        invite.invited_by
          ? admin.from("profiles").select("display_name, email").eq("id", invite.invited_by).maybeSingle()
          : Promise.resolve({ data: null }),
      ])
    : [{ data: null }, { data: null }];

  const expired = invite?.expires_at ? new Date(invite.expires_at).getTime() < Date.now() : false;
  const used = !!invite?.accepted_at;
  const invalid = !invite || !project;
  const inviterName = inviter?.display_name ?? inviter?.email?.split("@")[0] ?? "The project owner";
  const nextHref = `/invite/${token}`;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md bg-accent/15 text-accent">
            <Feather className="size-4" />
          </span>
          <span className="font-serif text-lg tracking-tight">Inkwell</span>
        </Link>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {invalid ? (
            <div className="px-6 py-12 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-border-strong bg-ink-850 text-muted">
                <MailX className="size-5" />
              </div>
              <h1 className="mt-4 font-serif text-xl">This invitation is not valid</h1>
              <p className="mx-auto mt-2 max-w-xs text-sm text-muted">
                The link may have been revoked or mistyped. Ask the project owner for a fresh invitation.
              </p>
              <Link
                href="/app"
                className="mt-6 inline-block rounded-md border border-border-strong px-3 py-2 text-[13px] transition hover:bg-ink-850"
              >
                Go to your library
              </Link>
            </div>
          ) : (
            <>
              <div className="border-b border-border px-6 py-6">
                <p className="text-[11px] uppercase tracking-[0.18em] text-accent">Invitation</p>
                <h1 className="mt-2 font-serif text-2xl leading-tight">{project?.title}</h1>
                {project?.subtitle && <p className="mt-1 text-sm text-muted">{project.subtitle}</p>}
                <p className="mt-4 text-sm text-muted">
                  <span className="text-ink-100">{inviterName}</span> invited{" "}
                  <span className="text-ink-200">{invite?.email}</span> to collaborate.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Badge tone="plum" className="capitalize">
                    {invite?.role}
                  </Badge>
                  <span className="text-[11px] text-muted">Expires {formatDate(invite?.expires_at as string)}</span>
                </div>
              </div>

              <div className="px-6 py-5">
                {used ? (
                  <div className="space-y-3 text-sm text-muted">
                    <p>This invitation has already been accepted.</p>
                    <Link href={`/app/projects/${invite?.project_id}`} className="text-accent hover:underline">
                      Open the project
                    </Link>
                  </div>
                ) : expired ? (
                  <p className="text-sm text-muted">
                    This invitation expired on {formatDate(invite?.expires_at as string)}. Ask {inviterName} to send a new
                    one.
                  </p>
                ) : (
                  <InviteActions token={token} signedIn={!!user} email={user?.email ?? null} nextHref={nextHref} />
                )}
              </div>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-[11px] text-muted">
          Inkwell Studio · drafts, reviews and publish-ready exports in one workspace.
        </p>
      </div>
    </main>
  );
}
