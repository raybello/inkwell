"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AtSign,
  Bell,
  CheckCheck,
  ChevronRight,
  FileText,
  MessageSquare,
  MessageSquareReply,
  ShieldCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { markAllRead, markRead } from "@/lib/actions/notifications";
import type { Notification } from "@/lib/types";
import { cn, relativeTime } from "@/lib/utils";

const ICONS: Record<string, React.ReactNode> = {
  comment: <MessageSquare />,
  reply: <MessageSquareReply />,
  mention: <AtSign />,
  invite: <UserPlus />,
  member: <Users />,
  role: <ShieldCheck />,
  chapter: <FileText />,
};

function iconFor(kind: string) {
  return ICONS[kind] ?? <Bell />;
}

export function NotificationList({ notifications: initial }: { notifications: Notification[] }) {
  const router = useRouter();
  const [items, setItems] = React.useState(initial);
  const [marking, setMarking] = React.useState(false);

  React.useEffect(() => setItems(initial), [initial]);

  const unread = items.filter((n) => !n.read);
  const earlier = items.filter((n) => n.read);

  async function open(item: Notification) {
    if (!item.read) {
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)));
      const res = await markRead(item.id);
      if (!res.ok) {
        setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, read: false } : n)));
        toast.error(res.error ?? "Could not mark that as read.");
        return;
      }
    }
    if (item.link) router.push(item.link);
    else router.refresh();
  }

  async function readAll() {
    setMarking(true);
    const res = await markAllRead();
    setMarking(false);
    if (!res.ok) {
      toast.error(res.error ?? "Could not mark everything as read.");
      return;
    }
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    router.refresh();
  }

  if (!items.length) {
    return (
      <div className="rounded-xl border border-border bg-card">
        <EmptyState
          icon={<Bell />}
          title="Nothing to catch up on"
          description="Comments, replies, invitations and role changes land here. Resolve a thread and you'll see it in the project activity feed."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted">
          {unread.length === 0 ? "All caught up" : `${unread.length} unread`}
        </p>
        <Button variant="ghost" size="sm" onClick={() => void readAll()} loading={marking} disabled={!unread.length}>
          <CheckCheck /> Mark all read
        </Button>
      </div>

      {unread.length > 0 && <Group label="Unread" items={unread} onOpen={open} />}
      {earlier.length > 0 && <Group label="Earlier" items={earlier} onOpen={open} muted />}
    </div>
  );
}

function Group({
  label,
  items,
  onOpen,
  muted,
}: {
  label: string;
  items: Notification[];
  onOpen: (item: Notification) => void;
  muted?: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <p className="border-b border-border px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted/70">
        {label}
      </p>
      <ul className="divide-y divide-border/70">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => void onOpen(item)}
              className={cn(
                "group flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-ink-850/50",
                muted && "opacity-75 hover:opacity-100",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border [&_svg]:size-3.5",
                  item.read
                    ? "border-border-strong bg-ink-850 text-muted"
                    : "border-accent/30 bg-accent/12 text-accent",
                )}
              >
                {iconFor(item.kind)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className={cn("min-w-0 flex-1 truncate text-[13px]", item.read ? "text-ink-200" : "text-foreground")}>
                    {item.title}
                  </span>
                  {!item.read && <span className="mt-1 size-1.5 shrink-0 rounded-full bg-accent" aria-label="Unread" />}
                </span>
                {item.body && <span className="mt-0.5 block truncate text-[12px] text-muted">{item.body}</span>}
                <span className="mt-0.5 block text-[10.5px] uppercase tracking-[0.1em] text-muted/70">
                  {relativeTime(item.created_at)}
                </span>
              </span>
              {item.link && <ChevronRight className="mt-2 size-3.5 shrink-0 text-muted/40 group-hover:text-muted" />}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
