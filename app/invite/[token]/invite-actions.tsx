"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { acceptInvite, declineInvite } from "@/lib/actions/members";

export function InviteActions({
  token,
  signedIn,
  email,
  nextHref,
}: {
  token: string;
  signedIn: boolean;
  email: string | null;
  nextHref: string;
}) {
  const router = useRouter();
  const [accepting, setAccepting] = React.useState(false);
  const [declining, setDeclining] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [declined, setDeclined] = React.useState(false);

  if (!signedIn) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">
          Sign in to accept this invitation. If you don&apos;t have an account yet, create one with the invited address.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href={`/auth/login?next=${encodeURIComponent(nextHref)}`} className="flex-1">
            <Button variant="primary" className="w-full">
              Sign in to accept <ArrowRight />
            </Button>
          </Link>
          <Link href={`/auth/signup?next=${encodeURIComponent(nextHref)}`}>
            <Button variant="secondary">Create account</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (declined) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">You declined this invitation.</p>
        <Link href="/app" className="text-[13px] text-accent hover:underline">
          Back to your library
        </Link>
      </div>
    );
  }

  async function accept() {
    setError(null);
    setAccepting(true);
    const res = await acceptInvite(token);
    setAccepting(false);
    if (res && !res.ok) {
      setError(res.error ?? "Could not accept the invitation.");
      return;
    }
    toast.success("You're in");
    router.refresh();
  }

  async function decline() {
    setError(null);
    setDeclining(true);
    const res = await declineInvite(token);
    setDeclining(false);
    if (!res.ok) {
      setError(res.error ?? "Could not decline the invitation.");
      return;
    }
    setDeclined(true);
  }

  return (
    <div className="space-y-3">
      {email && <p className="text-[11px] text-muted">Signed in as {email}</p>}
      {error && (
        <p className="rounded-md border border-red-900/50 bg-red-950/40 px-3 py-2 text-xs text-red-300">{error}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" className="flex-1" loading={accepting} onClick={() => void accept()}>
          {!accepting && <Check />} Accept invitation
        </Button>
        <Button variant="ghost" loading={declining} onClick={() => void decline()}>
          <X /> Decline
        </Button>
      </div>
    </div>
  );
}
