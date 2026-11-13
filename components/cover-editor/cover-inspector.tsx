"use client";

import * as React from "react";
import { AlignCenter, AlignLeft, AlignRight, Image as ImageIcon, Trash2, Type } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Switch, Tooltip } from "@/components/ui/misc";
import { COVER_FONT_OPTIONS, type CoverLayer, type CoverSideDoc } from "@/lib/cover-art";
import { cn } from "@/lib/utils";

const SWATCHES = [
  "#f4ead7",
  "#e9dfcd",
  "#c9b795",
  "#c8814a",
  "#9c5f31",
  "#7d9a7e",
  "#8b6b8f",
  "#ffffff",
  "#1b1611",
  "#000000",
];

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] uppercase tracking-[0.14em] text-muted">{label}</p>
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-7 w-9 cursor-pointer rounded border border-border-strong bg-transparent p-0.5"
          aria-label={`${label} colour`}
        />
        <Input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-7 flex-1 font-mono text-[11px]"
        />
      </div>
      <div className="flex flex-wrap gap-1">
        {SWATCHES.map((swatch) => (
          <button
            key={swatch}
            type="button"
            onClick={() => onChange(swatch)}
            className="size-4 rounded-sm border border-black/30"
            style={{ backgroundColor: swatch }}
            aria-label={`Use ${swatch}`}
          />
        ))}
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.14em] text-muted">{label}</p>
        <span className="font-mono text-[10px] text-muted-strong">
          {Number.isInteger(value) ? value : value.toFixed(2)}
          {suffix ?? ""}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1 w-full cursor-pointer appearance-none rounded-full bg-ink-700 accent-[var(--accent)]"
        aria-label={label}
      />
    </div>
  );
}

/**
 * Property panel for the selected layer (or the page background when nothing
 * is selected).
 */
