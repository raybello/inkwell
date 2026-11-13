import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { ApiKeysPanel } from "@/components/api/api-keys-panel";
import type { ApiKey } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ApiSettingsPage() {
  const user = await getSessionUser();
  const supabase = await createClient();

  const [{ data: keys }, { data: project }] = await Promise.all([
    user
      ? supabase
          .from("api_keys")
          .select("*")
          .eq("workspace_id", user.id)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as ApiKey[] }),
    supabase
      .from("projects")
      .select("id")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string }>(),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8 lg:px-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Settings</p>
          <h1 className="font-serif text-3xl tracking-tight">API &amp; agents</h1>
          <p className="max-w-xl text-sm text-muted">
            Credentials and scopes for the Inkwell Agent API. Everything in the app — outline, chapters,
            assets, storyboard, canvases, exports and AI — is available over REST.
          </p>
        </div>
        <Link
          href="/docs/api"
          className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-3 py-1.5 text-[13px] text-muted-strong transition hover:border-accent/50 hover:text-foreground"
        >
          API reference
          <ArrowUpRight className="size-3.5" />
        </Link>
      </div>

      <ApiKeysPanel keys={(keys ?? []) as ApiKey[]} projectId={project?.id ?? null} />

      <div className="mt-8 grid gap-3 rounded-xl border border-border bg-card/50 p-5 text-xs text-muted sm:grid-cols-3">
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-[0.16em] text-muted">Base URL</p>
          <code className="font-mono text-[12px] text-muted-strong">/api/v1</code>
        </div>
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-[0.16em] text-muted">Auth header</p>
          <code className="font-mono text-[12px] text-muted-strong">Authorization: Bearer ink_live_…</code>
        </div>
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-[0.16em] text-muted">Rate limits</p>
          <span className="text-[12px] text-muted-strong">Per key, per minute · 429 + Retry-After</span>
        </div>
      </div>
    </div>
  );
}
