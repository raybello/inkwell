import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Warm paper / fibre grain, purely decorative.
 *
 * The gradients live in globals.css (`.paper-texture--*`) so the light theme can
 * swap the grain without touching inline styles.
 */
export function PaperTexture({
  tone = "dark",
  className,
  style,
}: {
  tone?: "dark" | "light";
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "paper-texture pointer-events-none absolute inset-0",
        tone === "light" ? "paper-texture--light" : "paper-texture--dark",
        className,
      )}
      style={style}
    />
  );
}
