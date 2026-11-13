"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, KeyRound, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/misc";
import { Field, Input, Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createApiKeyAction, revokeApiKeyAction } from "@/lib/actions/api-keys";
import { API_SCOPES, SCOPE_DESCRIPTIONS, type ApiScope } from "@/lib/api/types";
import type { ApiKey } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";

function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-label={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success("Copied to clipboard");
          setTimeout(() => setCopied(false), 1600);
        } catch {
          toast.error("Could not copy — select the text and copy manually.");
        }
      }}
    >
      {copied ? <Check /> : <Copy />}
      {copied ? "Copied" : label}
    </Button>
  );
}

function NewKeyDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [name, setName] = React.useState("");
  const [scopes, setScopes] = React.useState<ApiScope[]>(["projects:read", "chapters:read"]);
  const [rpm, setRpm] = React.useState("100");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [createdKey, setCreatedKey] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setName("");
      setScopes(["projects:read", "chapters:read"]);
      setRpm("100");
      setError(null);
      setCreatedKey(null);
    }
  }, [open]);

  const toggleScope = (scope: ApiScope) => {
    setScopes((prev) => (prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]));
  };

  const submit = async () => {
    setPending(true);
    setError(null);
    const result = await createApiKeyAction({ name, scopes, rpm: Number(rpm) || 100 });
    setPending(false);
    if (!result.ok || !result.key) {
      setError(result.error ?? "Could not create the key.");
      return;
    }
    setCreatedKey(result.key);
    onCreated();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={createdKey ? "Copy your key now" : "Create API key"}
      description={
        createdKey
          ? "This is the only time the full key is shown. Store it somewhere safe."
          : "Keys are scoped to this workspace and can be revoked at any time."
      }
      width="max-w-2xl"
      footer={
        createdKey ? (
          <Button variant="primary" onClick={() => onOpenChange(false)}>
            I have stored the key
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submit} loading={pending} disabled={!name.trim() || !scopes.length}>
              Create key
            </Button>
          </>
        )
      }
    >
      {createdKey ? (
        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-md border border-amber-700/40 bg-amber-800/15 p-3 text-xs text-amber-200">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <span>
              Treat this like a password. Anyone with this key can act on your workspace within its scopes.
              If it leaks, revoke it and create a new one.
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-md border border-border-strong bg-ink-900 p-2">
            <code className="min-w-0 flex-1 overflow-x-auto whitespace-nowrap font-mono text-[12px] text-accent-soft">
              {createdKey}
            </code>
            <CopyButton value={createdKey} label="Copy key" />
          </div>
          <p className="text-xs text-muted">
            Send it as <code className="font-mono text-muted-strong">Authorization: Bearer {createdKey.slice(0, 14)}…</code>
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          <Field label="Name" hint="Something you will recognise in the list — e.g. “Draft agent”.">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Draft agent"
              maxLength={80}
              autoFocus
            />
          </Field>

          <div className="space-y-2">
            <Label>Scopes</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {API_SCOPES.map((scope) => {
                const checked = scopes.includes(scope);
                return (
                  <label
                    key={scope}
                    className={cn(
                      "flex cursor-pointer items-start gap-2 rounded-md border p-2.5 transition",
                      checked
                        ? "border-accent/50 bg-accent/10"
                        : "border-border bg-ink-900/50 hover:border-border-strong hover:bg-ink-850",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 size-3.5 accent-[var(--accent)]"
                      checked={checked}
                      onChange={() => toggleScope(scope)}
                    />
                    <span className="min-w-0 space-y-0.5">
                      <span className="block font-mono text-[12px] text-foreground">{scope}</span>
                      <span className="block text-[11px] leading-snug text-muted">
                        {SCOPE_DESCRIPTIONS[scope]}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <Field label="Rate limit (requests / minute)" hint="Default 100. Maximum 6,000.">
            <Input
              type="number"
              min={1}
              max={6000}
              value={rpm}
              onChange={(e) => setRpm(e.target.value)}
              className="w-32 font-mono"
            />
          </Field>

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      )}
    </Dialog>
  );
}

function RevokeDialog({
  apiKey,
  open,
  onOpenChange,
  onRevoked,
}: {
  apiKey: ApiKey | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRevoked: () => void;
}) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const revoke = async () => {
    if (!apiKey) return;
    setPending(true);
    const result = await revokeApiKeyAction(apiKey.id);
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? "Could not revoke the key.");
      return;
    }
    toast.success(`Revoked “${apiKey.name}”`);
    onOpenChange(false);
    onRevoked();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Revoke API key"
      description={`“${apiKey?.name ?? ""}” will stop working immediately. This cannot be undone.`}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="danger" onClick={revoke} loading={pending}>
            Revoke key
          </Button>
        </>
      }
    >
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
      <p className="text-sm text-muted">
        Any agent or script using this key will start receiving{" "}
        <code className="font-mono text-[12px] text-muted-strong">401 invalid_key</code>. Create a replacement
        key first if you need zero downtime.
      </p>
    </Dialog>
  );
}

