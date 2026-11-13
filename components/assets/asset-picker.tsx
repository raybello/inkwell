"use client";

import * as React from "react";
import { Image as ImageIcon, Link2, Loader2, Search, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton, Tabs } from "@/components/ui/misc";
import { UnsplashPicker } from "@/components/integrations/unsplash-picker";
import { cn } from "@/lib/utils";
import type { Asset } from "@/lib/types";
import {
  MAX_UPLOAD_BYTES,
  formatBytes,
  isImageAsset,
  readImageDimensions,
  uploadAssetFile,
} from "@/components/assets/asset-utils";

export interface PickedAsset {
  url: string;
  alt: string;
  width?: number;
  height?: number;
}

const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/svg+xml";

type TabId = "library" | "upload" | "unsplash";

export function AssetPicker({
  projectId,
  open,
  onOpenChange,
  onSelect,
  allowUrl = false,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (asset: PickedAsset) => void;
  allowUrl?: boolean;
}) {
  const [tab, setTab] = React.useState<TabId>("library");
  const [assets, setAssets] = React.useState<Asset[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [reloadKey, setReloadKey] = React.useState(0);
  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [urlDraft, setUrlDraft] = React.useState("");
  const [urlBusy, setUrlBusy] = React.useState(false);
  const [dragActive, setDragActive] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    fetch(`/api/assets?projectId=${encodeURIComponent(projectId)}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as { assets?: Asset[]; error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Could not load assets.");
        return payload.assets ?? [];
      })
      .then((list) => {
        if (alive) setAssets(list);
      })
      .catch((error: unknown) => {
        if (alive) toast.error(error instanceof Error ? error.message : "Could not load assets.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, projectId, reloadKey]);

  React.useEffect(() => {
    if (open) {
      setTab("library");
      setQuery("");
      setUrlDraft("");
    }
  }, [open]);

  const images = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return assets
      .filter(isImageAsset)
      .filter(
        (asset) =>
          !needle ||
          asset.filename.toLowerCase().includes(needle) ||
          (asset.alt_text ?? "").toLowerCase().includes(needle) ||
          (asset.tags ?? []).some((tag) => tag.includes(needle)),
      );
  }, [assets, query]);

  const choose = (asset: Asset) => {
    if (!asset.public_url) {
      toast.error("That asset has no public URL.");
      return;
    }
    onSelect({
      url: asset.public_url,
      alt: asset.alt_text?.trim() || asset.filename.replace(/\.[^.]+$/, ""),
      width: asset.width ?? undefined,
      height: asset.height ?? undefined,
    });
    onOpenChange(false);
  };

  const upload = async (file: File) => {
    if (!isImageAsset({ mime_type: file.type, filename: file.name })) {
      toast.error("Choose an image file.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(`That image is ${formatBytes(file.size)} — the limit is 25 MB.`);
      return;
    }
    setUploading(true);
    setProgress(0);
    try {
      const dims = await readImageDimensions(file);
      const asset = await uploadAssetFile(projectId, file, {
        width: dims?.width ?? null,
        height: dims?.height ?? null,
        onProgress: setProgress,
      });
      setAssets((prev) => [asset, ...prev]);
      toast.success(`${asset.filename} uploaded`);
      setReloadKey((key) => key + 1);
      choose(asset);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const importUrl = async () => {
    const url = urlDraft.trim();
    if (!url) return;
    setUrlBusy(true);
    try {
      const response = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, url }),
      });
      const payload = (await response.json()) as { asset?: Asset; error?: string };
      if (!response.ok || !payload.asset) throw new Error(payload.error ?? "Import failed.");
      setAssets((prev) => [payload.asset as Asset, ...prev]);
      toast.success("Image imported");
      choose(payload.asset);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setUrlBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Choose an image"
      description="Insert from this project's library, upload a new file, or search stock photography."
      width="max-w-2xl"
      footer={
        <>
          <span className="mr-auto hidden font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted sm:inline">
            {images.length} images
          </span>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Tabs
          tabs={[
            { id: "library", label: "Library", icon: <ImageIcon className="size-3.5" /> },
            { id: "upload", label: "Upload", icon: <UploadCloud className="size-3.5" /> },
            { id: "unsplash", label: "Unsplash", icon: <Search className="size-3.5" /> },
          ]}
          value={tab}
          onChange={(id) => setTab(id as TabId)}
        />

        {tab === "library" && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search this project's images…"
                className="pl-8 text-[13px]"
                aria-label="Search assets"
              />
            </div>

            {allowUrl && (
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Link2 className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
                  <Input
                    value={urlDraft}
                    onChange={(event) => setUrlDraft(event.target.value)}
                    placeholder="…or paste an image URL"
                    className="pl-8 text-[13px]"
                    inputMode="url"
                    aria-label="Image URL"
                  />
                </div>
                <Button variant="outline" size="sm" loading={urlBusy} onClick={() => void importUrl()} disabled={!urlDraft.trim()}>
                  Import
                </Button>
              </div>
            )}

            {loading ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {Array.from({ length: 8 }).map((_, index) => (
                  <Skeleton key={index} className="aspect-[4/3]" />
                ))}
              </div>
            ) : images.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border-strong px-4 py-10 text-center">
                <p className="font-serif text-base">
                  {assets.length ? "No images match that search." : "No images in this project yet."}
                </p>
                <p className="mt-1 text-xs text-muted">Upload one to get started.</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => setTab("upload")}>
                  <UploadCloud /> Upload an image
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {images.map((asset) => (
                  <button
                    key={asset.id}
                    type="button"
                    onClick={() => choose(asset)}
                    className="group relative overflow-hidden rounded-md border border-border bg-ink-850 text-left transition hover:border-accent/70 focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:outline-none"
                  >
                    <div className="aspect-[4/3] w-full overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={asset.public_url ?? ""}
                        alt={asset.alt_text ?? asset.filename}
                        loading="lazy"
                        className="size-full object-cover transition duration-300 group-hover:scale-[1.03]"
                      />
                    </div>
                    <span className="block truncate px-1.5 py-1 text-[10.5px] text-muted group-hover:text-muted-strong">
                      {asset.filename}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === "upload" && (
          <div>
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragActive(false);
                const file = event.dataTransfer.files?.[0];
                if (file) void upload(file);
              }}
              className={cn(
                "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-14 text-center transition",
                dragActive ? "border-accent/70 bg-accent/5" : "border-border-strong bg-ink-900/40",
              )}
            >
              <div className="flex size-11 items-center justify-center rounded-full border border-border-strong bg-ink-850 text-muted">
                {uploading ? <Loader2 className="size-5 animate-spin" /> : <UploadCloud className="size-5" />}
              </div>
              <p className="font-serif text-lg">Drop an image here</p>
              <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted">
                JPEG · PNG · WebP · GIF · SVG — 25 MB max
              </p>
              <Button variant="secondary" size="sm" className="mt-2" disabled={uploading} onClick={() => inputRef.current?.click()}>
                Choose a file
              </Button>
              {uploading && (
                <p className="font-mono text-[11px] text-accent">Uploading… {progress}%</p>
              )}
            </div>
            <input
              ref={inputRef}
              type="file"
              accept={IMAGE_ACCEPT}
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void upload(file);
              }}
            />
          </div>
        )}

        {tab === "unsplash" && (
          <UnsplashPicker
            className="min-h-[240px]"
            onPick={(image) => {
              onSelect({ url: image.url, alt: image.alt });
              onOpenChange(false);
            }}
          />
        )}
      </div>
    </Dialog>
  );
}
