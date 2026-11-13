"use client";

import * as React from "react";
import { AlignCenter, AlignLeft, AlignRight, ChevronDown, ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/input";
import { Switch } from "@/components/ui/misc";
import { cn } from "@/lib/utils";
import {
  COVER_FONTS,
  type CoverAlign,
  type CoverBackground,
  type CoverConfig,
  type CoverTextBlock,
  type CoverTextKey,
} from "@/lib/cover";

const SWATCHES = [
  "#f1e9db",
  "#e2d5c3",
  "#1d2a26",
  "#233240",
  "#12100e",
  "#3a2b24",
  "#6d2f2a",
  "#2b2a45",
];

const WEIGHTS = [300, 400, 500, 600, 700, 800];

function normalizeHex(value: string): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(value.trim());
  if (match) return `#${match[1].toLowerCase()}`;
  const short = /^#?([0-9a-f]{3})$/i.exec(value.trim());
  if (short) return `#${short[1].split("").map((c) => c + c).join("").toLowerCase()}`;
  return "#000000";
}

function Panel({
  title,
  badge,
  children,
  defaultOpen = false,
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition hover:bg-card-hover"
      >
        <ChevronDown className={cn("size-3.5 text-muted transition-transform", !open && "-rotate-90")} />
        <span className="flex-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-strong">{title}</span>
        {badge && <span className="font-mono text-[10px] text-muted">{badge}</span>}
      </button>
      {open && <div className="space-y-3 border-t border-border px-3 py-3">{children}</div>}
    </section>
  );
}

function RangeField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] uppercase tracking-[0.12em] text-muted">{label}</span>
        <span className="font-mono text-[10.5px] text-muted-strong">{format ? format(value) : value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={label}
        className="mt-1.5 w-full cursor-pointer"
        style={{ accentColor: "#c8814a" }}
      />
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = React.useState(value);

  React.useEffect(() => setDraft(value), [value]);

  const commit = (next: string) => {
    setDraft(next);
    if (/^#?[0-9a-f]{6}$/i.test(next.trim()) || /^#?[0-9a-f]{3}$/i.test(next.trim())) {
      onChange(normalizeHex(next));
    }
  };

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] uppercase tracking-[0.12em] text-muted">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          value={normalizeHex(value)}
          onChange={(event) => onChange(event.target.value)}
          aria-label={`${label} colour`}
          className="size-7 cursor-pointer rounded border border-border-strong bg-transparent p-0.5"
        />
        <input
          value={draft}
          onChange={(event) => commit(event.target.value)}
          onBlur={() => {
            if (!/^#?[0-9a-f]{3,6}$/i.test(draft.trim())) setDraft(value);
          }}
          aria-label={`${label} hex value`}
          spellCheck={false}
          className="w-[78px] rounded border border-border-strong bg-ink-900/70 px-1.5 py-1 font-mono text-[11px] uppercase text-muted-strong outline-none transition focus:border-accent/70 focus:ring-1 focus:ring-accent/30"
        />
      </div>
    </div>
  );
}

function Toggle({
  active,
  onClick,
  children,
  label,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={cn(
        "rounded border px-2 py-1 text-[11px] transition",
        active
          ? "border-accent/60 bg-accent/15 text-accent"
          : "border-border text-muted hover:border-border-strong hover:text-muted-strong",
      )}
    >
      {children}
    </button>
  );
}

