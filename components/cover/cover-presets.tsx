"use client";

import { COVER_PRESETS, fontStackFor } from "@/lib/cover";
import { cn } from "@/lib/utils";

export function CoverPresets({
  active,
  onApply,
  disabled,
}: {
  active: string;
  onApply: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-strong">Templates</h3>
        <span className="font-mono text-[10px] text-muted">{COVER_PRESETS.length}</span>
      </div>

      <div className="space-y-2">
        {COVER_PRESETS.map((preset) => {
          const isActive = active === preset.id;
          const { background, title, author } = preset.config;
          return (
            <button
              key={preset.id}
              type="button"
              disabled={disabled}
              onClick={() => onApply(preset.id)}
              aria-pressed={isActive}
              className={cn(
                "group block w-full overflow-hidden rounded-lg border text-left transition disabled:cursor-not-allowed disabled:opacity-60",
                isActive
                  ? "border-accent/70 ring-1 ring-accent/40"
                  : "border-border hover:border-border-strong hover:bg-card-hover",
              )}
            >
              <div
                className="relative flex h-[104px] items-center justify-center overflow-hidden"
                style={{ backgroundColor: background.color }}
              >
                <span
                  className="text-[19px] leading-tight"
                  style={{
                    fontFamily: fontStackFor(title.font),
                    color: title.color,
                    fontWeight: title.weight,
                    letterSpacing: title.tracking ? `${title.tracking * 0.12}px` : undefined,
                    textTransform: title.uppercase ? "uppercase" : undefined,
                  }}
                >
                  Aa
                </span>
                <span
                  className="absolute bottom-3 left-0 right-0 text-center text-[8px] uppercase tracking-[0.24em]"
                  style={{ fontFamily: fontStackFor(author.font), color: author.color }}
                >
                  Novel
                </span>
                {preset.config.ornaments.rule && (
                  <span
                    className="absolute left-1/2 top-1/2 h-px w-8 -translate-x-1/2"
                    style={{ backgroundColor: preset.config.ornaments.color, marginTop: 22 }}
                  />
                )}
              </div>
              <div className="px-2.5 py-2">
                <p className="text-[12px] text-foreground">{preset.name}</p>
                <p className="mt-0.5 text-[10.5px] leading-snug text-muted">{preset.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      <p className="pt-1 text-[10.5px] leading-relaxed text-muted">
        Templates restyle type, colour and layout. Your own words and background image are kept.
      </p>
    </div>
  );
}
