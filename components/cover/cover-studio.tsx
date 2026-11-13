"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Download,
  ImagePlus,
  Loader2,
  RotateCcw,
  Save,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dropdown, DropdownItem, DropdownLabel } from "@/components/ui/dropdown";
import { AssetsTabs } from "@/components/assets/assets-tabs";
import { AssetPicker, type PickedAsset } from "@/components/assets/asset-picker";
import { CoverControls } from "@/components/cover/cover-controls";
import { CoverPresets } from "@/components/cover/cover-presets";
import { CoverPreview } from "@/components/cover/cover-preview";
import { MAX_UPLOAD_BYTES, uploadAssetFile } from "@/components/assets/asset-utils";
import { clearProjectCoverAction, setProjectCoverAction } from "@/lib/actions/cover";
import {
  COVER_BASE_HEIGHT,
  COVER_BASE_WIDTH,
  COVER_FONTS_HREF,
  COVER_PRINT_HEIGHT,
  COVER_PRINT_WIDTH,
  COVER_SCREEN_HEIGHT,
  COVER_SCREEN_WIDTH,
  applyCoverPreset,
  coverFilename,
  defaultCoverConfig,
  downloadBlob,
  ensureCoverFonts,
  loadCoverImage,
  normalizeCoverConfig,
  renderCoverBlob,
  type CoverConfig,
} from "@/lib/cover";

type ExportJob = "print" | "screen" | "cover" | "clear" | null;

