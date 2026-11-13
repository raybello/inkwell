"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Image as ImageIcon,
  LayoutGrid,
  Link2,
  List,
  Loader2,
  Search,
  UploadCloud,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { EmptyState, Progress } from "@/components/ui/misc";
import { AssetTile } from "@/components/assets/asset-tile";
import { AssetsTabs } from "@/components/assets/assets-tabs";
import { deleteAssetAction, updateAssetAction } from "@/lib/actions/assets";
import { setCoverFromAssetAction } from "@/lib/actions/cover";
import { cn, formatNumber, newId } from "@/lib/utils";
import type { Asset } from "@/lib/types";
import {
  MAX_UPLOAD_BYTES,
  UPLOAD_ACCEPT,
  assetKind,
  formatBytes,
  isAllowedMime,
  isImageAsset,
  parseTags,
  readImageDimensions,
  uploadAssetFile,
} from "@/components/assets/asset-utils";

type SortKey = "newest" | "name" | "size";

interface PendingUpload {
  id: string;
  name: string;
  preview: string | null;
  size: number;
  progress: number;
  error?: string;
}

export function AssetLibrary({
  projectId,
  projectTitle,
  assets,
  coverUrl,
  canEdit,
}: {
  projectId: string;
  projectTitle: string;
  assets: Asset[];
  coverUrl: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = React.useState<Asset[]>(assets);
  const [pending, setPending] = React.useState<PendingUpload[]>([]);
  const [query, setQuery] = React.useState("");
  const [activeTags, setActiveTags] = React.useState<string[]>([]);
  const [sort, setSort] = React.useState<SortKey>("newest");
  const [view, setView] = React.useState<"grid" | "list">("grid");
  const [dragging, setDragging] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<Asset | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Asset | null>(null);
  const [altDraft, setAltDraft] = React.useState("");
  const [tagDraft, setTagDraft] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [urlOpen, setUrlOpen] = React.useState(false);
  const [urlDraft, setUrlDraft] = React.useState("");
  const [urlAlt, setUrlAlt] = React.useState("");
  const [urlTags, setUrlTags] = React.useState("");
  const [urlBusy, setUrlBusy] = React.useState(false);
  const [coverPendingId, setCoverPendingId] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => setItems(assets), [assets]);

  const allTags = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const asset of items) {
      for (const tag of asset.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag, count]) => ({ tag, count }));
  }, [items]);

  const filtered = React.useMemo(() => {
    let list = [...items];
    const needle = query.trim().toLowerCase();
    if (needle) {
      list = list.filter(
        (asset) =>
          asset.filename.toLowerCase().includes(needle) ||
          (asset.alt_text ?? "").toLowerCase().includes(needle) ||
          (asset.tags ?? []).some((tag) => tag.includes(needle)),
      );
    }
    if (activeTags.length) {
      list = list.filter((asset) => activeTags.every((tag) => (asset.tags ?? []).includes(tag)));
    }
    list.sort((a, b) => {
      if (sort === "name") return a.filename.localeCompare(b.filename);
      if (sort === "size") return b.size_bytes - a.size_bytes;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return list;
  }, [items, query, activeTags, sort]);

  const totalBytes = React.useMemo(
    () => items.reduce((sum, asset) => sum + (asset.size_bytes ?? 0), 0),
    [items],
  );

  const handleFiles = React.useCallback(
    async (files: File[]) => {
      if (!canEdit) {
        toast.error("You need edit access to upload assets.");
        return;
      }
      const accepted: File[] = [];
      for (const file of files) {
        if (file.size > MAX_UPLOAD_BYTES) {
          toast.error(`${file.name} is ${formatBytes(file.size)} — the limit is 25 MB.`);
          continue;
        }
        if (file.type && !isAllowedMime(file.type)) {
          toast.error(`${file.name}: unsupported file type.`);
          continue;
        }
        accepted.push(file);
      }

      for (const file of accepted) {
        const id = newId("upload");
        const isImage = assetKind({ mime_type: file.type, filename: file.name }) === "image";
        const preview = isImage ? URL.createObjectURL(file) : null;
        setPending((prev) => [{ id, name: file.name, preview, size: file.size, progress: 0 }, ...prev]);

        const dims = await readImageDimensions(file);

        try {
          const asset = await uploadAssetFile(projectId, file, {
            width: dims?.width ?? null,
            height: dims?.height ?? null,
            onProgress: (pct) =>
              setPending((prev) => prev.map((item) => (item.id === id ? { ...item, progress: pct } : item))),
          });
          setPending((prev) => {
            const done = prev.find((item) => item.id === id);
            if (done?.preview) URL.revokeObjectURL(done.preview);
            return prev.filter((item) => item.id !== id);
          });
          setItems((prev) => [asset, ...prev.filter((item) => item.id !== asset.id)]);
          toast.success(`${asset.filename} uploaded`);
          router.refresh();
        } catch (error) {
          const message = error instanceof Error ? error.message : "Upload failed.";
          setPending((prev) =>
            prev.map((item) => (item.id === id ? { ...item, progress: 100, error: message } : item)),
          );
          toast.error(`${file.name}: ${message}`);
        }
      }
    },
    [canEdit, projectId, router],
  );

  const handleFilesRef = React.useRef(handleFiles);
  handleFilesRef.current = handleFiles;

  React.useEffect(() => {
    let depth = 0;
    const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes("Files");

    const onEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth += 1;
      setDragging(true);
    };
    const onOver = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = canEdit ? "copy" : "none";
    };
    const onLeave = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      const leftViewport =
        event.clientX <= 0 ||
        event.clientY <= 0 ||
        event.clientX >= window.innerWidth ||
        event.clientY >= window.innerHeight;
      depth = Math.max(0, depth - 1);
      if (depth === 0 || leftViewport) {
        depth = 0;
        setDragging(false);
      }
    };
    const onEnd = () => {
      depth = 0;
      setDragging(false);
    };
    const onDrop = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth = 0;
      setDragging(false);
      const dropped = Array.from(event.dataTransfer?.files ?? []);
      if (dropped.length) void handleFilesRef.current(dropped);
    };

    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("dragend", onEnd);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("dragend", onEnd);
      window.removeEventListener("drop", onDrop);
    };
  }, [canEdit]);

  const openEdit = (asset: Asset) => {
    setEditTarget(asset);
    setAltDraft(asset.alt_text ?? "");
    setTagDraft((asset.tags ?? []).join(", "));
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    setBusy(true);
    const result = await updateAssetAction(editTarget.id, { altText: altDraft, tags: tagDraft });
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error ?? "Could not save.");
      return;
    }
    setItems((prev) =>
      prev.map((item) =>
        item.id === editTarget.id
          ? { ...item, alt_text: altDraft.trim() || null, tags: parseTags(tagDraft) }
          : item,
      ),
    );
    setEditTarget(null);
    toast.success("Asset details saved");
    router.refresh();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    const result = await deleteAssetAction(deleteTarget.id);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error ?? "Could not delete the asset.");
      return;
    }
    setItems((prev) => prev.filter((item) => item.id !== deleteTarget.id));
    setDeleteTarget(null);
    toast.success("Asset deleted");
    router.refresh();
  };

  const setCover = async (asset: Asset) => {
    setCoverPendingId(asset.id);
    const result = await setCoverFromAssetAction(asset.id);
    setCoverPendingId(null);
    if (!result.ok) {
      toast.error(result.error ?? "Could not set the cover.");
      return;
    }
    toast.success("Project cover updated");
    router.refresh();
  };

  const importFromUrl = async () => {
    if (!urlDraft.trim()) return;
    setUrlBusy(true);
    try {
      const response = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          url: urlDraft.trim(),
          altText: urlAlt.trim(),
          tags: parseTags(urlTags),
        }),
      });
      const payload = (await response.json()) as { asset?: Asset; error?: string };
      if (!response.ok || !payload.asset) throw new Error(payload.error ?? "Import failed.");
      const asset = payload.asset;
      setItems((prev) => [asset, ...prev]);
      setUrlOpen(false);
      setUrlDraft("");
      setUrlAlt("");
      setUrlTags("");
      toast.success(`${asset.filename} imported`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setUrlBusy(false);
    }
  };

  const dismissPending = (id: string) => {
    setPending((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.preview) URL.revokeObjectURL(target.preview);
      return prev.filter((item) => item.id !== id);
    });
  };

  const hasAssets = items.length > 0;
  const showEmpty = !hasAssets && pending.length === 0;

  return (
    <div className="mx-auto max-w-[1440px] px-4 py-6 md:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted">{projectTitle}</p>
          <h2 className="mt-1 font-serif text-3xl">Assets</h2>
          <p className="mt-1 text-sm text-muted">
            <span className="font-mono text-[12px] text-muted-strong">{formatNumber(items.length)}</span> files ·{" "}
            {formatBytes(totalBytes)} · drag images anywhere to upload
          </p>
        </div>
        <AssetsTabs projectId={projectId} active="assets" />
      </header>

      <div className="mt-6 space-y-3 border-b border-border pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1 md:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search filename, alt text, tag…"
              className="h-9 pl-8 text-[13px]"
              aria-label="Search assets"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          <Select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
            aria-label="Sort assets"
            className="h-9 w-auto text-[13px]"
          >
            <option value="newest">Newest first</option>
            <option value="name">Name A–Z</option>
            <option value="size">Largest first</option>
          </Select>

          <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5" role="group" aria-label="View">
            <button
              type="button"
              onClick={() => setView("grid")}
              aria-label="Contact sheet view"
              aria-pressed={view === "grid"}
              className={cn(
                "rounded p-1.5 transition",
                view === "grid" ? "bg-ink-750 text-foreground" : "text-muted hover:text-muted-strong",
              )}
            >
              <LayoutGrid className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              aria-label="List view"
              aria-pressed={view === "list"}
              className={cn(
                "rounded p-1.5 transition",
                view === "list" ? "bg-ink-750 text-foreground" : "text-muted hover:text-muted-strong",
              )}
            >
              <List className="size-3.5" />
            </button>
          </div>

          {canEdit && (
            <div className="ml-auto flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setUrlOpen(true)}>
                <Link2 /> From URL
              </Button>
              <Button variant="primary" size="sm" onClick={() => fileInputRef.current?.click()}>
                <UploadCloud /> Upload
              </Button>
            </div>
          )}
        </div>

        {allTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[10px] uppercase tracking-[0.16em] text-muted">Tags</span>
            {allTags.map(({ tag, count }) => {
              const active = activeTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() =>
                    setActiveTags((prev) => (active ? prev.filter((t) => t !== tag) : [...prev, tag]))
                  }
                  aria-pressed={active}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition",
                    active
                      ? "border-accent/60 bg-accent/15 text-accent"
                      : "border-border text-muted hover:border-border-strong hover:text-muted-strong",
                  )}
                >
                  {tag}
                  <span className="font-mono text-[9.5px] opacity-70">{count}</span>
                </button>
              );
            })}
            {activeTags.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveTags([])}
                className="ml-1 inline-flex items-center gap-1 text-[11px] text-muted underline-offset-2 hover:text-muted-strong hover:underline"
              >
                <X className="size-3" /> Clear
              </button>
            )}
          </div>
        )}
      </div>

      {pending.length > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {pending.map((item) => (
            <div
              key={item.id}
              className={cn(
                "flex items-center gap-3 rounded-lg border bg-card px-2.5 py-2",
                item.error ? "border-red-900/70" : "border-border",
              )}
            >
              <div className="relative size-10 shrink-0 overflow-hidden rounded-md border border-border bg-ink-850">
                {item.preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.preview} alt="" className="size-full object-cover opacity-70" />
                ) : (
                  <div className="flex size-full items-center justify-center text-muted">
                    <ImageIcon className="size-4" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] text-muted-strong" title={item.name}>
                  {item.name}
                </p>
                {item.error ? (
                  <p className="truncate text-[11px] text-red-400" title={item.error}>
                    {item.error}
                  </p>
                ) : (
                  <div className="mt-1 flex items-center gap-2">
                    <Progress value={item.progress} className="h-1" />
                    <span className="w-9 shrink-0 text-right font-mono text-[10px] text-muted">
                      {item.progress < 100 ? `${item.progress}%` : <Loader2 className="ml-auto size-3 animate-spin" />}
                    </span>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismissPending(item.id)}
                aria-label={`Dismiss ${item.name}`}
                className="rounded p-1 text-muted hover:bg-ink-800 hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {showEmpty ? (
        <div className="mt-8 rounded-xl border border-dashed border-border-strong bg-card/40 px-6 py-20 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-border-strong bg-ink-850 text-muted">
            <ImageIcon className="size-6" />
          </div>
          <h3 className="mt-4 font-serif text-2xl">Drop files to build the contact sheet</h3>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">
            Images, PDFs and MP4s land here — ready to drop into chapters, storyboard cards and mood boards.
          </p>
          <p className="mt-3 font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted/80">
            JPEG · PNG · WebP · GIF · SVG · MP4 · PDF — 25 MB max
          </p>
          {canEdit && (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <Button variant="primary" onClick={() => fileInputRef.current?.click()}>
                <UploadCloud /> Upload files
              </Button>
              <Button variant="outline" onClick={() => setUrlOpen(true)}>
                <Link2 /> Import from URL
              </Button>
            </div>
          )}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          className="mt-8 rounded-xl border border-border bg-card/40"
          icon={<Search />}
          title="No assets match"
          description="Try a different search term or clear the tag filters."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setQuery("");
                setActiveTags([]);
              }}
            >
              Reset filters
            </Button>
          }
        />
      ) : view === "grid" ? (
        <div className="mt-5 columns-2 gap-3 md:columns-3 xl:columns-4 2xl:columns-5">
          {filtered.map((asset) => (
            <AssetTile
              key={asset.id}
              asset={asset}
              view="grid"
              onDelete={setDeleteTarget}
              onEdit={openEdit}
              onSetCover={(target) => void setCover(target)}
              isCover={!!coverUrl && asset.public_url === coverUrl}
              coverPending={coverPendingId === asset.id}
            />
          ))}
        </div>
      ) : (
        <div className="mt-5 space-y-1.5">
          {filtered.map((asset) => (
            <AssetTile
              key={asset.id}
              asset={asset}
              view="list"
              onDelete={setDeleteTarget}
              onEdit={openEdit}
              onSetCover={(target) => void setCover(target)}
              isCover={!!coverUrl && asset.public_url === coverUrl}
              coverPending={coverPendingId === asset.id}
            />
          ))}
        </div>
      )}

      {hasAssets && !canEdit && (
        <p className="mt-6 text-[11px] text-muted">Read-only access — ask the project owner for editor rights to change assets.</p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={UPLOAD_ACCEPT}
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length) void handleFiles(files);
        }}
      />

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-6 backdrop-blur-sm">
          <div className="flex w-full max-w-xl flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-accent/70 bg-ink-900/80 px-8 py-16 text-center shadow-2xl">
            <div className="flex size-14 items-center justify-center rounded-full border border-accent/40 bg-accent/10 text-accent">
              <UploadCloud className="size-6" />
            </div>
            <p className="font-serif text-2xl">Drop to upload</p>
            <p className="text-sm text-muted">
              {canEdit ? "Files land in this project's contact sheet." : "You need edit access to upload."}
            </p>
            <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted/80">
              JPEG · PNG · WebP · GIF · SVG · MP4 · PDF — 25 MB max
            </p>
          </div>
        </div>
      )}

      <Dialog
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
        title="Asset details"
        description={editTarget?.filename}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button variant="primary" loading={busy} onClick={() => void saveEdit()}>
              <Check /> Save
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Alt text" hint="Describes the image for screen readers and exports.">
            <Input
              value={altDraft}
              onChange={(event) => setAltDraft(event.target.value)}
              placeholder="A lighthouse on a salt flat at dusk"
              maxLength={300}
            />
          </Field>
          <Field label="Tags" hint="Comma separated. Tags drive the filter chips above the sheet.">
            <Input
              value={tagDraft}
              onChange={(event) => setTagDraft(event.target.value)}
              placeholder="chapter-one, mood, coastline"
            />
          </Field>
          {editTarget && isImageAsset(editTarget) && editTarget.width && editTarget.height && (
            <p className="font-mono text-[11px] text-muted">
              {editTarget.width} × {editTarget.height} px · {formatBytes(editTarget.size_bytes)} ·{" "}
              {editTarget.mime_type}
            </p>
          )}
        </div>
      </Dialog>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete asset?"
        description={deleteTarget?.filename}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={busy} onClick={() => void confirmDelete()}>
              Delete permanently
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          The file is removed from storage too. Chapters that already embed the image keep their copy of the URL, which
          will stop resolving.
        </p>
      </Dialog>

      <Dialog
        open={urlOpen}
        onOpenChange={(open) => !urlBusy && setUrlOpen(open)}
        title="Import from URL"
        description="We fetch the file server-side and store a copy in this project."
        footer={
          <>
            <Button variant="ghost" disabled={urlBusy} onClick={() => setUrlOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={urlBusy} onClick={() => void importFromUrl()}>
              <Link2 /> Import
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Image URL">
            <Input
              value={urlDraft}
              onChange={(event) => setUrlDraft(event.target.value)}
              placeholder="https://images.example.com/coast.jpg"
              inputMode="url"
              autoFocus
            />
          </Field>
          <Field label="Alt text">
            <Input
              value={urlAlt}
              onChange={(event) => setUrlAlt(event.target.value)}
              placeholder="Optional description"
              maxLength={300}
            />
          </Field>
          <Field label="Tags">
            <Input
              value={urlTags}
              onChange={(event) => setUrlTags(event.target.value)}
              placeholder="reference, mood"
            />
          </Field>
          <p className="text-[11px] text-muted">Up to 25 MB. JPEG, PNG, WebP, GIF, SVG, MP4 or PDF.</p>
        </div>
      </Dialog>
    </div>
  );
}
