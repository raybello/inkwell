import { cn } from "@/lib/utils";
import type { CanvasPreviewData } from "./canvas-preview";

/**
 * Abstract, generated preview of a canvas. Renders the persisted JSON preview when
 * available, otherwise a quiet placeholder — never a broken-image icon.
 */
export function CanvasThumb({
  preview,
  className,
  compact = false,
}: {
  preview: CanvasPreviewData | null;
  className?: string;
  compact?: boolean;
}) {
  const pad = 32;
  const vb = preview
    ? `${-pad} ${-pad} ${Math.max(1, preview.w) + pad * 2} ${Math.max(1, preview.h) + pad * 2}`
    : "0 0 320 200";

  return (
    <div
      className={cn(
        "relative overflow-hidden bg-ink-900",
        className,
      )}
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(217,203,187,0.16) 1px, transparent 0)",
          backgroundSize: compact ? "10px 10px" : "14px 14px",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 20% 0%, rgba(200,129,74,0.10), transparent 60%)",
        }}
      />
      <svg
        viewBox={vb}
        preserveAspectRatio="xMidYMid meet"
        className="absolute inset-0 size-full"
        aria-hidden
      >
        {(preview?.shapes ?? []).slice(0, 45).map((s, i) => {
          const textish = s.t === "text" || s.t === "note" || s.t === "geo";
          const isLine = s.t === "arrow" || s.t === "line" || s.t === "draw";
          if (isLine) {
            return (
              <line
                key={i}
                x1={s.x}
                y1={s.y}
                x2={s.x + s.w}
                y2={s.y + s.h}
                stroke={s.c}
                strokeOpacity={0.7}
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
              />
            );
          }
          return (
            <g key={i}>
              <rect
                x={s.x}
                y={s.y}
                width={Math.max(2, s.w)}
                height={Math.max(2, s.h)}
                rx={Math.min(8, Math.max(2, s.h * 0.08))}
                fill={s.c}
                fillOpacity={textish ? 0.22 : 0.1}
                stroke={s.c}
                strokeOpacity={textish ? 0.65 : 0.4}
                strokeWidth={1.25}
                vectorEffect="non-scaling-stroke"
              />
              {s.s && s.h > 34 && !compact
                ? Array.from({ length: Math.min(3, Math.max(1, Math.floor(s.h / 26))) }).map((_, line) => (
                    <rect
                      key={line}
                      x={s.x + Math.min(12, s.w * 0.1)}
                      y={s.y + Math.min(14, s.h * 0.15) + line * Math.min(22, s.h * 0.22)}
                      width={Math.max(6, s.w * (line === 2 ? 0.42 : 0.66))}
                      height={Math.max(2, Math.min(5, s.h * 0.045))}
                      rx={1}
                      fill={s.c}
                      fillOpacity={0.55}
                    />
                  ))
                : null}
            </g>
          );
        })}
      </svg>
      {!preview && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex items-end gap-1.5" aria-hidden>
              <span className="h-3 w-8 rounded-[3px] border border-border-strong/80 bg-ink-800" />
              <span className="h-6 w-10 rounded-[3px] border border-border-strong/80 bg-ink-800" />
              <span className="h-4 w-6 rounded-[3px] border border-accent/40 bg-accent/10" />
            </div>
            <span className="text-[10px] uppercase tracking-[0.16em] text-muted/80">Blank canvas</span>
          </div>
        </div>
      )}
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/[0.04]" />
    </div>
  );
}