export function CoverStudio({
  projectId,
  projectTitle,
  projectSubtitle,
  authorName,
  coverUrl,
  canEdit,
}: {
  projectId: string;
  projectTitle: string;
  projectSubtitle: string | null;
  authorName: string | null;
  coverUrl: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const storageKey = `inkwell.cover.${projectId}`;

  const initialConfig = React.useMemo(
    () =>
      defaultCoverConfig({
        title: projectTitle,
        subtitle: projectSubtitle,
        author: authorName,
      }),
    [projectTitle, projectSubtitle, authorName],
  );

  const [config, setConfig] = React.useState<CoverConfig>(initialConfig);
  const [image, setImage] = React.useState<HTMLImageElement | null>(null);
  const [imageError, setImageError] = React.useState(false);
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [job, setJob] = React.useState<ExportJob>(null);
  const [hydrated, setHydrated] = React.useState(false);

  // restore the last-used look for this project
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) setConfig(normalizeCoverConfig(JSON.parse(raw), initialConfig));
    } catch {
      // corrupted storage — keep defaults
    }
    setHydrated(true);
  }, [storageKey, initialConfig]);

  React.useEffect(() => {
    if (!hydrated) return;
    const handle = window.setTimeout(() => {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(config));
      } catch {
        // storage full or blocked — not critical
      }
    }, 350);
    return () => window.clearTimeout(handle);
  }, [config, storageKey, hydrated]);

  const backgroundUrl = config.background.kind === "image" ? config.background.url : null;

  React.useEffect(() => {
    let alive = true;
    if (!backgroundUrl) {
      setImage(null);
      setImageError(false);
      return;
    }
    setImageError(false);
    void loadCoverImage(backgroundUrl).then((loaded) => {
      if (!alive) return;
      setImage(loaded);
      setImageError(!loaded);
    });
    return () => {
      alive = false;
    };
  }, [backgroundUrl]);

  const chooseBaseImage = (picked: PickedAsset) => {
    setConfig((prev) => ({
      ...prev,
      background: {
        ...prev.background,
        kind: "image",
        url: picked.url,
        assetId: null,
        overlay: Math.max(prev.background.overlay, 0.35),
      },
    }));
  };

  const renderImage = async () => {
    if (config.background.kind !== "image") return null;
    return loadCoverImage(config.background.url);
  };

  const download = async (size: "print" | "screen") => {
    setJob(size);
    try {
      await ensureCoverFonts(config);
      const source = await renderImage();
      const blob =
        size === "print"
          ? await renderCoverBlob(config, source, COVER_PRINT_WIDTH, COVER_PRINT_HEIGHT)
          : await renderCoverBlob(config, source, COVER_SCREEN_WIDTH, COVER_SCREEN_HEIGHT);
      downloadBlob(
        blob,
        coverFilename(config.title.text || projectTitle, size === "print" ? "print-3200x4800" : "screen-1600x2400"),
      );
      toast.success(size === "print" ? "Print PNG downloaded" : "Screen PNG downloaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setJob(null);
    }
  };

  const saveAsCover = async () => {
    if (!canEdit) {
      toast.error("You need edit access to change the project cover.");
      return;
    }
    setJob("cover");
    try {
      await ensureCoverFonts(config);
      const source = await renderImage();
      const printBlob = await renderCoverBlob(config, source, COVER_PRINT_WIDTH, COVER_PRINT_HEIGHT);
      const downsized = printBlob.size > MAX_UPLOAD_BYTES;
      const blob = downsized
        ? await renderCoverBlob(config, source, COVER_SCREEN_WIDTH, COVER_SCREEN_HEIGHT)
        : printBlob;
      const file = new File([blob], coverFilename(config.title.text || projectTitle, downsized ? "cover-screen" : "cover"), {
        type: "image/png",
      });
      const asset = await uploadAssetFile(projectId, file, {
        altText: `${projectTitle} — cover`,
        tags: ["cover"],
      });
      const result = await setProjectCoverAction({ projectId, assetId: asset.id, url: asset.public_url ?? undefined });
      if (!result.ok) throw new Error(result.error ?? "Could not set the project cover.");
      toast.success(
        downsized
          ? "Project cover updated at screen resolution (the print PNG was over 25 MB)"
          : "Project cover updated",
      );
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the cover.");
    } finally {
      setJob(null);
    }
  };

  const removeCover = async () => {
    setJob("clear");
    try {
      const result = await clearProjectCoverAction(projectId);
      if (!result.ok) throw new Error(result.error ?? "Could not remove the cover.");
      toast.success("Project cover removed");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not remove the cover.");
    } finally {
      setJob(null);
    }
  };

  const reset = () => {
    setConfig(initialConfig);
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
    toast.success("Cover reset to defaults");
  };

  return (
    <div className="mx-auto max-w-[1560px] px-4 py-6 md:px-6">
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link rel="stylesheet" href={COVER_FONTS_HREF} />

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href={`/app/projects/${projectId}/assets`}
            className="inline-flex items-center gap-1 text-[11px] text-muted transition hover:text-muted-strong"
          >
            <ArrowLeft className="size-3" /> Assets
          </Link>
          <h2 className="mt-1 font-serif text-3xl">Cover studio</h2>
          <p className="mt-1 max-w-xl text-sm text-muted">
            {projectTitle} · {COVER_BASE_WIDTH} × {COVER_BASE_HEIGHT} canvas · print export {COVER_PRINT_WIDTH} ×{" "}
            {COVER_PRINT_HEIGHT} (≈300 dpi at 6 × 9 in)
          </p>
        </div>
        <AssetsTabs projectId={projectId} active="cover" />
      </header>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-b border-border pb-3">
        <Button variant="ghost" size="sm" onClick={reset}>
          <RotateCcw /> Reset
        </Button>
        {canEdit ? (
          <div className="ml-auto flex items-center gap-2">
            {coverUrl && (
              <Button variant="ghost" size="sm" loading={job === "clear"} onClick={() => void removeCover()}>
                Remove cover
              </Button>
            )}
            <Dropdown
              align="end"
              trigger={
                <Button variant="secondary" size="sm" loading={job === "print" || job === "screen"}>
                  <Download /> Export PNG <ChevronDown className="opacity-60" />
                </Button>
              }
            >
              {(close) => (
                <>
                  <DropdownLabel>Download</DropdownLabel>
                  <DropdownItem
                    onClick={() => {
                      close();
                      void download("print");
                    }}
                  >
                    Print — {COVER_PRINT_WIDTH} × {COVER_PRINT_HEIGHT}
                  </DropdownItem>
                  <DropdownItem
                    onClick={() => {
                      close();
                      void download("screen");
                    }}
                  >
                    Screen — {COVER_SCREEN_WIDTH} × {COVER_SCREEN_HEIGHT}
                  </DropdownItem>
                  <DropdownLabel>Export</DropdownLabel>
                  <DropdownItem
                    onClick={() => {
                      close();
                      setPickerOpen(true);
                    }}
                  >
                    <ImagePlus /> Choose base image
                  </DropdownItem>
                </>
              )}
            </Dropdown>
            <Button variant="primary" size="sm" loading={job === "cover"} onClick={() => void saveAsCover()}>
              <Save /> Save as project cover
            </Button>
          </div>
        ) : (
          <p className="ml-auto text-[11px] text-muted">Read-only — ask the owner for editor access.</p>
        )}
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)_230px]">
        <aside className="order-2 xl:order-1">
          <div className="xl:sticky xl:top-4 xl:max-h-[calc(100vh_-_32px)] xl:overflow-y-auto xl:pr-1">
            <CoverControls config={config} onChange={setConfig} onChooseImage={() => setPickerOpen(true)} />
          </div>
        </aside>

        <section className="order-1 xl:order-2">
          <div
            className="relative flex min-h-[420px] items-start justify-center rounded-xl border border-border bg-ink-900/50 p-5 md:p-8"
            style={{
              backgroundImage:
                "linear-gradient(45deg, rgba(255,255,255,0.022) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.022) 75%), linear-gradient(45deg, rgba(255,255,255,0.022) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.022) 75%)",
              backgroundSize: "22px 22px",
              backgroundPosition: "0 0, 11px 11px",
            }}
          >
            <div className="flex flex-col items-center gap-3">
              <CoverPreview
                config={config}
                image={image}
                className="block h-auto max-h-[calc(100vh_-_250px)] w-auto max-w-full rounded-[2px] shadow-[0_38px_90px_-32px_rgba(0,0,0,0.95),0_4px_14px_rgba(0,0,0,0.5)] ring-1 ring-black/50"
              />
              <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                <span>
                  {COVER_BASE_WIDTH} × {COVER_BASE_HEIGHT}
                </span>
                <span className="size-0.5 rounded-full bg-border-strong" />
                <span>2 : 3</span>
                <span className="size-0.5 rounded-full bg-border-strong" />
                <span>{config.preset}</span>
              </div>
              {imageError && (
                <p className="flex items-center gap-1.5 text-[11px] text-amber-400/90">
                  <TriangleAlert className="size-3" /> Background image could not load — exporting on the colour fallback.
                </p>
              )}
            </div>
          </div>
        </section>

        <aside className="order-3">
          <div className="xl:sticky xl:top-4 space-y-4">
            <CoverPresets
              active={config.preset}
              disabled={!canEdit}
              onApply={(id) => setConfig((prev) => applyCoverPreset(prev, id))}
            />

            {coverUrl && (
              <div className="rounded-lg border border-border bg-card p-2">
                <p className="text-[10px] uppercase tracking-[0.14em] text-muted">Live cover</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={coverUrl}
                  alt={`${projectTitle} cover`}
                  className="mt-1.5 aspect-[2/3] w-full rounded object-cover ring-1 ring-black/40"
                />
                <p className="mt-1.5 flex items-center gap-1 text-[10.5px] text-sage">
                  <Check className="size-3" /> Used across the library
                </p>
              </div>
            )}
          </div>
        </aside>
      </div>

      <AssetPicker
        projectId={projectId}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={chooseBaseImage}
        allowUrl
      />

      {job === "cover" && (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center">
          <div className="flex items-center gap-2 rounded-full border border-border-strong bg-ink-850 px-3 py-1.5 text-[11px] text-muted-strong shadow-xl">
            <Loader2 className="size-3 animate-spin text-accent" /> Rendering 2× cover and uploading…
          </div>
        </div>
      )}
    </div>
  );
}
