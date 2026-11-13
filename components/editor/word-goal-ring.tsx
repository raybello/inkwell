"use client";

import * as React from "react";
import { cn, formatNumber } from "@/lib/utils";

/** Compact daily-goal ring for the editor header. */
export function WordGoalRing({
  words,
  goal,
  className,
}: {
  words: number;
  goal: number;
  className?: string;
}) {
  const safeGoal = goal > 0 ? goal : 500;
  const ratio = Math.max(0, Math.min(1, words / safeGoal));
  const size = 30;
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const done = words >= safeGoal;
  const percent = Math.round(ratio * 100);

  return (
    <div
      className={cn("flex items-center gap-2", className)}
      title={`${formatNumber(words)} of ${formatNumber(safeGoal)} words today`}
    >
      <span className="relative inline-flex" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-ink-700" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - ratio)}
            className={done ? "text-sage transition-[stroke-dashoffset]" : "text-accent transition-[stroke-dashoffset]"}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center font-mono text-[8px] text-muted-strong">
          {percent}
        </span>
      </span>
      <span className="hidden flex-col leading-tight lg:flex">
        <span className="font-mono text-[11px] text-muted-strong">
          {formatNumber(words)}
          <span className="text-muted">/{formatNumber(safeGoal)}</span>
        </span>
        <span className="text-[9px] uppercase tracking-[0.14em] text-muted">today</span>
      </span>
      <span className="sr-only" role="status">
        Daily goal: {formatNumber(words)} of {formatNumber(safeGoal)} words.
      </span>
    </div>
  );
}
