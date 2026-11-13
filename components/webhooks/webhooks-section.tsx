"use client";

import * as React from "react";
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  Webhook as WebhookIcon,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, Switch } from "@/components/ui/misc";
import { Field, Input, Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Webhook } from "@/lib/types";
import {
  createWebhookAction,
  deleteWebhookAction,
  getWebhooksState,
  retryDeliveryAction,
  testWebhookAction,
  updateWebhookAction,
} from "@/components/webhooks/actions";
import {
  WEBHOOK_EVENTS,
  WEBHOOK_EVENT_DESCRIPTIONS,
  type WebhookDeliveryView,
  type WebhookEventName,
} from "@/components/webhooks/types";

function CopyIconButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success("Copied");
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error("Copy failed");
        }
      }}
    >
      {copied ? <Check /> : <Copy />}
    </Button>
  );
}

function EventPicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (events: string[]) => void;
}) {
  const toggle = (event: WebhookEventName) =>
    onChange(selected.includes(event) ? selected.filter((e) => e !== event) : [...selected, event]);

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {WEBHOOK_EVENTS.map((event) => {
        const checked = selected.includes(event);
        return (
          <label
            key={event}
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
              onChange={() => toggle(event)}
            />
            <span className="min-w-0 space-y-0.5">
              <span className="block font-mono text-[11px] text-foreground">{event}</span>
              <span className="block text-[11px] leading-snug text-muted">
                {WEBHOOK_EVENT_DESCRIPTIONS[event]}
              </span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

function CreateWebhookDialog({
  projectId,
  open,
  onOpenChange,
  onCreated,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [url, setUrl] = React.useState("");
  const [events, setEvents] = React.useState<string[]>(["chapter.created", "chapter.updated"]);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setUrl("");
      setEvents(["chapter.created", "chapter.updated"]);
      setError(null);
    }
  }, [open]);

  const submit = async () => {
    setPending(true);
    setError(null);
    const result = await createWebhookAction({ projectId, url, events });
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? "Could not create the endpoint.");
      return;
    }
    toast.success("Webhook endpoint added");
    onOpenChange(false);
    onCreated();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add webhook endpoint"
      description="Inkwell POSTs a signed JSON payload to this URL when the selected events happen."
      width="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={pending} disabled={!url.trim() || !events.length}>
            Add endpoint
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Endpoint URL" hint="HTTPS only (localhost is allowed for development).">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://agent.example.com/inkwell/events"
            autoFocus
          />
        </Field>
        <div className="space-y-2">
          <Label>Events</Label>
          <EventPicker selected={events} onChange={setEvents} />
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    </Dialog>
  );
}

function EditWebhookDialog({
  projectId,
  hook,
  open,
  onOpenChange,
  onSaved,
}: {
  projectId: string;
  hook: Webhook | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [url, setUrl] = React.useState("");
  const [events, setEvents] = React.useState<string[]>([]);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open && hook) {
      setUrl(hook.url);
      setEvents(hook.events ?? []);
      setError(null);
    }
  }, [open, hook]);

  const submit = async () => {
    if (!hook) return;
    setPending(true);
    setError(null);
    const result = await updateWebhookAction({ projectId, id: hook.id, url, events });
    setPending(false);
    if (!result.ok) {
      setError(result.error ?? "Could not update the endpoint.");
      return;
    }
    toast.success("Endpoint updated");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Edit endpoint"
      description="Change the URL or the events this endpoint receives."
      width="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={pending} disabled={!url.trim() || !events.length}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Field label="Endpoint URL">
          <Input value={url} onChange={(e) => setUrl(e.target.value)} />
        </Field>
        <div className="space-y-2">
          <Label>Events</Label>
          <EventPicker selected={events} onChange={setEvents} />
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    </Dialog>
  );
}

