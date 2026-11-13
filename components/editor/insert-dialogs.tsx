"use client";

import * as React from "react";
import { ImageIcon, Link2, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { AssetOption } from "./types";

export interface ImageInsertPayload {
  src: string;
  alt: string;
}

export function ImageDialog({
  open,
  onOpenChange,
  assets,
  onInsert,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assets: AssetOption[];
  onInsert: (payload: ImageInsertPayload) => void;
}) {
  const [mode, setMode] = React.useState<"library" | "url">(assets.length ? "library" : "url");
  const [url, setUrl] = React.useState("");
  const [alt, setAlt] = React.useState("");
  const [selected, setSelected] = React.useState<AssetOption | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setMode(assets.length ? "library" : "url");
    setUrl("");
    setAlt("");
    setSelected(null);
  }, [open, assets.length]);

  const src = mode === "url" ? url.trim() : selected?.public_url ?? "";
  const resolvedAlt = alt.trim() || selected?.alt_text || selected?.filename?.replace(/\.[a-z0-9]+$/i, "") || "";

  const insert = () => {
    if (!src) return;
    onInsert({ src, alt: resolvedAlt });
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Insert image"
      description="Pick from the project library or paste an image URL."
      width="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!src} onClick={insert}>
            Insert image
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-1 rounded-lg border border-border bg-ink-900/60 p-0.5">
          {(
            [
              { id: "library", label: "Project assets", icon: ImageIcon },
              { id: "url", label: "From URL", icon: Link2 },
            ] as const
          ).map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setMode(option.id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] transition",
                mode === option.id ? "bg-ink-750 text-foreground" : "text-muted hover:text-muted-strong",
              )}
            >
              <option.icon className="size-3.5" />
              {option.label}
            </button>
          ))}
        </div>

        {mode === "library" ? (
          assets.length === 0 ? (
            <p className="rounded-md border border-dashed border-border-strong px-4 py-8 text-center text-sm text-muted">
              No assets in this project yet. Switch to “From URL” or upload files in the Assets section.
            </p>
          ) : (
            <div className="grid max-h-[280px] grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4">
              {assets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  onClick={() => setSelected(asset)}
                  className={cn(
                    "group relative aspect-square overflow-hidden rounded-md border bg-ink-850 transition",
                    selected?.id === asset.id
                      ? "border-accent ring-2 ring-accent/30"
                      : "border-border hover:border-border-strong",
                  )}
                  aria-label={`Use ${asset.filename}`}
                  aria-pressed={selected?.id === asset.id}
                >
                  {asset.public_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={asset.public_url} alt={asset.alt_text ?? asset.filename} className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-muted">
                      <ImageIcon className="size-5" />
                    </span>
                  )}
                  <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1.5 py-0.5 text-left text-[10px] text-white/90 opacity-0 transition group-hover:opacity-100">
                    {asset.filename}
                  </span>
                </button>
              ))}
            </div>
          )
        ) : (
          <label className="block space-y-1.5">
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-strong">Image URL</span>
            <Input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://…"
              autoFocus
              inputMode="url"
            />
          </label>
        )}

        <label className="block space-y-1.5">
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-strong">Alt text</span>
          <Input
            value={alt}
            onChange={(event) => setAlt(event.target.value)}
            placeholder="Describe the image for screen readers"
            maxLength={240}
          />
        </label>
      </div>
    </Dialog>
  );
}

export interface LinkPayload {
  href: string;
  text: string;
}

export function LinkDialog({
  open,
  onOpenChange,
  initialHref,
  initialText,
  hasSelection,
  onApply,
  onRemove,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialHref: string;
  initialText: string;
  hasSelection: boolean;
  onApply: (payload: LinkPayload) => void;
  onRemove: () => void;
}) {
  const [href, setHref] = React.useState(initialHref);
  const [text, setText] = React.useState(initialText);

  React.useEffect(() => {
    if (!open) return;
    setHref(initialHref);
    setText(initialText);
  }, [open, initialHref, initialText]);

  const normalised = React.useMemo(() => {
    const trimmed = href.trim();
    if (!trimmed) return "";
    if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) || trimmed.startsWith("/") || trimmed.startsWith("#")) return trimmed;
    return `https://${trimmed}`;
  }, [href]);

  const apply = () => {
    if (!normalised) return;
    onApply({ href: normalised, text: text.trim() });
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={initialHref ? "Edit link" : "Add link"}
      description={hasSelection ? "The selected text becomes the link." : "Add a link to new text."}
      footer={
        <>
          {initialHref && (
            <Button
              variant="ghost"
              className="mr-auto text-red-400 hover:text-red-300"
              onClick={() => {
                onRemove();
                onOpenChange(false);
              }}
            >
              <Unlink /> Remove
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!normalised} onClick={apply}>
            {initialHref ? "Update link" : "Add link"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="block space-y-1.5">
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-strong">URL</span>
          <Input
            value={href}
            onChange={(event) => setHref(event.target.value)}
            placeholder="https://example.com"
            autoFocus
            inputMode="url"
            onKeyDown={(event) => {
              if (event.key === "Enter") apply();
            }}
          />
        </label>
        {!hasSelection && (
          <label className="block space-y-1.5">
            <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-strong">Text</span>
            <Input
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Link text"
              maxLength={240}
            />
          </label>
        )}
      </div>
    </Dialog>
  );
}
