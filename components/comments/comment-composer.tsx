"use client";

import * as React from "react";
import { Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, truncate } from "@/lib/utils";

/**
 * Comment composer — textarea + ⌘/Ctrl+Enter to submit.
 * Deliberately chrome-free so it reads like a margin note, not a form.
 */
export function CommentComposer({
  onSubmit,
  placeholder = "Leave a note…",
  submitLabel = "Comment",
  initialValue = "",
  quotedText,
  onClearQuote,
  onCancel,
  compact,
  autoFocus,
  focusSignal = 0,
  className,
}: {
  onSubmit: (body: string) => Promise<boolean>;
  placeholder?: string;
  submitLabel?: string;
  initialValue?: string;
  quotedText?: string | null;
  onClearQuote?: () => void;
  onCancel?: () => void;
  compact?: boolean;
  autoFocus?: boolean;
  /** Bump this number to focus the textarea (used by the selection event). */
  focusSignal?: number;
  className?: string;
}) {
  const [value, setValue] = React.useState(initialValue);
  const [submitting, setSubmitting] = React.useState(false);
  const ref = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [value]);

  React.useEffect(() => {
    if (autoFocus) ref.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus]);

  React.useEffect(() => {
    if (focusSignal > 0) {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }, [focusSignal]);

  async function submit() {
    const body = value.trim();
    if (!body || submitting) return;
    setSubmitting(true);
    const ok = await onSubmit(body);
    setSubmitting(false);
    if (ok) setValue("");
  }

  return (
    <div
      className={cn(
        "group/composer rounded-lg border border-border-strong bg-ink-900/70 transition focus-within:border-accent/60 focus-within:bg-ink-900",
        compact ? "px-2.5 py-2" : "px-3 py-2.5",
        className,
      )}
    >
      {quotedText && (
        <div className="mb-2 flex items-start gap-2 rounded-md border-l-2 border-accent/60 bg-accent/5 py-1.5 pl-2 pr-1">
          <p className="min-w-0 flex-1 font-serif text-[12.5px] italic leading-snug text-muted-strong">
            “{truncate(quotedText, 180)}”
          </p>
          {onClearQuote && (
            <button
              type="button"
              onClick={onClearQuote}
              aria-label="Remove quoted text"
              className="mt-0.5 rounded p-0.5 text-muted transition hover:bg-ink-800 hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
      )}

      <textarea
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void submit();
          }
          if (e.key === "Escape" && onCancel) onCancel();
        }}
        rows={compact ? 2 : 3}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full resize-none border-0 bg-transparent p-0 text-[13px] leading-relaxed text-foreground placeholder:text-muted/70 focus:outline-none focus:ring-0"
      />

      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted/60">⌘↵ to send</span>
        <div className="flex items-center gap-1.5">
          {onCancel && (
            <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="h-7 px-2 text-[12px]">
              Cancel
            </Button>
          )}
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => void submit()}
            disabled={!value.trim()}
            loading={submitting}
            className="h-7 gap-1 px-2.5 text-[12px]"
          >
            {!submitting && <Send className="size-3" />}
            {submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
