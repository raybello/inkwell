"use client";

import * as React from "react";
import { History, MessageSquare } from "lucide-react";
import { Tabs } from "@/components/ui/misc";
import { CommentsPanel } from "@/components/comments/comments-panel";
import { cn } from "@/lib/utils";
import { VersionsPanel } from "./versions-panel";
import type { ChapterListItem, VersionItem } from "./types";

export type SidePanelTab = "versions" | "comments";

export function EditorSidePanel({
  projectId,
  chapter,
  canEdit,
  versions,
  versionsLoading,
  tab,
  onTabChange,
  onRefreshVersions,
  onRestored,
  flushPending,
  className,
}: {
  projectId: string;
  chapter: ChapterListItem;
  canEdit: boolean;
  versions: VersionItem[];
  versionsLoading: boolean;
  tab: SidePanelTab;
  onTabChange: (tab: SidePanelTab) => void;
  onRefreshVersions: () => void;
  onRestored: (content: unknown, wordCount: number) => void;
  flushPending?: () => Promise<unknown>;
  className?: string;
}) {
  return (
    <aside
      className={cn("flex min-h-0 flex-col border-l border-border bg-ink-900/40", className)}
      aria-label="Chapter panel"
    >
      <div className="flex h-11 shrink-0 items-center border-b border-border px-2">
        <Tabs
          value={tab}
          onChange={(value) => onTabChange(value as SidePanelTab)}
          className="w-full border-0 bg-transparent p-0"
          tabs={[
            { id: "versions", label: "Versions", icon: <History className="size-3.5" /> },
            { id: "comments", label: "Comments", icon: <MessageSquare className="size-3.5" /> },
          ]}
        />
      </div>

      <div className={cn("flex min-h-0 flex-1 flex-col", tab !== "versions" && "hidden")}>
        <VersionsPanel
          chapterId={chapter.id}
          canEdit={canEdit}
          versions={versions}
          loading={versionsLoading}
          onRefresh={onRefreshVersions}
          onRestored={onRestored}
          flushPending={flushPending}
          className="flex min-h-0 flex-1 flex-col"
        />
      </div>

      <div className={cn("min-h-0 flex-1 overflow-y-auto", tab !== "comments" && "hidden")}>
        {tab === "comments" && <CommentsPanel projectId={projectId} chapterId={chapter.id} />}
      </div>
    </aside>
  );
}
