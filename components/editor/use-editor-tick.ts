"use client";

import * as React from "react";
import type { Editor } from "@tiptap/react";

/**
 * Re-render on any editor transaction / selection change so toolbar active
 * states stay in sync without pulling in heavier state libraries.
 */
export function useEditorTick(editor: Editor | null): number {
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    if (!editor) return;
    const bump = () => setTick((value) => value + 1);
    editor.on("transaction", bump);
    editor.on("selectionUpdate", bump);
    editor.on("focus", bump);
    editor.on("blur", bump);
    return () => {
      editor.off("transaction", bump);
      editor.off("selectionUpdate", bump);
      editor.off("focus", bump);
      editor.off("blur", bump);
    };
  }, [editor]);

  return tick;
}