function DeliveryTable({
  projectId,
  deliveries,
  onRetried,
}: {
  projectId: string;
  deliveries: WebhookDeliveryView[];
  onRetried: () => void;
}) {
  const [retrying, setRetrying] = React.useState<string | null>(null);

  if (!deliveries.length) {
    return (
      <p className="rounded-md border border-dashed border-border px-3 py-4 text-xs text-muted">
        No deliveries yet. Use “Send test” to fire a sample payload.
      </p>
    );
  }

  const retry = async (delivery: WebhookDeliveryView) => {
    setRetrying(delivery.id);
    const result = await retryDeliveryAction({ projectId, deliveryId: delivery.id });
    setRetrying(null);
    if (result.ok) toast.success(`Delivered (HTTP ${result.statusCode ?? 200})`);
    else toast.error(result.error ?? "Delivery failed");
    onRetried();
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-[12px]">
        <thead>
          <tr className="text-[10px] uppercase tracking-[0.14em] text-muted">
            <th className="px-2 pb-1.5 font-medium">Status</th>
            <th className="px-2 pb-1.5 font-medium">Event</th>
            <th className="px-2 pb-1.5 font-medium">When</th>
            <th className="px-2 pb-1.5 font-medium">Tries</th>
            <th className="px-2 pb-1.5" />
          </tr>
        </thead>
        <tbody>
          {deliveries.slice(0, 20).map((delivery) => (
            <tr key={delivery.id} className="border-t border-border/70">
              <td className="px-2 py-2">
                {delivery.ok ? (
                  <Badge tone="sage">{delivery.status_code ?? 200}</Badge>
                ) : (
                  <Badge tone="red">{delivery.status_code ?? "ERR"}</Badge>
                )}
              </td>
              <td className="px-2 py-2 font-mono text-[11px] text-muted-strong">{delivery.event}</td>
              <td className="px-2 py-2 text-muted" suppressHydrationWarning>
                {formatDistanceToNow(new Date(delivery.created_at), { addSuffix: true })}
              </td>
              <td className="px-2 py-2 font-mono text-muted">{delivery.attempts}</td>
              <td className="px-2 py-2 text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => retry(delivery)}
                  loading={retrying === delivery.id}
                  aria-label={`Retry ${delivery.event} delivery`}
                >
                  <RefreshCw />
                  Retry
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {deliveries.some((d) => !d.ok && d.error) && (
        <p className="mt-2 truncate text-[11px] text-muted">
          Last error: {deliveries.find((d) => !d.ok && d.error)?.error}
        </p>
      )}
    </div>
  );
}

export function WebhooksSection({ projectId }: { projectId: string }) {
  const [hooks, setHooks] = React.useState<Webhook[]>([]);
  const [deliveries, setDeliveries] = React.useState<WebhookDeliveryView[]>([]);
  const [isOwner, setIsOwner] = React.useState(true);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<Webhook | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Webhook | null>(null);
  const [revealed, setRevealed] = React.useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const [testing, setTesting] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    let result;
    try {
      result = await getWebhooksState(projectId);
    } catch (cause) {
      setLoading(false);
      setError(cause instanceof Error ? cause.message : "Could not load webhooks.");
      return;
    }
    setLoading(false);
    if (!result.ok) {
      setError(result.error ?? "Could not load webhooks.");
      return;
    }
    setError(null);
    setIsOwner(result.isOwner);
    setHooks(result.hooks);
    setDeliveries(result.deliveries);
  }, [projectId]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const toggleActive = async (hook: Webhook, active: boolean) => {
    setHooks((prev) => prev.map((h) => (h.id === hook.id ? { ...h, active } : h)));
    const result = await updateWebhookAction({ projectId, id: hook.id, active });
    if (!result.ok) {
      setHooks((prev) => prev.map((h) => (h.id === hook.id ? { ...h, active: !active } : h)));
      toast.error(result.error ?? "Could not update the endpoint.");
      return;
    }
    toast.success(active ? "Endpoint enabled" : "Endpoint paused");
  };

  const sendTest = async (hook: Webhook) => {
    setTesting(hook.id);
    const result = await testWebhookAction({ projectId, id: hook.id });
    setTesting(null);
    if (result.ok) toast.success(`Test delivered (HTTP ${result.statusCode ?? 200})`);
    else toast.error(result.error ?? "Test delivery failed");
    await refresh();
    setExpanded((prev) => ({ ...prev, [hook.id]: true }));
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const result = await deleteWebhookAction({ projectId, id: deleteTarget.id });
    setDeleting(false);
    if (!result.ok) {
      toast.error(result.error ?? "Could not delete the endpoint.");
      return;
    }
    toast.success("Endpoint deleted");
    setDeleteTarget(null);
    await refresh();
  };

  if (!isOwner) {
    return (
      <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted">
        Only the project owner can view and manage webhook endpoints.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="font-serif text-lg">Webhooks</h3>
          <p className="max-w-xl text-sm text-muted">
            Notify an agent or service when chapters, assets, comments or exports change. Payloads are
            signed with HMAC-SHA256 in <code className="font-mono text-[12px]">X-Inkwell-Signature</code>.
          </p>
        </div>
        <Button variant="secondary" onClick={() => setCreateOpen(true)}>
          <Plus />
          Add endpoint
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          <div className="h-24 animate-pulse rounded-xl border border-border bg-card/60" />
          <div className="h-24 animate-pulse rounded-xl border border-border bg-card/60" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-900/50 bg-red-950/20 p-4 text-sm text-red-300">{error}</div>
      ) : hooks.length === 0 ? (
        <Card>
          <EmptyState
            icon={<WebhookIcon />}
            title="No endpoints configured"
            description="Add an HTTPS endpoint to receive signed events. Deliveries retry up to three times and are logged here."
            action={
              <Button variant="primary" onClick={() => setCreateOpen(true)}>
                <Plus />
                Add your first endpoint
              </Button>
            }
          />
        </Card>
      ) : (
        hooks.map((hook) => {
          const hookDeliveries = deliveries.filter((d) => d.webhook_id === hook.id);
          const isExpanded = expanded[hook.id] ?? false;
          return (
            <Card key={hook.id}>
              <CardHeader className="gap-2 pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={cn("size-1.5 shrink-0 rounded-full", hook.active ? "bg-sage" : "bg-ink-600")}
                      aria-hidden
                    />
                    <code className="min-w-0 truncate font-mono text-[12px] text-foreground">{hook.url}</code>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Switch checked={hook.active} onChange={(v) => toggleActive(hook, v)} label="Active" />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => sendTest(hook)}
                      loading={testing === hook.id}
                      aria-label="Send test delivery"
                    >
                      <Send />
                      Send test
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditTarget(hook)}>
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete webhook ${hook.url}`}
                      onClick={() => setDeleteTarget(hook)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(hook.events ?? []).map((event) => (
                    <Badge key={event} tone={hook.active ? "accent" : "neutral"} className="font-mono text-[10px]">
                      {event}
                    </Badge>
                  ))}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-ink-900/60 px-2.5 py-1.5">
                  <span className="text-[10px] uppercase tracking-[0.14em] text-muted">Secret</span>
                  <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-strong">
                    {revealed[hook.id] ? hook.secret : "•".repeat(28)}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={revealed[hook.id] ? "Hide signing secret" : "Reveal signing secret"}
                    onClick={() => setRevealed((prev) => ({ ...prev, [hook.id]: !prev[hook.id] }))}
                  >
                    {revealed[hook.id] ? <EyeOff /> : <Eye />}
                  </Button>
                  <CopyIconButton value={hook.secret} label="Copy signing secret" />
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-muted">
                    Deliveries · last {Math.min(hookDeliveries.length, 20)}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpanded((prev) => ({ ...prev, [hook.id]: !isExpanded }))}
                  >
                    {isExpanded ? "Hide log" : "Show log"}
                  </Button>
                </div>
                {isExpanded && (
                  <DeliveryTable
                    projectId={projectId}
                    deliveries={hookDeliveries}
                    onRetried={() => void refresh()}
                  />
                )}
              </CardContent>
            </Card>
          );
        })
      )}

      <CreateWebhookDialog
        projectId={projectId}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => void refresh()}
      />
      <EditWebhookDialog
        projectId={projectId}
        hook={editTarget}
        open={Boolean(editTarget)}
        onOpenChange={(open) => !open && setEditTarget(null)}
        onSaved={() => void refresh()}
      />
      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete webhook endpoint"
        description={`${deleteTarget?.url ?? ""} will stop receiving events. Delivery history is removed.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete} loading={deleting}>
              Delete endpoint
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          Agents relying on this endpoint will stop hearing about chapter changes. You can add a new endpoint at
          any time.
        </p>
      </Dialog>
    </div>
  );
}
