"use client";

import * as React from "react";
import { saveChapterContent } from "@/lib/actions/chapters";

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

export interface SaveReceipt {
  wordCount: number;
  updatedAt: string;
}

/**
 * Debounced chapter auto-save with an in-flight queue, a navigation guard and
 * a best-effort flush when the tab is hidden. The server action computes the
 * markdown mirror and the trigger computes `word_count`.
 */
export function useChapterAutosave(options: {
  projectId: string;
  chapterId: string;
  enabled: boolean;
  delay?: number;
  getContent: () => unknown;
  onSaved?: (receipt: SaveReceipt) => void;
}) {
  const { projectId, chapterId, enabled, delay = 1200 } = options;

  const [state, setState] = React.useState<SaveState>("idle");
  const [savedAt, setSavedAt] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const getContentRef = React.useRef(options.getContent);
  getContentRef.current = options.getContent;
  const onSavedRef = React.useRef(options.onSaved);
  onSavedRef.current = options.onSaved;

  const dirtyRef = React.useRef(false);
  const savingRef = React.useRef(false);
  const pendingRef = React.useRef(false);
  const timerRef = React.useRef<number | null>(null);
  const saveRef = React.useRef<(() => Promise<boolean>) | null>(null);

  const saveNow = React.useCallback(async (): Promise<boolean> => {
    if (!enabled) return true;
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (savingRef.current) {
      pendingRef.current = true;
      return false;
    }
    if (!dirtyRef.current) return true;

    dirtyRef.current = false;
    savingRef.current = true;
    setState("saving");
    setError(null);

    try {
      const content = getContentRef.current();
      // The editor may already be unmounted (flush on unmount). Never write a
      // missing document over the chapter.
      if (!content) {
        dirtyRef.current = true;
        setState("dirty");
        return true;
      }
      const result = await saveChapterContent({ projectId, chapterId, content });
      if (result.ok) {
        dirtyRef.current = false;
        setState("saved");
        setSavedAt(Date.now());
        onSavedRef.current?.(result.data);
        return true;
      }
      dirtyRef.current = true;
      setState("error");
      setError(result.error);
      return false;
    } catch (err) {
      dirtyRef.current = true;
      setState("error");
      setError(err instanceof Error ? err.message : "Save failed.");
      return false;
    } finally {
      savingRef.current = false;
      if (pendingRef.current) {
        pendingRef.current = false;
        void saveRef.current?.();
      }
    }
  }, [projectId, chapterId, enabled]);

  saveRef.current = saveNow;

  const schedule = React.useCallback(() => {
    if (!enabled) return;
    dirtyRef.current = true;
    setState((current) => (current === "saving" ? current : "dirty"));
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      void saveRef.current?.();
    }, delay);
  }, [enabled, delay]);

  /** Use for explicit ⌘S / blur / button saves. */
  const flush = React.useCallback(() => {
    return saveRef.current?.() ?? Promise.resolve(true);
  }, []);

  // Navigation guard: warn before closing with unsaved prose, and try to flush
  // when the tab is backgrounded (mobile browsers kill tabs aggressively).
  React.useEffect(() => {
    if (!enabled) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current && !savingRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && dirtyRef.current) {
        void saveRef.current?.();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVisibility);
      if (dirtyRef.current) void saveRef.current?.();
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [enabled]);

  return {
    state,
    savedAt,
    error,
    isDirty: dirtyRef.current,
    schedule,
    saveNow,
    flush,
  };
}
