"use client";

import * as Y from "yjs";
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from "y-protocols/awareness";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { fromBase64, toBase64 } from "./base64";

export type CollabStatus = "connecting" | "ready" | "offline";

export interface CollabUser {
  id: string;
  name: string;
  color: string;
  avatarUrl?: string | null;
}

export interface Peer {
  clientId: number;
  id: string;
  name: string;
  color: string;
  avatarUrl?: string | null;
  isLocal: boolean;
}

/** Marks updates that arrive from the wire so they are never echoed back. */
const REMOTE_ORIGIN = { source: "inkwell-supabase" } as const;

/** Broadcast messages are capped well below Supabase Realtime's payload limit. */
const MAX_CHUNK = 120_000;
const STALE_PEER_MS = 45_000;
const HEARTBEAT_MS = 15_000;

interface DataPayload {
  id: string;
  index: number;
  count: number;
  data: string;
  from?: number;
  to?: number;
}

function randomId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/**
 * A deliberately small Yjs provider on top of Supabase Realtime broadcast.
 *
 * - `chapter:${id}` channel, public (RLS still guards persistence through the
 *   normal save path; broadcasts carry document deltas only).
 * - join handshake: a newcomer broadcasts `yjs-sync-request`; an established
 *   peer answers with a full state update plus its awareness snapshot.
 * - awareness carries cursor selection (via CollaborationCursor), name, colour.
 * - every failure path degrades to local-only editing.
 */
export class SupabaseYjsProvider {
  readonly ydoc: Y.Doc;
  readonly awareness: Awareness;
  readonly user: CollabUser;
  private supabase: SupabaseClient;
  private channel: RealtimeChannel;
  private status: CollabStatus = "connecting";
  private destroyed = false;

  private peerListeners = new Set<(peers: Peer[]) => void>();
  private statusListeners = new Set<(status: CollabStatus) => void>();
  private chunks = new Map<string, { parts: string[]; received: number; total: number; timer: number }>();
  private lastSeen = new Map<number, number>();
  private heartbeat: number | null = null;
  private prune: number | null = null;

