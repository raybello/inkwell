import Link from "next/link";
import { Columns3, Grid2x2 } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { id: "storyboard", label: "Storyboard", icon: Columns3 },
  { id: "corkboard", label: "Corkboard", icon: Grid2x2 },
] as const;

export function ViewSwitcher({
  projectId,
  current,
}: {
  projectId: string;
  current: "storyboard" | "corkboard";
}) {
  return (
    <div
      role="tablist"
      aria-label="Board view"
      className="flex items-center gap-0.5 rounded-md border border-border bg-ink-900/70 p-0.5"
    >
      {ITEMS.map((item) => {
        const active = current === item.id;
        return (
          <Link
            key={item.id}
            href={`/app/projects/${projectId}/${item.id}`}
            role="tab"
            aria-selected={active}
            className={cn(
              "flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[12px] transition",
              active
                ? "bg-ink-750 text-foreground shadow-sm"
                : "text-muted hover:bg-ink-850 hover:text-muted-strong",
            )}
          >
            <item.icon className="size-3.5" />
            <span className="hidden sm:inline">{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
