"use client";

/**
 * Live collaborator avatars for a chapter (Supabase Realtime presence).
 * Channel: `chapter-presence:${chapterId}`. Fails silently when Realtime is
 * unavailable (offline, blocked websockets, missing env) — the editor must never
 * break because of a presence socket.
 */

import * as React from "react";
import { Avatar, Tooltip } from "@/components/ui/misc";
import { createClient } from "@/lib/supabase/client";
import { colourForUser } from "@/components/comments/types";
import { cn } from "@/lib/utils";

interface Peer {
  user_id: string;
  name: string;
  colour: string;
}

const MAX_VISIBLE = 5;

export function PresenceBar({ projectId, chapterId }: { projectId: string; chapterId?: string }) {
  const [peers, setPeers] = React.useState<Peer[]>([]);
  const [connected, setConnected] = React.useState(false);

  React.useEffect(() => {
    if (!chapterId) return;
    let cancelled = false;
    // Kept loosely typed: the socket shares the browser Supabase instance.
    let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;

    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (cancelled || !user) return;

        const { data: profile } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("id", user.id)
          .maybeSingle();
        if (cancelled) return;

        const me: Peer = {
          user_id: user.id,
          name: profile?.display_name ?? user.email?.split("@")[0] ?? "Writer",
          colour: colourForUser(user.id),
        };

        channel = supabase.channel(`chapter-presence:${chapterId}`, {
          config: { presence: { key: me.user_id } },
        });

        channel.on("presence", { event: "sync" }, () => {
          if (cancelled || !channel) return;
          try {
            const state = channel.presenceState() as unknown as Record<string, Peer[]>;
            const flat: Peer[] = [];
            for (const key of Object.keys(state)) {
              for (const entry of state[key] ?? []) {
                if (entry?.user_id && !flat.some((p) => p.user_id === entry.user_id)) flat.push(entry);
              }
            }
            setPeers(flat);
          } catch {
            /* malformed presence payload — ignore */
          }
        });

        channel.subscribe((status) => {
          if (cancelled) return;
          if (status === "SUBSCRIBED") {
            setConnected(true);
            void Promise.resolve(channel?.track(me)).catch(() => null);
            heartbeat = setInterval(() => {
              void Promise.resolve(channel?.track(me)).catch(() => null);
            }, 25_000);
          } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
            setConnected(false);
          }
        });
      } catch {
        // Realtime unavailable — stay silent.
      }
    })();

    return () => {
      cancelled = true;
      if (heartbeat) clearInterval(heartbeat);
      try {
        if (channel) void createClient().removeChannel(channel);
      } catch {
        /* already gone */
      }
      channel = null;
      setConnected(false);
      setPeers([]);
    };
  }, [chapterId]);

  if (!chapterId) return null;

  const others = peers.filter((p) => p.user_id);
  const visible = others.slice(0, MAX_VISIBLE);
  const overflow = others.length - visible.length;
  const names = others.map((p) => p.name).join(", ");

  return (
    <div className="flex items-center gap-2" title={names || `Only you in this chapter (${projectId.slice(0, 4)})`}>
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full transition-colors",
          connected ? "bg-sage shadow-[0_0_0_3px_rgba(125,154,126,0.16)]" : "bg-ink-600",
        )}
      />
      {visible.length > 0 && (
        <div className="flex items-center -space-x-1.5">
          {visible.map((peer) => (
            <Tooltip key={peer.user_id} label={peer.name}>
              <span
                className="inline-flex rounded-full ring-2 ring-ink-900"
                style={{ boxShadow: `0 0 0 2px ${peer.colour}33` }}
              >
                <Avatar name={peer.name} size={22} className="bg-ink-750" />
              </span>
            </Tooltip>
          ))}
          {overflow > 0 && (
            <Tooltip label={others.slice(MAX_VISIBLE).map((p) => p.name).join(", ")}>
              <span className="inline-flex size-[22px] items-center justify-center rounded-full border border-border-strong bg-ink-800 font-mono text-[10px] text-muted-strong ring-2 ring-ink-900">
                +{overflow}
              </span>
            </Tooltip>
          )}
        </div>
      )}
      <span className="sr-only" aria-live="polite">
        {others.length === 0 ? "No other collaborators here" : `${others.length} collaborator${others.length === 1 ? "" : "s"} viewing`}
      </span>
    </div>
  );
}