  private onDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (this.destroyed || origin === REMOTE_ORIGIN) return;
    if (this.status !== "ready") return;
    this.sendData("yjs-update", toBase64(update), { from: this.ydoc.clientID });
  };

  private onAwarenessUpdate = (
    changes: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ) => {
    for (const id of [...changes.added, ...changes.updated]) this.lastSeen.set(id, Date.now());
    if (origin !== REMOTE_ORIGIN) this.lastSeen.set(this.ydoc.clientID, Date.now());
    this.emitPeers();
    if (this.destroyed || origin === REMOTE_ORIGIN || this.status !== "ready") return;
    const ids = [...changes.added, ...changes.updated, ...changes.removed];
    if (!ids.length) return;
    const update = encodeAwarenessUpdate(this.awareness, ids);
    this.send("awareness", { update: toBase64(update), from: this.ydoc.clientID });
  };

  private onBeforeUnload = () => {
    if (this.destroyed) return;
    this.awareness.setLocalState(null);
  };

  constructor(opts: {
    supabase: SupabaseClient;
    channelName: string;
    ydoc: Y.Doc;
    user: CollabUser;
  }) {
    this.supabase = opts.supabase;
    this.ydoc = opts.ydoc;
    this.user = opts.user;
    this.awareness = new Awareness(this.ydoc);
    this.awareness.setLocalStateField("user", {
      id: opts.user.id,
      name: opts.user.name,
      color: opts.user.color,
      avatarUrl: opts.user.avatarUrl ?? null,
    });
    this.channel = this.supabase.channel(opts.channelName, {
      config: { broadcast: { self: false, ack: false } },
    });
  }

  /* ------------------------------------------------------------- lifecycle */

  start() {
    this.ydoc.on("update", this.onDocUpdate);
    this.awareness.on("update", this.onAwarenessUpdate);

    this.channel
      .on("broadcast", { event: "yjs-update" }, (message) => this.receiveData(message.payload as DataPayload))
      .on("broadcast", { event: "yjs-sync-state" }, (message) => this.receiveData(message.payload as DataPayload))
      .on("broadcast", { event: "yjs-sync-request" }, (message) => {
        const payload = message.payload as { from?: number };
        if (!payload?.from || payload.from === this.ydoc.clientID) return;
        this.sendFullState(payload.from);
      })
      .on("broadcast", { event: "awareness" }, (message) => {
        const payload = message.payload as { update?: string; from?: number };
        if (!payload?.update || payload.from === this.ydoc.clientID) return;
        if (typeof payload.from === "number") this.lastSeen.set(payload.from, Date.now());
        try {
          applyAwarenessUpdate(this.awareness, fromBase64(payload.update), REMOTE_ORIGIN);
        } catch {
          // a corrupt awareness packet must never break local editing
        }
      })
      .on("broadcast", { event: "awareness-remove" }, (message) => {
        const payload = message.payload as { clientId?: number };
        if (!payload?.clientId || payload.clientId === this.ydoc.clientID) return;
        try {
          removeAwarenessStates(this.awareness, [payload.clientId], REMOTE_ORIGIN);
        } catch {
          // ignore
        }
      });

    this.channel.subscribe((status) => {
      if (this.destroyed) return;
      if (status === "SUBSCRIBED") {
        this.setStatus("ready");
        this.requestSync();
        this.sendAwareness([this.ydoc.clientID]);
        this.startHeartbeat();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        this.setStatus("offline");
      }
    });

    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", this.onBeforeUnload);
    }
  }

  destroy() {
    if (this.destroyed) return;

    // Announce the departure while the channel is still open; `send` refuses to
    // work once destroyed is set, so this has to happen first.
    try {
      this.send("awareness-remove", { clientId: this.ydoc.clientID });
    } catch {
      // ignore
    }

    this.destroyed = true;

    if (typeof window !== "undefined") {
      window.removeEventListener("beforeunload", this.onBeforeUnload);
    }
    if (this.heartbeat !== null) window.clearInterval(this.heartbeat);
    if (this.prune !== null) window.clearInterval(this.prune);
    for (const entry of this.chunks.values()) window.clearTimeout(entry.timer);
    this.chunks.clear();

    try {
      this.awareness.setLocalState(null);
    } catch {
      // ignore
    }

    this.ydoc.off("update", this.onDocUpdate);
    this.awareness.off("update", this.onAwarenessUpdate);
    this.awareness.destroy();
    try {
      // Give the leave broadcast a beat to flush, then tear the channel down.
      const channel = this.channel;
      const supabase = this.supabase;
      setTimeout(() => {
        void supabase.removeChannel(channel).catch(() => undefined);
      }, 80);
    } catch {
      // ignore
    }
    this.peerListeners.clear();
    this.statusListeners.clear();
  }

  /* --------------------------------------------------------------- status */

  getStatus(): CollabStatus {
    return this.status;
  }

  onStatus(listener: (status: CollabStatus) => void) {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  onPeers(listener: (peers: Peer[]) => void) {
    this.peerListeners.add(listener);
    listener(this.getPeers());
    return () => this.peerListeners.delete(listener);
  }

  getPeers(): Peer[] {
    const peers: Peer[] = [];
    this.awareness.states.forEach((state, clientId) => {
      const user = state?.user as CollabUser | undefined;
      if (!user?.name) return;
      peers.push({
        clientId,
        id: user.id,
        name: user.name,
        color: user.color,
        avatarUrl: user.avatarUrl ?? null,
        isLocal: clientId === this.ydoc.clientID,
      });
    });
    return peers.sort((a, b) => (a.isLocal === b.isLocal ? a.name.localeCompare(b.name) : a.isLocal ? -1 : 1));
  }

  /** True when at least one other client is currently present. */
  hasPeers(): boolean {
    return this.getPeers().some((p) => !p.isLocal);
  }

  private setStatus(status: CollabStatus) {
    if (this.status === status) return;
    this.status = status;
    this.statusListeners.forEach((listener) => listener(status));
  }

  private emitPeers() {
    if (this.activeListeners === 0) return;
    const peers = this.getPeers();
    this.peerListeners.forEach((listener) => listener(peers));
  }

  private get activeListeners() {
    return this.peerListeners.size;
  }

  /* ------------------------------------------------------------------ sync */

  private requestSync() {
    this.send("yjs-sync-request", { from: this.ydoc.clientID, at: Date.now() });
  }

  private sendAwareness(ids: number[]) {
    if (!ids.length) return;
    try {
      const update = encodeAwarenessUpdate(this.awareness, ids);
      this.send("awareness", { update: toBase64(update), from: this.ydoc.clientID });
    } catch {
      // ignore malformed awareness state
    }
  }

  private sendFullState(to?: number) {
    const update = Y.encodeStateAsUpdate(this.ydoc);
    this.sendData("yjs-sync-state", toBase64(update), { from: this.ydoc.clientID, to });

    const ids = Array.from(this.awareness.states.keys());
    if (ids.length) {
      try {
        const awareness = encodeAwarenessUpdate(this.awareness, ids);
        this.send("awareness", { update: toBase64(awareness), from: this.ydoc.clientID });
      } catch {
        // ignore
      }
    }
  }

  private receiveData(payload: DataPayload | undefined) {
    if (this.destroyed || !payload?.id || typeof payload.data !== "string") return;
    if (typeof payload.to === "number" && payload.to !== this.ydoc.clientID) return;
    if (payload.from === this.ydoc.clientID) return;

    let base64 = payload.data;
    if (payload.count > 1) {
      const key = `${payload.from ?? "?"}:${payload.id}`;
      const entry =
        this.chunks.get(key) ??
        ({ parts: new Array(payload.count).fill(""), received: 0, total: payload.count, timer: 0 } as {
          parts: string[];
          received: number;
          total: number;
          timer: number;
        });
      if (!this.chunks.has(key)) {
        entry.timer = window.setTimeout(() => this.chunks.delete(key), 15_000);
        this.chunks.set(key, entry);
      }
      if (payload.index >= 0 && payload.index < entry.total && !entry.parts[payload.index]) {
        entry.parts[payload.index] = payload.data;
        entry.received += 1;
      }
      if (entry.received < entry.total) return;
      window.clearTimeout(entry.timer);
      this.chunks.delete(key);
      base64 = entry.parts.join("");
    }

    try {
      const update = fromBase64(base64);
      Y.applyUpdate(this.ydoc, update, REMOTE_ORIGIN);
    } catch {
      // never let a bad packet kill the editor
    }
  }

  private sendData(event: "yjs-update" | "yjs-sync-state", base64: string, extra: { from: number; to?: number }) {
    const id = randomId();
    if (base64.length <= MAX_CHUNK) {
      this.send(event, { id, index: 0, count: 1, data: base64, ...extra });
      return;
    }
    const count = Math.ceil(base64.length / MAX_CHUNK);
    for (let index = 0; index < count; index += 1) {
      this.send(event, {
        id,
        index,
        count,
        data: base64.slice(index * MAX_CHUNK, (index + 1) * MAX_CHUNK),
        ...extra,
      });
    }
  }

  private send(event: string, payload: Record<string, unknown>) {
    if (this.destroyed) return;
    try {
      const result = this.channel.send({ type: "broadcast", event, payload });
      if (result && typeof (result as Promise<unknown>).catch === "function") {
        (result as Promise<unknown>).catch(() => undefined);
      }
    } catch {
      // channel not ready yet; the join handshake will catch peers up
    }
  }

  private startHeartbeat() {
    if (this.heartbeat !== null) return;
    this.heartbeat = window.setInterval(() => {
      if (this.destroyed) return;
      try {
        const ids = Array.from(this.awareness.states.keys());
        if (ids.length) {
          this.send("awareness", {
            update: toBase64(encodeAwarenessUpdate(this.awareness, ids)),
            from: this.ydoc.clientID,
          });
        }
      } catch {
        // ignore
      }
    }, HEARTBEAT_MS);

    this.prune = window.setInterval(() => {
      if (this.destroyed) return;
      const cutoff = Date.now() - STALE_PEER_MS;
      const stale: number[] = [];
      this.awareness.states.forEach((_state, clientId) => {
        if (clientId === this.ydoc.clientID) return;
        const seen = this.lastSeen.get(clientId) ?? Date.now();
        if (seen < cutoff) stale.push(clientId);
      });
      if (stale.length) {
        try {
          removeAwarenessStates(this.awareness, stale, REMOTE_ORIGIN);
          stale.forEach((id) => this.lastSeen.delete(id));
        } catch {
          // ignore
        }
      }
    }, HEARTBEAT_MS);
  }
}