export function ApiKeysPanel({
  keys,
  projectId,
}: {
  keys: ApiKey[];
  projectId: string | null;
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [revokeTarget, setRevokeTarget] = React.useState<ApiKey | null>(null);

  const active = keys.filter((k) => !k.revoked_at);
  const revoked = keys.filter((k) => k.revoked_at);

  const curl = `curl https://your-domain.com/api/v1/projects \\
  -H "Authorization: Bearer ink_live_…" \\
  -H "Accept: application/json"`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle>API keys</CardTitle>
            <CardDescription>
              Workspace-scoped credentials for agents, scripts and integrations. Each key only grants the
              scopes you select.
            </CardDescription>
          </div>
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <Plus />
            New key
          </Button>
        </CardHeader>
        <CardContent>
          {active.length === 0 ? (
            <EmptyState
              icon={<KeyRound />}
              title="No API keys yet"
              description="Create a key so an agent — a Claude or GPT tool loop, an automation script, your own service — can read and write chapters over REST. Keys are shown once, then stored only as a hash."
              action={
                <Button variant="primary" onClick={() => setCreateOpen(true)}>
                  <Plus />
                  Create your first key
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-separate border-spacing-y-1 text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-[0.14em] text-muted">
                    <th className="px-2 pb-2 font-medium">Name</th>
                    <th className="px-2 pb-2 font-medium">Prefix</th>
                    <th className="px-2 pb-2 font-medium">Scopes</th>
                    <th className="px-2 pb-2 font-medium">RPM</th>
                    <th className="px-2 pb-2 font-medium">Last used</th>
                    <th className="px-2 pb-2 font-medium">Created</th>
                    <th className="px-2 pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {active.map((key) => (
                    <tr key={key.id} className="rounded-md bg-ink-900/50 align-top">
                      <td className="rounded-l-md border-y border-l border-border px-3 py-3 font-medium">
                        {key.name}
                      </td>
                      <td className="border-y border-border px-3 py-3">
                        <code className="rounded bg-ink-850 px-1.5 py-0.5 font-mono text-[11px] text-accent-soft">
                          {key.prefix}…
                        </code>
                      </td>
                      <td className="border-y border-border px-3 py-3">
                        <div className="flex max-w-[240px] flex-wrap gap-1">
                          {key.scopes.slice(0, 3).map((scope) => (
                            <Badge key={scope} tone="neutral" className="font-mono text-[10px]">
                              {scope}
                            </Badge>
                          ))}
                          {key.scopes.length > 3 && (
                            <Badge tone="neutral">+{key.scopes.length - 3}</Badge>
                          )}
                        </div>
                      </td>
                      <td className="border-y border-border px-3 py-3 font-mono text-[12px] text-muted-strong">
                        {key.rate_limit_rpm}
                      </td>
                      <td className="border-y border-border px-3 py-3 text-[12px] text-muted" suppressHydrationWarning>
                        {key.last_used_at
                          ? formatDistanceToNow(new Date(key.last_used_at), { addSuffix: true })
                          : "Never"}
                      </td>
                      <td className="border-y border-border px-3 py-3 text-[12px] text-muted" suppressHydrationWarning>
                        {formatDistanceToNow(new Date(key.created_at), { addSuffix: true })}
                      </td>
                      <td className="rounded-r-md border-y border-r border-border px-3 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Revoke ${key.name}`}
                          onClick={() => setRevokeTarget(key)}
                        >
                          <Trash2 />
                          Revoke
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Use it from anywhere</CardTitle>
            <CardDescription>
              Pass the key as a bearer token. The API returns consistent envelopes and rate-limit headers.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative overflow-hidden rounded-md border border-border-strong bg-ink-950/60">
              <pre className="overflow-x-auto p-3 font-mono text-[11px] leading-relaxed text-ink-200">
                <code>{curl}</code>
              </pre>
              <div className="absolute right-2 top-2">
                <CopyButton value={curl} label="Copy curl" />
              </div>
            </div>
            <p className="text-xs text-muted">
              Read the <a href="/docs/api" className="text-accent hover:underline">full API reference</a> for
              every endpoint, scope, webhook event and the signature scheme.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>For agent builders</CardTitle>
            <CardDescription>What a key can do</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted">
            <ul className="space-y-2">
              <li className="flex gap-2">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-accent" />
                <span>
                  Read the outline as a nested tree, fetch a chapter as Markdown for prompts, and append
                  blocks without loading the whole document.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-accent" />
                <span>
                  Trigger exports and poll the job — EPUB, print PDF, DOCX, Markdown, HTML or JSON.
                </span>
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-accent" />
                <span>
                  Subscribe to webhooks for chapter changes, uploads and completed exports. Verify the
                  HMAC-SHA256 signature before trusting a payload.
                </span>
              </li>
            </ul>
            {projectId && (
              <p className="pt-1 text-[11px] text-muted">
                Try it on this workspace&apos;s project{" "}
                <code className="font-mono text-muted-strong">{projectId}</code>.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {revoked.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Revoked keys</CardTitle>
            <CardDescription>Kept for audit. They no longer authenticate.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border text-sm">
              {revoked.map((key) => (
                <li key={key.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="text-muted-strong">{key.name}</span>
                  <span className="flex items-center gap-3 text-[11px] text-muted">
                    <code className="font-mono">{key.prefix}…</code>
                    <Badge tone="red">Revoked</Badge>
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <NewKeyDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => router.refresh()}
      />
      <RevokeDialog
        apiKey={revokeTarget}
        open={Boolean(revokeTarget)}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
        onRevoked={() => router.refresh()}
      />
    </div>
  );
}
