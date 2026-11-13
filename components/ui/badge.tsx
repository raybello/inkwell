import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "border-border-strong bg-ink-800 text-muted-strong",
        accent: "border-accent/30 bg-accent/12 text-accent-soft",
        sage: "border-sage/30 bg-sage/15 text-sage",
        plum: "border-plum/30 bg-plum/15 text-plum",
        red: "border-red-800/50 bg-red-900/25 text-red-300",
        amber: "border-amber-700/40 bg-amber-800/20 text-amber-300",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Badge({
  className,
  tone,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export const STATUS_TONE: Record<string, "neutral" | "accent" | "sage" | "plum" | "amber"> = {
  draft: "neutral",
  in_progress: "accent",
  complete: "sage",
  needs_review: "amber",
};

export const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  in_progress: "In Progress",
  complete: "Complete",
  needs_review: "Needs Review",
};
