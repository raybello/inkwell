"use client";

import * as React from "react";
import type { Editor } from "@tiptap/react";

/**
 * Typewriter scrolling: keep the caret line roughly 45% down the scroll view
 * whenever the selection moves or text is inserted.
 */
export function useTypewriterScroll(options: {
  editor: Editor | null;
  containerRef: React.RefObject<HTMLDivElement | null>;
  enabled: boolean;
}) {
  const { editor, containerRef, enabled } = options;

  React.useEffect(() => {
    if (!editor || !enabled) return;
    let frame = 0;

    const recentre = () => {
      const container = containerRef.current;
      if (!container) return;
      if (typeof window === "undefined") return;
      if (!editor.isFocused) return;

      const { from } = editor.state.selection;
      let coords: { top: number } | null = null;
      try {
        coords = editor.view.coordsAtPos(from);
      } catch {
        coords = null;
      }
      if (!coords) return;

      const box = container.getBoundingClientRect();
      const targetLine = box.top + box.height * 0.45;
      const delta = coords.top - targetLine;
      // Ignore tiny jitter and never fight the user's own scroll positions.
      if (Math.abs(delta) < 24) return;
      const maxScroll = container.scrollHeight - container.clientHeight;
      if (maxScroll <= 0) return;
      const next = Math.max(0, Math.min(maxScroll, container.scrollTop + delta));
      if (Math.abs(next - container.scrollTop) < 4) return;

      if (typeof container.scrollTo === "function") {
        container.scrollTo({ top: next, behavior: "auto" });
      } else {
        container.scrollTop = next;
      }
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        recentre();
      });
    };

    editor.on("selectionUpdate", schedule);
    editor.on("update", schedule);
    return () => {
      editor.off("selectionUpdate", schedule);
      editor.off("update", schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [editor, containerRef, enabled]);
}
