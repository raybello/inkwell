import * as React from "react";
import { cn } from "@/lib/utils";

const DARK: React.CSSProperties = {
  backgroundColor: "#1b1712",
  backgroundImage: [
    "radial-gradient(115% 85% at 20% 6%, rgba(224,160,107,0.14), transparent 58%)",
    "radial-gradient(85% 65% at 88% 98%, rgba(0,0,0,0.55), transparent 62%)",
    "repeating-linear-gradient(0deg, rgba(239,230,217,0.035) 0px, rgba(239,230,217,0.035) 1px, transparent 1px, transparent 3px)",
    "repeating-linear-gradient(90deg, rgba(0,0,0,0.06) 0px, rgba(0,0,0,0.06) 1px, transparent 1px, transparent 4px)",
    "linear-gradient(158deg, #2a2219 0%, #17130f 46%, #241d16 100%)",
  ].join(", "),
};

const LIGHT: React.CSSProperties = {
  backgroundColor: "#f2e9d8",
  backgroundImage: [
    "radial-gradient(120% 90% at 16% 4%, rgba(255,255,255,0.7), transparent 56%)",
    "radial-gradient(90% 70% at 92% 100%, rgba(122,96,58,0.16), transparent 62%)",
    "repeating-linear-gradient(0deg, rgba(122,96,58,0.045) 0px, rgba(122,96,58,0.045) 1px, transparent 1px, transparent 3px)",
    "repeating-linear-gradient(90deg, rgba(255,255,255,0.4) 0px, rgba(255,255,255,0.4) 1px, transparent 1px, transparent 5px)",
    "linear-gradient(160deg, #f6eee0 0%, #efe4d1 55%, #f3ebdb 100%)",
  ].join(", "),
};

/**
 * Warm paper / fibre grain. Sits behind content inside a relatively
 * positioned parent; purely decorative.
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
      className={cn("pointer-events-none absolute inset-0", className)}
      style={{ ...(tone === "light" ? LIGHT : DARK), ...style }}
    />
  );
}
