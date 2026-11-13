"use client";

/**
 * PLACEHOLDER — replaced by the AI/API stream (backend) or editor stream (UI).
 * Contract: sliding AI assistant panel scoped to the current chapter.
 */
export function AIPanel({
  projectId,
  chapterId,
  open,
  onOpenChange,
  onInsert,
}: {
  projectId: string;
  chapterId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert?: (text: string) => void;
}) {
  if (!open) return null;
  return (
    <aside className="w-80 shrink-0 border-l border-border bg-ink-900 p-4">
      <p className="text-xs text-muted">AI assistant loading…</p>
    </aside>
  );
}
