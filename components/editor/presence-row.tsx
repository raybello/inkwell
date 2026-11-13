"use client";

import * as React from "react";
import { Avatar } from "@/components/ui/misc";
import type { Peer } from "@/lib/collab/provider";
import { cn } from "@/lib/utils";

/** Live presence avatars for the chapter header. */
export function PresenceAvatars({
  peers,
  status,
  className,
}: {
  peers: Peer[];
  status: "connecting" | "ready" | "offline";
  className?: string;
}) {
  const visible = peers.slice(0, 3);
  const overflow = Math.max(0, peers.length - visible.length);
  const online = status === "ready";
  const remoteCount = peers.filter((peer) => !peer.isLocal).length;

  return (
    <div className={cn("flex items-center gap-1.5", className)} aria-live="polite">
      <span
        className={cn(
          "size-1.5 rounded-full",
          online ? "bg-sage shadow-[0_0_0_3px_rgba(125,154,126,0.18)]" : "bg-ink-600",
        )}
        aria-hidden
      />
      <div className="flex items-center -space-x-1.5">
        {visible.map((peer) => (
          <span
            key={peer.clientId}
            className="inline-flex rounded-full p-[1.5px]"
            style={{ backgroundColor: peer.color }}
            title={`${peer.name}${peer.isLocal ? " (you)" : ""}`}
          >
            <Avatar name={peer.name} src={peer.avatarUrl ?? null} size={24} ring />
          </span>
        ))}
        {overflow > 0 && (
          <span className="inline-flex size-[27px] items-center justify-center rounded-full bg-ink-750 px-1 font-mono text-[10px] text-muted-strong ring-2 ring-ink-900">
            +{overflow}
          </span>
        )}
      </div>
      <span className="sr-only">
        {online
          ? remoteCount
            ? `${remoteCount} collaborator${remoteCount === 1 ? "" : "s"} viewing this chapter.`
            : "Live collaboration connected. Only you are here."
          : "Working locally. Collaboration is offline."}
      </span>
      {online && remoteCount > 0 && (
        <span className="hidden font-mono text-[10px] uppercase tracking-[0.12em] text-sage xl:inline">live</span>
      )}
    </div>
  );
}
