"use client";

import * as React from "react";
import {
  Check,
  Copy,
  Download,
  FileText,
  Film,
  Image as ImageIcon,
  Link2,
  Loader2,
  MoreHorizontal,
  Star,
  Tags,
  Trash2,
  File as FileIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dropdown, DropdownItem, DropdownSeparator } from "@/components/ui/dropdown";
import type { Asset } from "@/lib/types";
import { assetKind, assetMeta, formatBytes, markdownForAsset } from "@/components/assets/asset-utils";

function IconAction({
  label,
  onClick,
  children,
  danger,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "rounded-md border border-ink-50/10 bg-black/55 p-1.5 text-ink-50/75 backdrop-blur-sm transition hover:bg-black/80 hover:text-ink-50 focus-visible:ring-2 focus-visible:ring-accent/70 focus-visible:outline-none [&_svg]:size-3.5",
        danger && "hover:text-red-300",
      )}
    >
      {children}
    </button>
  );
}

function KindIcon({ kind, className }: { kind: ReturnType<typeof assetKind>; className?: string }) {
  if (kind === "video") return <Film className={className} />;
  if (kind === "pdf") return <FileText className={className} />;
  if (kind === "file") return <FileIcon className={className} />;
  return <ImageIcon className={className} />;
}

export function AssetTile({
  asset,
  view,
  onDelete,
  onEdit,
  onSetCover,
  isCover,
  coverPending,
}: {
  asset: Asset;
  view: "grid" | "list";
  onDelete: (asset: Asset) => void;
  onEdit: (asset: Asset) => void;
  onSetCover: (asset: Asset) => void;
  isCover?: boolean;
  coverPending?: boolean;
}) {
  const [broken, setBroken] = React.useState(false);
  const [copied, setCopied] = React.useState<"url" | "md" | null>(null);
  const kind = assetKind(asset);
  const url = asset.public_url ?? "";
  const dims = asset.width && asset.height ? `${asset.width} × ${asset.height}` : null;

  const copy = async (text: string, which: "url" | "md") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      window.setTimeout(() => setCopied(null), 1500);
      toast.success(which === "url" ? "Image URL copied" : "Markdown copied");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  const download = () => {
    if (!url) return;
    const link = document.createElement("a");
    link.href = url;
    link.download = asset.filename;
    link.target = "_blank";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const media =
    kind === "image" && !broken ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={asset.alt_text ?? asset.filename}
        width={asset.width ?? undefined}
        height={asset.height ?? undefined}
        loading="lazy"
        decoding="async"
        onError={() => setBroken(true)}
        className="block h-auto w-full object-cover"
      />
    ) : kind === "video" && !broken ? (
      <video
        src={`${url}#t=0.1`}
        muted
        playsInline
        preload="metadata"
        onError={() => setBroken(true)}
        className="block aspect-[4/3] w-full bg-ink-950 object-cover"
      />
    ) : (
      <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.05),transparent_65%)] text-muted">
        <KindIcon kind={kind} className="size-7" />
        <span className="font-mono text-[10px] uppercase tracking-[0.16em]">
          {kind === "pdf" ? "PDF" : kind === "video" ? "Video" : kind === "file" ? "File" : "Image"}
        </span>
      </div>
    );

  if (view === "list") {
    return (
      <div className="group flex items-center gap-3 rounded-lg border border-border bg-card px-2.5 py-2 transition hover:border-border-strong hover:bg-card-hover">
        <div className="relative size-11 shrink-0 overflow-hidden rounded-md border border-border bg-ink-850">
          {kind === "image" && !broken ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={asset.alt_text ?? asset.filename} className="size-full object-cover" loading="lazy" />
          ) : (
            <div className="flex size-full items-center justify-center text-muted">
              <KindIcon kind={kind} className="size-4" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] text-foreground" title={asset.filename}>
            {asset.filename}
          </p>
          <p className="truncate font-mono text-[10.5px] text-muted">
            {assetMeta(asset)}
            {asset.tags.length ? ` · ${asset.tags.map((t) => `#${t}`).join(" ")}` : ""}
          </p>
        </div>
        {isCover && (
          <span className="hidden items-center gap-1 rounded-full border border-accent/40 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-accent sm:inline-flex">
            <Star className="size-2.5" /> Cover
          </span>
        )}
        <div className="flex items-center gap-1">
          <IconAction label="Copy URL" onClick={() => void copy(url, "url")}>
            {copied === "url" ? <Check /> : <Link2 />}
          </IconAction>
          <IconAction label="Copy markdown" onClick={() => void copy(markdownForAsset(asset), "md")}>
            <Copy />
          </IconAction>
          <IconAction label="Download" onClick={download}>
            <Download />
          </IconAction>
          <Dropdown
            trigger={
              <button
                type="button"
                aria-label="More actions"
                className="rounded-md p-1.5 text-muted transition hover:bg-ink-800 hover:text-foreground [&_svg]:size-4"
              >
                <MoreHorizontal />
              </button>
            }
          >
            {(close) => (
              <>
                <DropdownItem icon={<Tags />} onClick={() => { close(); onEdit(asset); }}>
                  Alt text & tags
                </DropdownItem>
                <DropdownItem icon={<Star />} onClick={() => { close(); onSetCover(asset); }}>
                  Set as project cover
                </DropdownItem>
                <DropdownSeparator />
                <DropdownItem icon={<Trash2 />} danger onClick={() => { close(); onDelete(asset); }}>
                  Delete asset
                </DropdownItem>
              </>
            )}
          </Dropdown>
        </div>
      </div>
    );
  }

  return (
    <figure className="group relative mb-3 break-inside-avoid overflow-hidden rounded-lg border border-border bg-card transition duration-200 hover:border-border-strong">
      <div className="relative overflow-hidden bg-ink-850">
        {media}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-black/20 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100">
          <div className="pointer-events-auto absolute right-1.5 top-1.5 flex flex-col gap-1">
            <IconAction label="Download" onClick={download}>
              <Download />
            </IconAction>
            <IconAction label="Copy URL" onClick={() => void copy(url, "url")}>
              {copied === "url" ? <Check /> : <Link2 />}
            </IconAction>
            <Dropdown
              align="end"
              trigger={
                <button
                  type="button"
                  aria-label="More actions"
                  title="More actions"
                  className="rounded-md border border-ink-50/10 bg-black/55 p-1.5 text-ink-50/75 backdrop-blur-sm transition hover:bg-black/80 hover:text-ink-50 [&_svg]:size-3.5"
                >
                  <MoreHorizontal />
                </button>
              }
            >
              {(close) => (
                <>
                  <DropdownItem icon={<Copy />} onClick={() => { close(); void copy(markdownForAsset(asset), "md"); }}>
                    Copy markdown
                  </DropdownItem>
                  <DropdownItem icon={<Tags />} onClick={() => { close(); onEdit(asset); }}>
                    Alt text & tags
                  </DropdownItem>
                  <DropdownItem icon={<Star />} onClick={() => { close(); onSetCover(asset); }}>
                    Set as project cover
                  </DropdownItem>
                  <DropdownSeparator />
                  <DropdownItem icon={<Trash2 />} danger onClick={() => { close(); onDelete(asset); }}>
                    Delete asset
                  </DropdownItem>
                </>
              )}
            </Dropdown>
          </div>

          <div className="pointer-events-auto absolute inset-x-1.5 bottom-1.5 flex items-center gap-1">
            <IconAction label="Copy markdown" onClick={() => void copy(markdownForAsset(asset), "md")}>
              {copied === "md" ? <Check /> : <span className="font-mono text-[9.5px] font-semibold leading-none">MD</span>}
            </IconAction>
            <IconAction label="Alt text & tags" onClick={() => onEdit(asset)}>
              <Tags />
            </IconAction>
            <IconAction label={coverPending ? "Setting cover…" : "Set as project cover"} onClick={() => !coverPending && onSetCover(asset)}>
              {coverPending ? <Loader2 className="animate-spin" /> : <Star />}
            </IconAction>
            {dims && <span className="ml-auto rounded bg-black/55 px-1.5 py-0.5 font-mono text-[9.5px] text-ink-50/70 backdrop-blur-sm">{dims}</span>}
          </div>
        </div>

        <div className="pointer-events-none absolute left-1.5 top-1.5 flex items-center gap-1">
          {isCover && (
            <span className="inline-flex items-center gap-1 rounded bg-accent px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-on-accent">
              <Star className="size-2.5" /> Cover
            </span>
          )}
          {kind !== "image" && (
            <span className="rounded bg-black/60 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-ink-50/75 backdrop-blur-sm">
              {kind === "video" ? "MP4" : kind === "pdf" ? "PDF" : "File"}
            </span>
          )}
        </div>
      </div>

      <figcaption className="flex items-center gap-2 px-2.5 py-2">
        <span className="min-w-0 flex-1 truncate text-[12px] text-muted-strong" title={asset.filename}>
          {asset.filename}
        </span>
        <span className="shrink-0 font-mono text-[10px] text-muted">{formatBytes(asset.size_bytes)}</span>
      </figcaption>
    </figure>
  );
}