export function CoverInspector({
  sideDoc,
  selected,
  onPatchLayer,
  onPatchBackground,
  onDelete,
  onDuplicate,
  onMoveLayerOrder,
  onUseBackground,
  className,
}: {
  sideDoc: CoverSideDoc;
  selected: CoverLayer | null;
  onPatchLayer: (patch: Partial<CoverLayer>) => void;
  onPatchBackground: (patch: Partial<CoverSideDoc["background"]>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveLayerOrder: (direction: "up" | "down") => void;
  onUseBackground: (url: string | null) => void;
  className?: string;
}) {
  return (
    <aside className={cn("flex min-h-0 flex-col border-l border-border bg-ink-900/60", className)}>
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border px-3">
        <p className="text-[10px] uppercase tracking-[0.16em] text-muted">
          {selected ? "Layer" : "Background"}
        </p>
        {selected && (
          <div className="flex items-center gap-1">
            <Badge tone="neutral">
              {selected.type === "text" ? "Text" : selected.type === "image" ? "Image" : "Shape"}
            </Badge>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-3">
        {!selected ? (
          <>
            <p className="text-[11px] leading-relaxed text-muted">
              Select a layer to edit it. Background controls below apply to the whole page.
            </p>
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted">Fill</p>
              <div className="flex gap-1">
                {(["color", "image"] as const).map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => onPatchBackground({ kind })}
                    className={cn(
                      "flex-1 rounded-md border px-2 py-1 text-[11px] capitalize transition",
                      sideDoc.background.kind === kind
                        ? "border-accent/60 bg-accent/10 text-accent-soft"
                        : "border-border text-muted hover:text-muted-strong",
                    )}
                  >
                    {kind}
                  </button>
                ))}
              </div>
            </div>
            <ColorField
              label="Base colour"
              value={sideDoc.background.color}
              onChange={(color) => onPatchBackground({ color })}
            />
            {sideDoc.background.kind === "image" && (
              <>
                {sideDoc.background.imageUrl ? (
                  <div className="space-y-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={sideDoc.background.imageUrl}
                      alt=""
                      className="h-24 w-full rounded border border-border object-cover"
                    />
                    <Button variant="ghost" size="sm" onClick={() => onPatchBackground({ imageUrl: null })}>
                      Remove background image
                    </Button>
                  </div>
                ) : (
                  <p className="rounded-md border border-dashed border-border-strong px-2 py-3 text-center text-[11px] text-muted">
                    Pick an image from the asset tray to use as the background.
                  </p>
                )}
                <Slider
                  label="Scrim"
                  value={Math.round(sideDoc.background.scrim * 100)}
                  min={0}
                  max={100}
                  suffix="%"
                  onChange={(value) => onPatchBackground({ scrim: value / 100 })}
                />
                <ColorField
                  label="Scrim colour"
                  value={sideDoc.background.scrimColor}
                  onChange={(scrimColor) => onPatchBackground({ scrimColor })}
                />
              </>
            )}
          </>
        ) : selected.type === "text" ? (
          <>
            <Field label="Text">
              <Textarea
                value={selected.text}
                onChange={(event) => onPatchLayer({ text: event.target.value } as Partial<CoverLayer>)}
                rows={3}
                className="text-[13px]"
              />
            </Field>
            <Field label="Typeface">
              <Select
                value={selected.font}
                onChange={(event) =>
                  onPatchLayer({ font: event.target.value } as unknown as Partial<CoverLayer>)
                }
                className="h-8 text-[12px]"
              >
                {COVER_FONT_OPTIONS.map((font) => (
                  <option key={font.id} value={font.id}>
                    {font.label}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Size">
                <Input
                  type="number"
                  value={selected.size}
                  onChange={(event) => onPatchLayer({ size: Number(event.target.value) } as Partial<CoverLayer>)}
                  className="h-8 text-[12px]"
                />
              </Field>
              <Field label="Weight">
                <Select
                  value={String(selected.weight)}
                  onChange={(event) => onPatchLayer({ weight: Number(event.target.value) } as Partial<CoverLayer>)}
                  className="h-8 text-[12px]"
                >
                  {[300, 400, 500, 600, 700, 800].map((weight) => (
                    <option key={weight} value={weight}>
                      {weight}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="flex items-center gap-1">
              {(
                [
                  ["left", AlignLeft],
                  ["center", AlignCenter],
                  ["right", AlignRight],
                ] as const
              ).map(([align, Icon]) => (
                <Tooltip key={align} label={align}>
                  <button
                    type="button"
                    onClick={() => onPatchLayer({ align } as Partial<CoverLayer>)}
                    className={cn(
                      "flex size-7 items-center justify-center rounded border text-muted transition",
                      selected.align === align
                        ? "border-accent/60 bg-accent/10 text-accent-soft"
                        : "border-border hover:text-foreground",
                    )}
                    aria-label={align}
                  >
                    <Icon className="size-3.5" />
                  </button>
                </Tooltip>
              ))}
              <button
                type="button"
                onClick={() => onPatchLayer({ italic: !selected.italic } as Partial<CoverLayer>)}
                className={cn(
                  "ml-1 flex size-7 items-center justify-center rounded border font-serif italic transition",
                  selected.italic ? "border-accent/60 bg-accent/10 text-accent-soft" : "border-border text-muted",
                )}
                aria-label="Italic"
              >
                I
              </button>
              <button
                type="button"
                onClick={() => onPatchLayer({ uppercase: !selected.uppercase } as Partial<CoverLayer>)}
                className={cn(
                  "flex size-7 items-center justify-center rounded border text-[10px] font-semibold transition",
                  selected.uppercase ? "border-accent/60 bg-accent/10 text-accent-soft" : "border-border text-muted",
                )}
                aria-label="Uppercase"
              >
                AA
              </button>
            </div>
            <Slider
              label="Line height"
              value={selected.lineHeight}
              min={0.8}
              max={2.4}
              step={0.05}
              onChange={(lineHeight) => onPatchLayer({ lineHeight } as Partial<CoverLayer>)}
            />
            <Slider
              label="Letter spacing"
              value={selected.letterSpacing}
              min={-4}
              max={24}
              step={1}
              onChange={(letterSpacing) => onPatchLayer({ letterSpacing } as Partial<CoverLayer>)}
            />
            <ColorField
              label="Colour"
              value={selected.color}
              onChange={(color) => onPatchLayer({ color } as Partial<CoverLayer>)}
            />
          </>
        ) : selected.type === "image" ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selected.url}
              alt=""
              className="max-h-28 w-full rounded border border-border object-cover"
            />
            <div className="grid grid-cols-2 gap-2">
              <Field label="Fit">
                <Select
                  value={selected.fit}
                  onChange={(event) => onPatchLayer({ fit: event.target.value } as Partial<CoverLayer>)}
                  className="h-8 text-[12px]"
                >
                  <option value="cover">Cover</option>
                  <option value="contain">Contain</option>
                </Select>
              </Field>
              <Field label="Corner">
                <Input
                  type="number"
                  value={selected.radius}
                  onChange={(event) => onPatchLayer({ radius: Number(event.target.value) } as Partial<CoverLayer>)}
                  className="h-8 text-[12px]"
                />
              </Field>
            </div>
            <Button variant="secondary" size="sm" onClick={() => onUseBackground(selected.url)}>
              <ImageIcon /> Use as page background
            </Button>
          </>
        ) : (
          <>
            <Field label="Shape">
              <Select
                value={selected.shape}
                onChange={(event) => onPatchLayer({ shape: event.target.value } as Partial<CoverLayer>)}
                className="h-8 text-[12px]"
              >
                <option value="rect">Rectangle</option>
                <option value="line">Rule / line</option>
              </Select>
            </Field>
            <ColorField
              label="Colour"
              value={selected.color}
              onChange={(color) => onPatchLayer({ color } as Partial<CoverLayer>)}
            />
            <Slider
              label="Thickness"
              value={selected.borderWidth}
              min={0}
              max={24}
              onChange={(borderWidth) => onPatchLayer({ borderWidth } as Partial<CoverLayer>)}
            />
            {selected.shape === "rect" && (
              <Slider
                label="Corner radius"
                value={selected.radius}
                min={0}
                max={120}
                onChange={(radius) => onPatchLayer({ radius } as Partial<CoverLayer>)}
              />
            )}
            <Switch
              checked={selected.filled}
              onChange={(filled) => onPatchLayer({ filled } as Partial<CoverLayer>)}
              label="Tint fill"
            />
          </>
        )}

        {selected && (
          <>
            <div className="h-px bg-border" />
            <Slider
              label="Width"
              value={Math.round(selected.width * 100)}
              min={5}
              max={100}
              suffix="%"
              onChange={(value) => onPatchLayer({ width: value / 100 } as Partial<CoverLayer>)}
            />
            <Slider
              label="Opacity"
              value={Math.round(selected.opacity * 100)}
              min={10}
              max={100}
              suffix="%"
              onChange={(value) => onPatchLayer({ opacity: value / 100 } as Partial<CoverLayer>)}
            />
            <div className="grid grid-cols-2 gap-1">
              <Button variant="ghost" size="sm" onClick={() => onMoveLayerOrder("up")}>
                Forward
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onMoveLayerOrder("down")}>
                Backward
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <Button variant="ghost" size="sm" onClick={onDuplicate}>
                <Type /> Duplicate
              </Button>
              <Button variant="ghost" size="sm" className="text-red-400" onClick={onDelete}>
                <Trash2 /> Delete
              </Button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
