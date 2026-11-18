"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { getSchema } from "@tiptap/core";
import { prosemirrorJSONToYXmlFragment } from "y-prosemirror";
import { getBrowserClient } from "@/lib/supabase/client";
import { buildExtensions } from "@/lib/editor/extensions";
import { SupabaseYjsProvider, type CollabStatus, type CollabUser, type Peer } from "./provider";

/** Yjs field inside the chapter document; shared by the editor and the seeder. */
export const COLLAB_FIELD = "default";

const SYNC_WINDOW_MS = 700;
const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };

export interface UseChapterCollabResult {
  ydoc: Y.Doc;
  awareness: SupabaseYjsProvider["awareness"] | null;
  provider: SupabaseYjsProvider | null;
  peers: Peer[];
  status: CollabStatus;
}

function normalizeDoc(content: unknown): Record<string, unknown> {
  if (content && typeof content === "object" && (content as { type?: string }).type === "doc") {
    return content as Record<string, unknown>;
  }
  return EMPTY_DOC as unknown as Record<string, unknown>;
}

/**
 * Seeds a chapter's Yjs fragment from the database row, but only when the
 * document is empty and (if anyone else is present) we are the lowest client
 * id — so two peers opening a fresh chapter don't double-insert the text.
 */
function seedIfEmpty(provider: SupabaseYjsProvider, content: unknown) {
  const fragment = provider.ydoc.getXmlFragment(COLLAB_FIELD);
  if (fragment.length > 0) return;

  const others = provider.getPeers().filter((peer) => !peer.isLocal);
  if (others.length) {
    const lowest = Math.min(provider.ydoc.clientID, ...others.map((p) => p.clientId));
    if (provider.ydoc.clientID !== lowest) return;
  }

  try {
    const schema = getSchema(buildExtensions());
    const doc = normalizeDoc(content);
    provider.ydoc.transact(() => {
      prosemirrorJSONToYXmlFragment(schema, doc as never, fragment);
    }, "inkwell-seed");
  } catch {
    // if seeding fails the editor simply opens empty; saving still works
  }
}

/**
 * Creates the per-chapter Yjs document, connects the Supabase provider and
 * reports when it is safe to mount the collaborative editor. If Realtime is
 * unavailable the hook resolves to `offline` and the editor runs locally.
 */
export function useChapterCollab(options: {
  chapterId: string;
  user: CollabUser;
  initialContent: unknown;
  enabled?: boolean;
}): UseChapterCollabResult {
  const { chapterId, user, initialContent, enabled = true } = options;

  const ydoc = useMemo(() => new Y.Doc(), [chapterId]);
  const providerRef = useRef<SupabaseYjsProvider | null>(null);
  const [status, setStatus] = useState<CollabStatus>(enabled ? "connecting" : "offline");
  const [peers, setPeers] = useState<Peer[]>([]);
  const contentRef = useRef(initialContent);
  contentRef.current = initialContent;

  const userId = user.id;
  const userName = user.name;
  const userColor = user.color;
  const userAvatar = user.avatarUrl ?? null;

  useEffect(() => {
    if (!enabled) {
      setStatus("offline");
      return;
    }

    let cancelled = false;
    let seedTimer: number | null = null;
    let fallbackTimer: number | null = null;
    let hydrated = false;

    let provider: SupabaseYjsProvider;
    try {
      const supabase = getBrowserClient();
      provider = new SupabaseYjsProvider({
        supabase,
        channelName: `chapter:${chapterId}`,
        ydoc,
        user: { id: userId, name: userName, color: userColor, avatarUrl: userAvatar },
      });
      providerRef.current = provider;
    } catch {
      // no Realtime available (missing env, blocked websockets): edit locally
      setStatus("offline");
      return;
    }

    provider.onStatus((next) => {
      if (cancelled) return;
      if (next === "ready") {
        if (hydrated) return;
        if (seedTimer === null) {
          seedTimer = window.setTimeout(() => {
            seedTimer = null;
            if (hydrated || cancelled) return;
            hydrated = true;
            seedIfEmpty(provider, contentRef.current);
            setStatus("ready");
          }, SYNC_WINDOW_MS);
        }
        return;
      }
      if (next === "offline" && !hydrated) {
        hydrated = true;
        setStatus("offline");
      }
    });
    provider.onPeers((next) => {
      if (!cancelled) setPeers(next);
    });

    try {
      provider.start();
    } catch {
      hydrated = true;
      setStatus("offline");
      providerRef.current = null;
      return;
    }

    // If Realtime never subscribes, stop waiting and let the writer work.
    fallbackTimer = window.setTimeout(() => {
      if (hydrated || cancelled) return;
      hydrated = true;
      setStatus("offline");
    }, 2500);

    return () => {
      cancelled = true;
      if (seedTimer !== null) window.clearTimeout(seedTimer);
      if (fallbackTimer !== null) window.clearTimeout(fallbackTimer);
      provider.destroy();
      providerRef.current = null;
    };
    // the ydoc is recreated only when the chapter changes
  }, [chapterId, enabled, ydoc, userId, userName, userColor, userAvatar]);

  return {
    ydoc,
    awareness: providerRef.current?.awareness ?? null,
    provider: providerRef.current,
    peers,
    status,
  };
}
