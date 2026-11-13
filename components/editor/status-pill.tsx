"use client";

import * as React from "react";
import { Circle, CircleDot, CircleCheck, CircleAlert, ChevronDown } from "lucide-react";
import { Badge, STATUS_LABEL, STATUS_TONE } from "@/components/ui/badge";
import { Dropdown, DropdownItem, DropdownLabel } from "@/components/ui/dropdown";
import { updateChapterStatusAction } from "@/lib/actions/chapters";
import type { ChapterStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { STATUS_ORDER } from "./types";

const STATUS_ICON: Record<ChapterStatus, React.ElementType> = {
  draft: Circle,
  in_progress: CircleDot,
  complete: CircleCheck,
  needs_review: CircleAlert,
};

/** Inline-editable chapter status. */
export function StatusPill({
  projectId,
  chapterId,
  status,
  canEdit,
  onChange,
  className,
}: {
  projectId: string;
  chapterId: string;
  status: ChapterStatus;
  canEdit: boolean;
  onChange: (status: ChapterStatus) => void;
  className?: string;
}) {
  const [pending, setPending] = React.useState(false);

  const pick = async (next: ChapterStatus) => {
    if (next === status || pending) return;
    const previous = status;
    onChange(next);
    setPending(true);
    const result = await updateChapterStatusAction(projectId, chapterId, next);
    setPending(false);
    if (!result.ok) onChange(previous);
  };

  const Icon = STATUS_ICON[status];

  return (
    <Dropdown
      align="start"
      trigger={
        <button
          type="button"
          disabled={!canEdit}
          className={cn(
            "inline-flex items-center gap-1 rounded-full transition disabled:cursor-default",
            canEdit && "hover:opacity-90",
            pending && "opacity-60",
            className,
          )}
          aria-label={`Chapter status: ${STATUS_LABEL[status] ?? status}`}
        >
          <Badge tone={STATUS_TONE[status] ?? "neutral"} className="gap-1 pr-1.5">
            <Icon className="size-3" />
            {STATUS_LABEL[status] ?? status}
            {canEdit && <ChevronDown className="size-3 opacity-60" />}
          </Badge>
        </button>
      }
    >
      {(close) => (
        <>
          <DropdownLabel>Chapter status</DropdownLabel>
          {STATUS_ORDER.map((option) => {
            const OptionIcon = STATUS_ICON[option];
            return (
              <DropdownItem
                key={option}
                icon={<OptionIcon />}
                className={option === status ? "text-foreground" : undefined}
                onClick={() => {
                  close();
                  void pick(option);
                }}
              >
                {STATUS_LABEL[option]}
              </DropdownItem>
            );
          })}
        </>
      )}
    </Dropdown>
  );
}