function TextBlockControls({
  label,
  block,
  onChange,
}: {
  label: string;
  block: CoverTextBlock;
  onChange: (patch: Partial<CoverTextBlock>) => void;
}) {
  const font = COVER_FONTS.find((item) => item.family === block.font) ?? COVER_FONTS[0];

  return (
    <div className="space-y-3">
      <textarea
        value={block.text}
        onChange={(event) => onChange({ text: event.target.value })}
        rows={2}
        maxLength={220}
        placeholder={label}
        aria-label={`${label} text`}
        className="w-full resize-none rounded-md border border-border-strong bg-ink-900/70 px-2.5 py-2 text-[12.5px] text-foreground outline-none transition placeholder:text-muted/60 focus:border-accent/70 focus:ring-1 focus:ring-accent/30"
      />

      <div>
        <Label htmlFor={`font-${label}`}>Typeface</Label>
        <select
          id={`font-${label}`}
          value={block.font}
          onChange={(event) => onChange({ font: event.target.value })}
          className="mt-1 h-8 w-full cursor-pointer rounded-md border border-border-strong bg-ink-850 px-2 text-[12px] text-foreground outline-none focus:border-accent/70"
        >
          {COVER_FONTS.map((item) => (
            <option key={item.family} value={item.family}>
              {item.label} — {item.category}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor={`weight-${label}`}>Weight</Label>
          <select
            id={`weight-${label}`}
            value={block.weight}
            onChange={(event) => onChange({ weight: Number(event.target.value) })}
            className="mt-1 h-8 w-full cursor-pointer rounded-md border border-border-strong bg-ink-850 px-2 text-[12px] text-foreground outline-none focus:border-accent/70"
          >
            {Array.from(new Set([...WEIGHTS, ...font.weights])).sort((a, b) => a - b).map((weight) => (
              <option key={weight} value={weight}>
                {weight}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor={`size-${label}`}>Size</Label>
          <input
            id={`size-${label}`}
            type="number"
            min={14}
            max={280}
            value={Math.round(block.size)}
            onChange={(event) => onChange({ size: Math.min(280, Math.max(14, Number(event.target.value) || 14)) })}
            className="mt-1 h-8 w-full rounded-md border border-border-strong bg-ink-900/70 px-2 font-mono text-[12px] text-foreground outline-none focus:border-accent/70"
          />
        </div>
      </div>

      <ColorField label="Colour" value={block.color} onChange={(color) => onChange({ color })} />
      <RangeField
        label="Letter spacing"
        value={block.tracking}
        min={-8}
        max={40}
        step={0.5}
        onChange={(tracking) => onChange({ tracking })}
        format={(value) => `${value}px`}
      />
      <RangeField
        label="Line height"
        value={block.lineHeight}
        min={0.85}
        max={1.7}
        step={0.01}
        onChange={(lineHeight) => onChange({ lineHeight })}
        format={(value) => value.toFixed(2)}
      />

      <div>
        <span className="text-[10px] uppercase tracking-[0.12em] text-muted">Alignment</span>
        <div className="mt-1 flex items-center gap-1">
          {(
            [
              { id: "left", icon: AlignLeft, label: "Align left" },
              { id: "center", icon: AlignCenter, label: "Align centre" },
              { id: "right", icon: AlignRight, label: "Align right" },
            ] as const
          ).map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange({ align: option.id as CoverAlign })}
              aria-label={option.label}
              aria-pressed={block.align === option.id}
              className={cn(
                "flex h-7 flex-1 items-center justify-center rounded border transition",
                block.align === option.id
                  ? "border-accent/60 bg-accent/15 text-accent"
                  : "border-border text-muted hover:border-border-strong hover:text-muted-strong",
              )}
            >
              <option.icon className="size-3.5" />
            </button>
          ))}
        </div>
      </div>

      <RangeField
        label="Vertical position"
        value={block.y}
        min={0}
        max={0.95}
        step={0.005}
        onChange={(y) => onChange({ y })}
        format={(value) => `${Math.round(value * 100)}%`}
      />
      <RangeField
        label="Text width"
        value={block.width}
        min={0.3}
        max={1}
        step={0.01}
        onChange={(width) => onChange({ width })}
        format={(value) => `${Math.round(value * 100)}%`}
      />

      <div className="flex items-center gap-1.5">
        <Toggle active={block.uppercase} onClick={() => onChange({ uppercase: !block.uppercase })} label="Uppercase">
          AA
        </Toggle>
        <Toggle active={block.italic} onClick={() => onChange({ italic: !block.italic })} label="Italic">
          <span className="italic">Aa</span>
        </Toggle>
        <Toggle active={block.visible} onClick={() => onChange({ visible: !block.visible })} label="Show this text">
          {block.visible ? "Shown" : "Hidden"}
        </Toggle>
      </div>
    </div>
  );
}

export function CoverControls({
  config,
  onChange,
  onChooseImage,
}: {
  config: CoverConfig;
  onChange: (next: CoverConfig) => void;
  onChooseImage: () => void;
}) {
  const patchBackground = (patch: Partial<CoverBackground>) =>
    onChange({ ...config, background: { ...config.background, ...patch } });

  const patchBlock = (key: CoverTextKey, patch: Partial<CoverTextBlock>) =>
    onChange({ ...config, [key]: { ...config[key], ...patch } } as CoverConfig);

  return (
    <div className="space-y-2">
      <Panel title="Base" badge={config.background.kind === "image" ? "Image" : "Colour"} defaultOpen>
        <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
          {(
            [
              { id: "color", label: "Colour" },
              { id: "image", label: "Image" },
            ] as const
          ).map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => patchBackground({ kind: option.id })}
              aria-pressed={config.background.kind === option.id}
              className={cn(
                "flex-1 rounded px-2 py-1.5 text-[11.5px] transition",
                config.background.kind === option.id
                  ? "bg-ink-750 text-foreground"
                  : "text-muted hover:text-muted-strong",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        {config.background.kind === "image" ? (
          <div className="space-y-2">
            <div className="relative overflow-hidden rounded-md border border-border bg-ink-850">
              {config.background.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={config.background.url} alt="" className="aspect-[2/3] w-full object-cover" />
              ) : (
                <div className="flex aspect-[2/3] flex-col items-center justify-center gap-2 text-muted">
                  <ImagePlus className="size-5" />
                  <span className="text-[11px]">No image selected</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" className="flex-1" onClick={onChooseImage}>
                <ImagePlus /> Choose
              </Button>
              {config.background.url && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove background image"
                  onClick={() => patchBackground({ kind: "color", url: null, assetId: null })}
                >
                  <Trash2 />
                </Button>
              )}
            </div>
            <RangeField
              label="Scrim"
              value={config.background.overlay}
              min={0}
              max={0.9}
              step={0.01}
              onChange={(overlay) => patchBackground({ overlay })}
              format={(value) => `${Math.round(value * 100)}%`}
            />
            <RangeField
              label="Crop focus"
              value={config.background.focus}
              min={0}
              max={1}
              step={0.01}
              onChange={(focus) => patchBackground({ focus })}
              format={(value) => `${Math.round(value * 100)}%`}
            />
            <ColorField
              label="Fallback"
              value={config.background.color}
              onChange={(color) => patchBackground({ color })}
            />
          </div>
        ) : (
          <div className="space-y-2">
            <ColorField
              label="Background"
              value={config.background.color}
              onChange={(color) => patchBackground({ color })}
            />
            <div className="grid grid-cols-8 gap-1">
              {SWATCHES.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  onClick={() => patchBackground({ color: swatch })}
                  aria-label={`Background ${swatch}`}
                  className={cn(
                    "h-6 rounded border transition hover:scale-105",
                    config.background.color.toLowerCase() === swatch ? "border-accent" : "border-border",
                  )}
                  style={{ backgroundColor: swatch }}
                />
              ))}
            </div>
            <RangeField
              label="Scrim"
              value={config.background.overlay}
              min={0}
              max={0.9}
              step={0.01}
              onChange={(overlay) => patchBackground({ overlay })}
              format={(value) => `${Math.round(value * 100)}%`}
            />
          </div>
        )}
      </Panel>

      <Panel title="Title" badge={config.title.visible ? undefined : "hidden"} defaultOpen>
        <TextBlockControls label="Title" block={config.title} onChange={(patch) => patchBlock("title", patch)} />
      </Panel>

      <Panel title="Subtitle" badge={config.subtitle.visible ? undefined : "hidden"}>
        <TextBlockControls
          label="Subtitle"
          block={config.subtitle}
          onChange={(patch) => patchBlock("subtitle", patch)}
        />
      </Panel>

      <Panel title="Author" badge={config.author.visible ? undefined : "hidden"}>
        <TextBlockControls label="Author" block={config.author} onChange={(patch) => patchBlock("author", patch)} />
      </Panel>

      <Panel title="Ornaments">
        <div className="space-y-3">
          <Switch
            checked={config.ornaments.rule}
            onChange={(rule) => onChange({ ...config, ornaments: { ...config.ornaments, rule } })}
            label="Divider rule above title"
          />
          <Switch
            checked={config.ornaments.frame}
            onChange={(frame) => onChange({ ...config, ornaments: { ...config.ornaments, frame } })}
            label="Inset frame"
          />
          <ColorField
            label="Ornament colour"
            value={config.ornaments.color}
            onChange={(color) => onChange({ ...config, ornaments: { ...config.ornaments, color } })}
          />
          <RangeField
            label="Thickness"
            value={config.ornaments.thickness}
            min={1}
            max={10}
            step={1}
            onChange={(thickness) => onChange({ ...config, ornaments: { ...config.ornaments, thickness } })}
            format={(value) => `${value}px`}
          />
        </div>
      </Panel>
    </div>
  );
}
