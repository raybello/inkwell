"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, FileText, Plus, Search, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProjectSummary } from "@/lib/data";

export function CommandPalette({
  projects,
  open,
  onOpenChange,
}: {
  projects: ProjectSummary[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [index, setIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      setQ("");
      setIndex(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const results = React.useMemo(() => {
    type Result = { id: string; label: string; href: string; icon: typeof Plus; meta?: string };
    const actions: Result[] = [
      { id: "new", label: "Create a new project", href: "/app/projects/new", icon: Plus },
      { id: "settings", label: "Account settings", href: "/app/settings", icon: Settings },
    ];
    const proj: Result[] = projects.map((p) => ({
      id: p.id,
      label: p.title,
      href: `/app/projects/${p.id}`,
      icon: FileText,
      meta: `${p.chapterCount} chapters · ${p.wordCount.toLocaleString()} words`,
    }));
    const all = [...actions, ...proj];
    if (!q.trim()) return all;
    return all.filter((r) => r.label.toLowerCase().includes(q.toLowerCase()));
  }, [projects, q]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[14vh]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
      <div className="relative w-full max-w-xl overflow-hidden rounded-xl border border-border-strong bg-ink-900 shadow-2xl fade-in">
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="size-4 text-muted" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setIndex((i) => Math.min(i + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setIndex((i) => Math.max(i - 1, 0));
              } else if (e.key === "Enter" && results[index]) {
                router.push(results[index].href);
                onOpenChange(false);
              } else if (e.key === "Escape") {
                onOpenChange(false);
              }
            }}
            placeholder="Search projects and actions…"
            className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted/70"
          />
        </div>
        <div className="max-h-[320px] overflow-y-auto p-1.5">
          {results.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted">No matches.</p>}
          {results.map((r, i) => (
            <button
              key={r.id}
              onMouseEnter={() => setIndex(i)}
              onClick={() => {
                router.push(r.href);
                onOpenChange(false);
              }}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px]",
                i === index ? "bg-ink-750 text-foreground" : "text-muted-strong",
              )}
            >
              <r.icon className="size-3.5 shrink-0 text-muted" />
              <span className="min-w-0 flex-1 truncate">{r.label}</span>
              {r.meta && <span className="text-[11px] text-muted/70">{r.meta}</span>}
              {i === index && <ArrowRight className="size-3 text-muted" />}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 border-t border-border bg-ink-850/50 px-3 py-1.5 text-[10px] text-muted">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}
