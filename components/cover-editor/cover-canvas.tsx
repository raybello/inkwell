"use client";

import * as React from "react";
import {
  COVER_HEIGHT,
  COVER_WIDTH,
  drawCoverSide,
  ensureCoverFonts,
  fontStack,
  preloadSideImages,
  wrapText,
  type CoverLayer,
  type CoverSideDoc,
  type TextLayer,
} from "@/lib/cover-art";
import { cn } from "@/lib/utils";

interface Rect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Canvas cover preview/editor. Drawing and hit-testing share the same renderer
 * as the PNG export, so the pointer never lies about where a layer sits.
 */
export function CoverCanvas({
  sideDoc,
  selectedId,
  onSelect,
  onMove,
  onCommit,
  onRequestEdit,
  readOnly,
  className,
  zoom = 1,
}: {
  sideDoc: CoverSideDoc;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onMove: (id: string, x: number, y: number) => void;
  onCommit: () => void;
  onRequestEdit?: (id: string) => void;
  readOnly?: boolean;
  className?: string;
  zoom?: number;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const rectsRef = React.useRef<Rect[]>([]);
  const dragRef = React.useRef<{ id: string; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const [displayWidth, setDisplayWidth] = React.useState(560);
  const [ready, setReady] = React.useState(false);
  const [paintError, setPaintError] = React.useState<string | null>(null);

  // Responsive canvas width, capped by the available height so a 2:3 book fits.
  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const box = el.getBoundingClientRect();
      const heightLimit = Math.max(320, window.innerHeight - 250);
      const byHeight = (heightLimit / COVER_HEIGHT) * COVER_WIDTH;
      setDisplayWidth(Math.max(260, Math.min(box.width - 8, byHeight * zoom)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [zoom]);

  const paint = React.useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scale = displayWidth / COVER_WIDTH;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(COVER_WIDTH * scale * dpr);
    canvas.height = Math.round(COVER_HEIGHT * scale * dpr);
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${Math.round(displayWidth * (COVER_HEIGHT / COVER_WIDTH))}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    try {
      await ensureCoverFonts({ version: 1, front: sideDoc, back: sideDoc });
      await preloadSideImages(sideDoc);
    } catch {
      // A blocked font or image CDN must not stop the cover from drawing.
    }

    const s = scale * dpr;
    try {
      await drawCoverSide(ctx, sideDoc, { scale: s });
      setPaintError(null);
    } catch (error) {
      setPaintError(error instanceof Error ? error.message : "The cover could not be drawn.");
    }

    // Measurement pass for text blocks (used by hit-testing and outlines).
    const rects: Rect[] = [];
    for (const layer of sideDoc.layers) {
      let height = layer.type === "text" ? 0.04 : layer.height;
      if (layer.type === "text") {
        ctx.font = `${layer.italic ? "italic " : ""}${layer.weight} ${layer.size * s}px ${fontStack(layer.font)}`;
        (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = `${layer.letterSpacing * s}px`;
        const { height: textHeight } = wrapText(ctx, layer as TextLayer, layer.width * COVER_WIDTH * s, s);
        height = textHeight / (COVER_HEIGHT * s);
      }
      rects.push({ id: layer.id, x: layer.x, y: layer.y, width: layer.width, height: Math.max(0.003, height) });
    }
    rectsRef.current = rects;

    const selected = sideDoc.layers.find((l) => l.id === selectedId);
    if (selected) {
      const rect = rects.find((r) => r.id === selected.id);
      if (rect) {
        const x = rect.x * COVER_WIDTH * s;
        const y = rect.y * COVER_HEIGHT * s;
        const w = rect.width * COVER_WIDTH * s;
        const h = rect.height * COVER_HEIGHT * s;
        ctx.save();
        ctx.strokeStyle = "#c8814a";
        ctx.lineWidth = 2 * dpr;
        ctx.setLineDash([6 * dpr, 4 * dpr]);
        ctx.strokeRect(x - 2 * dpr, y - 2 * dpr, w + 4 * dpr, h + 4 * dpr);
        ctx.setLineDash([]);
        ctx.fillStyle = "#c8814a";
        for (const [hx, hy] of [
          [x, y],
          [x + w, y],
          [x, y + h],
          [x + w, y + h],
        ]) {
          ctx.fillRect(hx - 3.5 * dpr, hy - 3.5 * dpr, 7 * dpr, 7 * dpr);
        }
        ctx.restore();
      }
    }
    setReady(true);
  }, [sideDoc, selectedId, displayWidth]);

  React.useEffect(() => {
    setReady(false);
    void paint();
  }, [paint]);

  const toNormalised = React.useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: (event.clientX - rect.left) / rect.width,
        y: (event.clientY - rect.top) / rect.height,
      };
    },
    [],
  );

  const hit = React.useCallback((x: number, y: number): CoverLayer | null => {
    for (let i = sideDoc.layers.length - 1; i >= 0; i -= 1) {
      const layer = sideDoc.layers[i];
      const rect = rectsRef.current.find((r) => r.id === layer.id);
      if (!rect) continue;
      if (x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height) {
        return layer;
      }
    }
    return null;
  }, [sideDoc.layers]);

  return (
    <div ref={wrapRef} className={cn("flex w-full flex-col items-center", className)}>
      <div className="relative">
        <canvas
          ref={canvasRef}
          className={cn(
            "touch-none rounded-[3px] shadow-[0_30px_70px_-30px_rgba(0,0,0,0.95)] ring-1 ring-black/30",
            readOnly ? "cursor-default" : "cursor-move",
          )}
          aria-label="Cover preview"
          onPointerDown={(event) => {
            if (readOnly) return;
            const { x, y } = toNormalised(event);
            const layer = hit(x, y);
            onSelect(layer?.id ?? null);
            if (!layer) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            dragRef.current = {
              id: layer.id,
              startX: x,
              startY: y,
              originX: layer.x,
              originY: layer.y,
            };
          }}
          onPointerMove={(event) => {
            const drag = dragRef.current;
            if (!drag || readOnly) return;
            const { x, y } = toNormalised(event);
            const layer = sideDoc.layers.find((l) => l.id === drag.id);
            if (!layer) return;
            const nextX = Math.min(1 - Math.min(layer.width, 0.98), Math.max(0, drag.originX + (x - drag.startX)));
            const nextY = Math.min(0.98, Math.max(0, drag.originY + (y - drag.startY)));
            onMove(drag.id, Number(nextX.toFixed(4)), Number(nextY.toFixed(4)));
          }}
          onPointerUp={() => {
            if (!dragRef.current) return;
            dragRef.current = null;
            onCommit();
          }}
          onPointerCancel={() => {
            dragRef.current = null;
          }}
          onDoubleClick={(event) => {
            if (readOnly || !onRequestEdit) return;
            const { x, y } = toNormalised(event as unknown as React.PointerEvent<HTMLCanvasElement>);
            const layer = hit(x, y);
            if (layer) onRequestEdit(layer.id);
          }}
        />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center rounded-[3px] bg-ink-900/70">
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted">Rendering</span>
          </div>
        )}
        {paintError && (
          <div className="absolute inset-x-2 bottom-2 rounded border border-red-900/60 bg-red-950/80 px-2 py-1 text-[10px] text-red-200">
            {paintError}
          </div>
        )}
      </div>
    </div>
  );
}
