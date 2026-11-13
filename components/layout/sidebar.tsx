"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookMarked,
  ChevronRight,
  Feather,
  Bell,
  LayoutGrid,
  LogOut,
  Plus,
  Search,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import { Avatar } from "@/components/ui/misc";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { signOutAction } from "@/lib/actions/auth";
import type { ProjectSummary } from "@/lib/data";

const TYPE_DOT: Record<string, string> = {
  book: "bg-accent",
  ebook: "bg-sage",
  article: "bg-plum",
  blog: "bg-amber-500",
  custom: "bg-ink-400",
};

export function Sidebar({
  projects,
  user,
  open,
  onClose,
  onSearch,
}: {
  projects: ProjectSummary[];
  user: {
    name: string;
    email: string;
    avatar: string | null;
    plan: string;
    isAdmin: boolean;
    projectLimit: number | null;
  };
  open: boolean;
  onClose: () => void;
  onSearch: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={onClose} />
      )}
      <aside
        className={cn(
          "flex w-[268px] shrink-0 flex-col border-r border-border bg-ink-900/60",
          "max-md:fixed max-md:inset-y-0 max-md:left-0 max-md:z-40 max-md:bg-ink-900 max-md:transition-transform",
          open ? "max-md:translate-x-0" : "max-md:-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center justify-between px-4">
          <Link href="/app" className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-md bg-accent/15 text-accent">
              <Feather className="size-3.5" />
            </span>
            <span className="font-serif text-[15px] tracking-tight">Inkwell</span>
          </Link>
          <div className="flex items-center gap-0.5">
            <ThemeToggle />
            <button className="rounded-md p-1.5 text-muted hover:bg-ink-800 md:hidden" onClick={onClose}>
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="px-3 pb-2">
          <button
            onClick={onSearch}
            className="mb-2 flex w-full items-center gap-2 rounded-md border border-border bg-ink-850/70 px-2.5 py-1.5 text-[13px] text-muted transition hover:border-border-strong hover:text-muted-strong"
          >
            <Search className="size-3.5" />
            <span className="flex-1 text-left">Search…</span>
            <kbd className="rounded border border-border-strong bg-ink-800 px-1 font-mono text-[10px] text-muted">⌘K</kbd>
          </button>

          <Link
            href="/app/projects/new"
            className="flex items-center gap-2 rounded-md bg-accent px-2.5 py-1.5 text-[13px] font-medium text-ink-950 transition hover:bg-accent-soft"
          >
            <Plus className="size-3.5" />
            New project
          </Link>
        </div>

        <nav className="px-3 py-2">
          <SideLink href="/app" active={pathname === "/app"} icon={<LayoutGrid className="size-4" />}>
            Library
          </SideLink>
          <SideLink
            href="/app/notifications"
            active={pathname.startsWith("/app/notifications")}
            icon={<Bell className="size-4" />}
          >
            Notifications
          </SideLink>
          <SideLink href="/app/settings" active={pathname.startsWith("/app/settings")} icon={<Settings className="size-4" />}>
            Settings
          </SideLink>
        </nav>

        <div className="flex items-center justify-between px-4 pb-1 pt-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted/70">
            Projects
          </span>
          <span className="text-[10px] text-muted/60">{projects.length}</span>
        </div>

        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
          {projects.length === 0 && (
            <p className="px-2 py-3 text-xs leading-relaxed text-muted">
              Nothing here yet. Start with a title and a blank page.
            </p>
          )}
          {projects.map((p) => {
            const active = pathname.startsWith(`/app/projects/${p.id}`);
            return (
              <Link
                key={p.id}
                href={`/app/projects/${p.id}`}
                className={cn(
                  "group flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition",
                  active ? "bg-ink-800 text-foreground" : "text-muted-strong hover:bg-ink-850 hover:text-foreground",
                )}
              >
                <span className={cn("size-1.5 shrink-0 rounded-full", TYPE_DOT[p.type] ?? "bg-ink-400")} />
                <span className="min-w-0 flex-1 truncate">{p.title}</span>
                <span className="shrink-0 font-mono text-[10px] text-muted/60 group-hover:hidden">
                  {p.wordCount > 0 ? `${Math.round(p.wordCount / 1000)}k` : ""}
                </span>
                <ChevronRight className="hidden size-3 shrink-0 text-muted/60 group-hover:block" />
              </Link>
            );
          })}
        </div>

        <div className="border-t border-border p-3">
          {user.isAdmin ? (
            <Link
              href="/app/settings/billing"
              className="mb-3 flex items-center gap-2 rounded-lg border border-sage/30 bg-sage/10 px-2.5 py-2 text-[12px] text-sage transition hover:bg-sage/15"
            >
              <Sparkles className="size-3.5 shrink-0" />
              <span className="flex-1 leading-tight">Unlimited access</span>
              <ChevronRight className="size-3" />
            </Link>
          ) : (
            <Link
              href="/app/settings/billing"
              className="mb-3 flex items-center gap-2 rounded-lg border border-accent/25 bg-accent/8 px-2.5 py-2 text-[12px] text-accent-soft transition hover:bg-accent/12"
            >
              <Sparkles className="size-3.5 shrink-0" />
              <span className="flex-1 leading-tight">
                {user.plan === "free" ? "Free plan" : `${user.plan[0].toUpperCase()}${user.plan.slice(1)} plan`}
                {" · "}
                {user.projectLimit == null
                  ? "unlimited projects"
                  : `${projects.length} of ${user.projectLimit} project${user.projectLimit === 1 ? "" : "s"}`}
              </span>
              <ChevronRight className="size-3" />
            </Link>
          )}
          <div className="flex items-center gap-2">
            <Avatar name={user.name} src={user.avatar} size={28} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] leading-tight">{user.name}</p>
              <p className="truncate text-[11px] text-muted">{formatNumber(projects.length)} {projects.length === 1 ? "project" : "projects"}</p>
            </div>
            <form action={signOutAction}>
              <button className="rounded-md p-1.5 text-muted hover:bg-ink-800 hover:text-foreground" title="Sign out">
                <LogOut className="size-3.5" />
              </button>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
}

function SideLink({
  href,
  active,
  icon,
  children,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition",
        active ? "bg-ink-800 text-foreground" : "text-muted-strong hover:bg-ink-850 hover:text-foreground",
      )}
    >
      {icon}
      {children}
    </Link>
  );
}
