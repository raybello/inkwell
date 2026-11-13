import Link from "next/link";
import { cn } from "@/lib/utils";

export type SettingsTab = "general" | "collaborators" | "history" | "webhooks" | "danger";

export function ProjectSettingsTabs({ projectId, active }: { projectId: string; active: SettingsTab }) {
  const base = `/app/projects/${projectId}/settings`;
  const items: { id: SettingsTab; label: string; href: string }[] = [
    { id: "general", label: "General", href: base },
    { id: "collaborators", label: "Collaborators", href: `${base}?tab=collaborators` },
    { id: "history", label: "History", href: `${base}/history` },
    { id: "webhooks", label: "Webhooks", href: `${base}?tab=webhooks` },
    { id: "danger", label: "Danger zone", href: `${base}?tab=danger` },
  ];

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-border">
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          aria-current={active === item.id ? "page" : undefined}
          className={cn(
            "-mb-px shrink-0 border-b-2 px-3 py-2 text-[13px] transition",
            active === item.id
              ? "border-accent text-foreground"
              : "border-transparent text-muted hover:border-border-strong hover:text-muted-strong",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
