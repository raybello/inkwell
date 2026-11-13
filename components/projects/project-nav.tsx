"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Columns3,
  Frame,
  Grid2x2,
  Image as ImageIcon,
  LayoutDashboard,
  PenLine,
  Settings,
  Share2,
  Shapes,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function ProjectNav({
  projectId,
  firstChapterId,
}: {
  projectId: string;
  firstChapterId: string | null;
}) {
  const pathname = usePathname();
  const base = `/app/projects/${projectId}`;

  const items = [
    { href: base, label: "Overview", icon: LayoutDashboard, exact: true },
    { href: firstChapterId ? `${base}/editor/${firstChapterId}` : `${base}/editor`, label: "Write", icon: PenLine, match: "/editor" },
    { href: `${base}/storyboard`, label: "Storyboard", icon: Columns3 },
    { href: `${base}/corkboard`, label: "Corkboard", icon: Grid2x2 },
    { href: `${base}/canvas`, label: "Canvas", icon: Shapes },
    { href: `${base}/assets`, label: "Assets", icon: ImageIcon },
    { href: `${base}/preview`, label: "Preview", icon: BookOpen },
    { href: `${base}/export`, label: "Export", icon: Download },
    { href: `${base}/settings`, label: "Settings", icon: Settings },
  ];

  return (
    <nav className="flex items-center gap-0.5 overflow-x-auto">
      {items.map((item) => {
        const active = item.match
          ? pathname.includes(item.match)
          : item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12.5px] transition",
              active
                ? "bg-ink-800 text-foreground"
                : "text-muted hover:bg-ink-850 hover:text-muted-strong",
            )}
          >
            <item.icon className="size-3.5" />
            <span className="hidden sm:inline">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
