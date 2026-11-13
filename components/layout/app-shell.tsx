"use client";

import * as React from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { CommandPalette } from "@/components/layout/command-palette";
import type { ProjectSummary } from "@/lib/data";

export function AppShell({
  projects,
  user,
  children,
}: {
  projects: ProjectSummary[];
  user: { name: string; email: string; avatar: string | null; plan: string };
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        projects={projects}
        user={user}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onSearch={() => setPaletteOpen(true)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <button
          onClick={() => setSidebarOpen(true)}
          className="absolute left-3 top-3 z-20 rounded-md border border-border bg-ink-900/80 p-1.5 text-muted backdrop-blur md:hidden"
          aria-label="Open menu"
        >
          <Menu className="size-4" />
        </button>
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
      <CommandPalette projects={projects} open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
