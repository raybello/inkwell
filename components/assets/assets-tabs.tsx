"use client";

import Link from "next/link";
import { Image as ImageIcon, Palette } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shared tab bar so the library and the cover studio feel like one workspace. */
export function AssetsTabs({ projectId, active }: { projectId: string; active: "assets" | "cover" }) {
  const base = `/app/projects/${projectId}/assets`;
  const tabs = [
    { id: "assets", label: "Assets", href: base, icon: ImageIcon },
    { id: "cover", label: "Cover", href: `/app/projects/${projectId}/cover`, icon: Palette },
  ] as const;

  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-ink-900/60 p-0.5">
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] transition",
              isActive ? "bg-ink-750 text-foreground shadow-sm" : "text-muted hover:text-muted-strong",
            )}
          >
            <tab.icon className="size-3.5" />
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
