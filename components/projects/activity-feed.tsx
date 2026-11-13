import {
  BookOpen,
  Download,
  Image as ImageIcon,
  Layers,
  MessageSquare,
  PenLine,
  StickyNote,
  UserPlus,
} from "lucide-react";
import { Avatar } from "@/components/ui/misc";
import { relativeTime } from "@/lib/utils";
import type { Activity } from "@/lib/types";

const ACTION_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  "project.created": BookOpen,
  "chapter.created": Layers,
  "chapter.renamed": PenLine,
  "chapter.reordered": Layers,
  "chapter.updated": PenLine,
  "chapter.deleted": PenLine,
  "note.created": StickyNote,
  "note.deleted": StickyNote,
  "asset.uploaded": ImageIcon,
  "comment.created": MessageSquare,
  "member.invited": UserPlus,
  "export.completed": Download,
};

function iconFor(action: string) {
  if (ACTION_ICON[action]) return ACTION_ICON[action];
  const prefix = action.split(".")[0];
  return ACTION_ICON[`${prefix}.created`] ?? PenLine;
}

export function ActivityFeed({
  activities,
  limit = 12,
}: {
  activities: Activity[];
  limit?: number;
}) {
  const rows = activities.slice(0, limit);

  if (rows.length === 0) {
    return (
      <p className="py-5 text-sm text-muted">
        Nothing has happened here yet. Edits, notes and joins will show up in this list.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {rows.map((activity) => {
        const accent = iconFor(activity.action);
        const Icon = accent;
        const name = activity.actor?.display_name || activity.actor?.email || "Someone";
        const summary = activity.summary || activity.action.replace(/[._]/g, " ");

        return (
          <li key={activity.id} className="flex items-start gap-2.5 py-2.5">
            <span className="relative mt-0.5 shrink-0">
              <Avatar name={name} src={activity.actor?.avatar_url ?? null} size={26} />
              <span className="absolute -bottom-1 -right-1 flex size-3.5 items-center justify-center rounded-full border border-border bg-ink-900 text-muted">
                <Icon className="size-2" />
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] leading-snug text-muted-strong">
                <span className="font-medium text-ink-100">{name}</span>{" "}
                <span>{summary}</span>
              </p>
              <p className="mt-0.5 text-[10.5px] uppercase tracking-[0.1em] text-muted/60">
                {relativeTime(activity.created_at)}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
