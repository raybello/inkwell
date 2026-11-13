"use client";

import * as React from "react";
import {
  COVER_BASE_HEIGHT,
  COVER_BASE_WIDTH,
  drawCover,
  ensureCoverFonts,
  type CoverConfig,
} from "@/lib/cover";

/** Live canvas preview. Renders at base resolution and scale down via CSS. */
export function CoverPreview({
  config,
  image,
  className,
}: {
  config: CoverConfig;
  image: HTMLImageElement | null;
  className?: string;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let cancelled = false;
    drawCover(ctx, config, image, COVER_BASE_WIDTH, COVER_BASE_HEIGHT);

    void ensureCoverFonts(config).then(() => {
      if (!cancelled) drawCover(ctx, config, image, COVER_BASE_WIDTH, COVER_BASE_HEIGHT);
    });

    return () => {
      cancelled = true;
    };
  }, [config, image]);

  return (
    <canvas
      ref={canvasRef}
      width={COVER_BASE_WIDTH}
      height={COVER_BASE_HEIGHT}
      role="img"
      aria-label="Cover preview"
      className={className}
    />
  );
}
