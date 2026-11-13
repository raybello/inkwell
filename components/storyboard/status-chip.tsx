import { cn } from "@/lib/utils";
import { STATUS_LABEL } from "@/components/ui/badge";

const STATUS_COLOR: Record<string, string> = {
  draft: "#8f8069",
  in_progress: "#b5713d",
  complete: "#6f8f70",
  needs_review: "#b3873c",
};

/**
 * Small paper-friendly status marker. Deliberately not the dark Badge so it
 * sits correctly on the cream index-card stock.
 */
export function StatusChip({ status, className }: { status: string; className?: string }) {
  const color = STATUS_COLOR[status] ?? "#8f8069";
  const label = STATUS_LABEL[status] ?? status.replace(/_/g, " ");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-ink-500",
        className,
      )}
    >
      <span aria-hidden className="size-[5px] rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
