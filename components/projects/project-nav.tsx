"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Columns3,
  Download,
  Grid2x2,
  Image as ImageIcon,
  LayoutDashboard,
  Palette,
  PenLine,
  Settings,
  Shapes,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  /** Shown on hover: what the tab is for and how to use it. */
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  exact?: boolean;
  match?: string;
}

export function ProjectNav({
  projectId,
  firstChapterId,
}: {
  projectId: string;
  firstChapterId: string | null;
}) {
  const pathname = usePathname();
  const base = `/app/projects/${projectId}`;

  const items: NavItem[] = [
    {
      href: base,
      label: "Overview",
      icon: LayoutDashboard,
      exact: true,
      hint: "The project home: reading stats, the chapter outline tree, notes and recent activity. Drag chapters here to reorder the book.",
    },
    {
      href: firstChapterId ? `${base}/editor/${firstChapterId}` : `${base}/editor`,
      label: "Write",
      icon: PenLine,
      match: "/editor",
      hint: "The manuscript editor. It autosaves as you type — ⌘S saves now, ⌘F finds and replaces, ⌘⇧M comments on a selection, ⌘⏎ toggles focus mode.",
    },
    {
      href: `${base}/storyboard`,
      label: "Storyboard",
      icon: Columns3,
      hint: "A horizontal lane of chapter cards. Drag cards to reorder the book, and drag images from the tray onto a card to pin a cover or mood reference.",
    },
    {
      href: `${base}/corkboard`,
      label: "Corkboard",
      icon: Grid2x2,
      hint: "The same chapters as an index-card grid. Colour-code by POV, arc or subplot to spot pacing problems, then drag to reorder.",
    },
    {
      href: `${base}/canvas`,
      label: "Canvas",
      icon: Shapes,
      hint: "An infinite whiteboard for plot arcs, character webs and world maps. Drag project images onto it, then clip a selection into chapter notes.",
    },
    {
      href: `${base}/assets`,
      label: "Assets",
      icon: ImageIcon,
      hint: "Every image and file in this project. Drop files anywhere to upload; copy a URL or markdown link, tag assets, or set one as the cover.",
    },
    {
      href: `${base}/cover`,
      label: "Cover",
      icon: Palette,
      hint: "Design the front and back cover — add text, images and rules, drag them into place, then render PNGs that every export embeds automatically.",
    },
    {
      href: `${base}/preview`,
      label: "Preview",
      icon: BookOpen,
      hint: "Read the book the way a reader will: e-book, blog or print layout, with type size, line height and margins you can adjust without touching the manuscript.",
    },
    {
      href: `${base}/export`,
      label: "Export",
      icon: Download,
      hint: "Generate EPUB 3, print or screen PDF, DOCX, Markdown, HTML or a JSON backup. Choose a style template and scope, then download or poll the job.",
    },
    {
      href: `${base}/settings`,
      label: "Settings",
      icon: Settings,
      hint: "Project metadata, collaborators and roles, version history with change tracking, webhook endpoints, and the delete or transfer controls.",
    },
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
          <div key={item.label} className="group/nav relative shrink-0">
            <Link
              href={item.href}
              title={item.hint}
              aria-label={`${item.label} — ${item.hint}`}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12.5px] transition",
                active
                  ? "bg-ink-800 text-foreground"
                  : "text-muted hover:bg-ink-850 hover:text-muted-strong",
              )}
            >
              <item.icon className="size-3.5" />
              <span className="hidden sm:inline">{item.label}</span>
            </Link>

            <div
              role="tooltip"
              className="pointer-events-none absolute left-0 top-full z-40 mt-1.5 hidden w-64 rounded-lg border border-border-strong bg-ink-850/95 p-3 text-[11.5px] leading-relaxed text-muted-strong opacity-0 shadow-xl backdrop-blur transition-opacity duration-150 group-hover/nav:opacity-100 group-focus-within/nav:opacity-100 md:block"
            >
              <p className="mb-1 font-medium text-foreground">{item.label}</p>
              {item.hint}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
