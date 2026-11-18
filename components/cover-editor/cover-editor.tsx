"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Cloud,
  CloudOff,
  ImagePlus,
  Loader2,
  Minus,
  RotateCcw,
  Save,
  Square,
  Trash2,
  Type,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/misc";
import { CoverCanvas } from "@/components/cover-editor/cover-canvas";
import { CoverInspector } from "@/components/cover-editor/cover-inspector";
import { clearRenderedCover, saveCoverLayout, saveRenderedCover } from "@/lib/actions/cover-art";
import {
  COVER_FONTS_HREF,
  defaultCoverDoc,
  layerId,
  newImageLayer,
  newShapeLayer,
  newTextLayer,
  COVER_HEIGHT,
  COVER_WIDTH,
  loadImage,
  normaliseCoverDoc,
  renderCoverSide,
  type CoverDoc,
  type CoverLayer,
  type CoverSide,
  type CoverSideDoc,
} from "@/lib/cover-art";
import { cn } from "@/lib/utils";

export interface CoverAsset {
  id: string;
  filename: string;
  url: string;
  mime: string | null;
}

type SaveState = "saved" | "dirty" | "saving" | "error";

export function CoverEditor({
  projectId,
  project,
  assets,
  canEdit,
}: {
  projectId: string;
  project: {
    title: string;
    subtitle: string | null;
    author: string;
    description: string | null;
    coverFront: unknown;
    coverBack: unknown;
    coverFrontUrl: string | null;
    coverBackUrl: string | null;
  };
  assets: CoverAsset[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const defaults = React.useMemo(
    () =>
      defaultCoverDoc({
        title: project.title || "Untitled",
        subtitle: project.subtitle,
        author: project.author,
        description: project.description,
      }),
    [project.title, project.subtitle, project.author, project.description],
  );

  const [doc, setDoc] = React.useState<CoverDoc>(() =>
    normaliseCoverDoc({ front: project.coverFront, back: project.coverBack }, defaults),
  );
  const [library, setLibrary] = React.useState<CoverAsset[]>(assets);
  const [uploading, setUploading] = React.useState(false);
  const [side, setSide] = React.useState<CoverSide>("front");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [trayOpen, setTrayOpen] = React.useState(false);
  const [saveState, setSaveState] = React.useState<SaveState>("saved");
  const [rendering, setRendering] = React.useState<null | "front" | "back" | "both">(null);

  const docRef = React.useRef(doc);
  docRef.current = doc;

  // Loaded imperatively: React 19 suspends the subtree for `<link precedence>`,
  // which would block hydration (and the canvas) when the font CDN is slow.
  React.useEffect(() => {
    if (document.querySelector('link[data-inkwell-cover-fonts]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = COVER_FONTS_HREF;
    link.dataset.inkwellCoverFonts = "true";
    document.head.appendChild(link);
  }, []);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const sideDoc = doc[side];
  const selected = sideDoc.layers.find((l) => l.id === selectedId) ?? null;

  const persistLayout = React.useCallback(async () => {
    setSaveState("saving");
    const result = await saveCoverLayout(projectId, docRef.current);
    if (!result.ok) {
      setSaveState("error");
      toast.error(result.error);
      return;
    }
    setSaveState("saved");
  }, [projectId]);

  const scheduleSave = React.useCallback(() => {
    if (!canEdit) return;
    setSaveState("dirty");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void persistLayout();
    }, 1400);
  }, [canEdit, persistLayout]);

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (timerRef.current) clearTimeout(timerRef.current);
        void persistLayout();
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selectedId) {
        const target = event.target as HTMLElement | null;
        if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
        event.preventDefault();
        updateSide((current) => ({
          ...current,
          layers: current.layers.filter((l) => l.id !== selectedId),
        }));
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, persistLayout]);

  const updateSide = React.useCallback(
    (mutate: (current: CoverSideDoc) => CoverSideDoc) => {
      setDoc((current) => {
        const nextSide = mutate(current[side]);
        return { ...current, [side]: nextSide };
      });
      scheduleSave();
    },
    [side, scheduleSave],
  );

  const patchLayer = (patch: Partial<CoverLayer>) => {
    if (!selectedId) return;
    updateSide((current) => ({
      ...current,
      layers: current.layers.map((layer) =>
        layer.id === selectedId ? ({ ...layer, ...patch } as CoverLayer) : layer,
      ),
    }));
  };

  const addText = (kind: "heading" | "body" | "caption") => {
    const presets = {
      heading: { size: 92, weight: 600, lineHeight: 1.05, letterSpacing: -1, text: "Headline text" },
      body: { size: 46, weight: 400, lineHeight: 1.5, letterSpacing: 0, text: "Body copy goes here." },
      caption: {
        size: 30,
        weight: 500,
        letterSpacing: 6,
        uppercase: true,
        text: "AUTHOR NAME",
      },
    } as const;
    const preset = presets[kind];
    const layer = newTextLayer({
      ...preset,
      y: Math.min(0.88, 0.2 + sideDoc.layers.length * 0.06),
    });
    updateSide((current) => ({ ...current, layers: [...current.layers, layer] }));
    setSelectedId(layer.id);
  };

  const addImage = async (
    url: string,
    options: { asBackground?: boolean; point?: { x: number; y: number }; replaceId?: string } = {},
  ) => {
    if (options.asBackground) {
      updateSide((current) => ({
        ...current,
        background: { ...current.background, kind: "image", imageUrl: url },
      }));
      return;
    }

    // Keep the art's own aspect ratio so logos and ornaments aren't squashed.
    const img = await loadImage(url);
    const ratio = img && img.naturalWidth > 0 ? img.naturalHeight / img.naturalWidth : 1.25;
    const width = options.point ? 0.5 : 0.55;
    const height = Math.min(
      0.9,
      ((width * COVER_WIDTH) / COVER_HEIGHT) * ratio,
    );
    const point = options.point ?? { x: 0.5, y: 0.35 };
    const x = Math.min(1 - width, Math.max(0, point.x - width / 2));
    const y = Math.min(1 - height, Math.max(0, point.y - height / 2));

    if (options.replaceId) {
      updateSide((current) => ({
        ...current,
        layers: current.layers.map((layer) =>
          layer.id === options.replaceId && layer.type === "image"
            ? { ...layer, url, height }
            : layer,
        ),
      }));
      return;
    }

    const layer = newImageLayer(url, { x, y, width, height, fit: "contain" });
    updateSide((current) => ({ ...current, layers: [...current.layers, layer] }));
    setSelectedId(layer.id);
  };

  /**
   * Uploads straight from the cover editor — no trip to Assets — then drops the
   * image onto the page at the drop point (or centred).
   */
  const uploadImage = async (
    file: File,
    options: { asBackground?: boolean; point?: { x: number; y: number }; replaceId?: string } = {},
  ) => {
    if (!canEdit) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Only image files can be added to a cover.");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Images must be 25 MB or smaller.");
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append("projectId", projectId);
      form.append("file", file);
      const response = await fetch("/api/assets", { method: "POST", body: form });
      const payload = (await response.json().catch(() => ({}))) as {
        asset?: { id: string; filename: string; public_url: string | null; mime_type: string | null };
        error?: string;
      };
      if (!response.ok) throw new Error(payload.error ?? "Upload failed.");
      const asset = payload.asset;
      const publicUrl = asset?.public_url;
      if (!asset || !publicUrl) throw new Error(payload.error ?? "The upload returned no file.");
      setLibrary((current) => [
        { id: asset.id, filename: asset.filename, url: publicUrl, mime: asset.mime_type },
        ...current.filter((item) => item.id !== asset.id),
      ]);
      await addImage(publicUrl, options);
      toast.success(`${file.name} added to the cover`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const addShape = () => {
    const layer = newShapeLayer({ y: Math.min(0.8, 0.45 + sideDoc.layers.length * 0.03) });
    updateSide((current) => ({ ...current, layers: [...current.layers, layer] }));
    setSelectedId(layer.id);
  };

  const duplicateSelected = () => {
    if (!selected) return;
    const copy = { ...selected, id: layerId(selected.type), x: Math.min(0.8, selected.x + 0.03), y: Math.min(0.9, selected.y + 0.03) };
    updateSide((current) => ({ ...current, layers: [...current.layers, copy as CoverLayer] }));
    setSelectedId(copy.id);
  };

  const moveOrder = (direction: "up" | "down") => {
    if (!selectedId) return;
    updateSide((current) => {
      const index = current.layers.findIndex((l) => l.id === selectedId);
      if (index < 0) return current;
      const target = direction === "up" ? index + 1 : index - 1;
      if (target < 0 || target >= current.layers.length) return current;
      const layers = [...current.layers];
      [layers[index], layers[target]] = [layers[target], layers[index]];
      return { ...current, layers };
    });
  };

  const renderAndSave = async () => {
    if (!canEdit) return;
    setRendering("both");
    try {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      await saveCoverLayout(projectId, docRef.current);

      for (const targetSide of ["front", "back"] as CoverSide[]) {
        const blob = await renderCoverSide(docRef.current, targetSide, 2);
        const base64 = await blobToBase64(blob);
        const result = await saveRenderedCover({
          projectId,
          side: targetSide,
          pngBase64: base64,
          width: 3200,
          height: 4800,
          doc: docRef.current,
        });
        if (!result.ok) throw new Error(result.error);
      }
      setSaveState("saved");
      toast.success("Covers rendered — exports will use them.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not render the cover.");
    } finally {
      setRendering(null);
    }
  };

  const resetSide = () => {
    const fresh = defaults[side];
    updateSide(() => fresh);
    setSelectedId(null);
    toast.success("Template restored for this page.");
  };

  const clearRendered = async (target: CoverSide) => {
    const result = await clearRenderedCover(projectId, target);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Rendered cover removed.");
    router.refresh();
  };

  const renderedUrl = side === "front" ? project.coverFrontUrl : project.coverBackUrl;

  return (
    <div className="flex min-h-0 flex-col">
      {/* ------------------------------------------------------------- header */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5 md:px-6">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.18em] text-accent">Cover</p>
          <h2 className="truncate font-serif text-lg leading-tight">Front &amp; back cover</h2>
        </div>

        <div className="ml-1 flex items-center gap-1 rounded-lg border border-border bg-ink-900/60 p-0.5">
          {(["front", "back"] as CoverSide[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setSide(value);
                setSelectedId(null);
              }}
              className={cn(
                "rounded-md px-3 py-1 text-[12px] capitalize transition",
                side === value ? "bg-ink-750 text-foreground" : "text-muted hover:text-foreground",
              )}
            >
              {value}
              {value === "front" && project.coverFrontUrl ? " ✓" : ""}
              {value === "back" && project.coverBackUrl ? " ✓" : ""}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden items-center gap-1.5 text-[11px] text-muted sm:flex">
            {saveState === "saving" ? (
              <>
                <Loader2 className="size-3 animate-spin" /> Saving layout
              </>
            ) : saveState === "dirty" ? (
              <>
                <CloudOff className="size-3" /> Unsaved layout
              </>
            ) : saveState === "error" ? (
              <>
                <CloudOff className="size-3 text-red-400" /> Not saved
              </>
            ) : (
              <>
                <Cloud className="size-3 text-sage" /> Layout saved
              </>
            )}
          </span>
          <Button variant="ghost" size="sm" onClick={resetSide} disabled={!canEdit}>
            <RotateCcw /> Reset page
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={renderAndSave}
            loading={rendering !== null}
            disabled={!canEdit}
          >
            <Save /> {rendering ? "Rendering…" : "Render & save covers"}
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* --------------------------------------------------------- asset tray */}
        <aside
          className={cn(
            "hidden shrink-0 flex-col border-r border-border bg-ink-900/40 lg:flex",
            trayOpen ? "w-[196px]" : "w-11",
          )}
        >
          <button
            type="button"
            onClick={() => setTrayOpen((v) => !v)}
            aria-label={trayOpen ? "Collapse asset tray" : "Open asset tray"}
            aria-expanded={trayOpen}
            className="flex h-10 items-center justify-between border-b border-border px-2.5 text-[10px] uppercase tracking-[0.14em] text-muted hover:text-foreground"
          >
            {trayOpen ? "Assets" : <ImagePlus className="size-4" />}
            {trayOpen && <Minus className="size-3" />}
          </button>
          {trayOpen && (
            <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2">
              <label className="mb-1 flex h-7 cursor-pointer items-center justify-center gap-1.5 rounded border border-dashed border-border-strong text-[10px] text-muted transition hover:border-accent/60 hover:text-accent">
                <ImagePlus className="size-3" /> Upload
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={async (event) => {
                    const files = Array.from(event.target.files ?? []);
                    event.currentTarget.value = "";
                    for (const file of files) await uploadImage(file);
                  }}
                />
              </label>
              <p className="pb-1 text-[10px] leading-relaxed text-muted">
                Click to place on the page, or set as background.
              </p>
              {library.length === 0 && (
                <p className="rounded border border-dashed border-border-strong px-2 py-4 text-center text-[10px] text-muted">
                  Upload images in Assets first.
                </p>
              )}
              {library.map((asset) => (
                <div
                  key={asset.id}
                  className="group relative overflow-hidden rounded border border-border bg-ink-850"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={asset.url}
                    alt={asset.filename}
                    className="h-24 w-full cursor-pointer object-cover transition group-hover:opacity-80"
                    onClick={() => void addImage(asset.url)}
                    draggable={false}
                  />
                  <div className="flex items-center justify-between gap-1 border-t border-border px-1 py-0.5">
                    <span className="truncate text-[9px] text-muted">{asset.filename}</span>
                    <button
                      type="button"
                      className="rounded p-0.5 text-[9px] text-muted hover:text-accent"
                      onClick={() => void addImage(asset.url, { asBackground: true })}
                      title="Use as background"
                    >
                      BG
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* ------------------------------------------------------------- canvas */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-1 border-b border-border px-3 py-1.5">
            <Tooltip label="Add headline">
              <button
                type="button"
                onClick={() => addText("heading")}
                disabled={!canEdit}
                className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-muted-strong hover:bg-ink-800 hover:text-foreground disabled:opacity-40"
              >
                <Type className="size-3.5" /> Headline
              </button>
            </Tooltip>
            <button
              type="button"
              onClick={() => addText("body")}
              disabled={!canEdit}
              className="rounded px-2 py-1 text-[11px] text-muted-strong hover:bg-ink-800 hover:text-foreground disabled:opacity-40"
            >
              Body text
            </button>
            <button
              type="button"
              onClick={() => addText("caption")}
              disabled={!canEdit}
              className="rounded px-2 py-1 text-[11px] text-muted-strong hover:bg-ink-800 hover:text-foreground disabled:opacity-40"
            >
              Small caps
            </button>
            <span className="mx-1 h-4 w-px bg-border" />
            <button
              type="button"
              onClick={addShape}
              disabled={!canEdit}
              className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-muted-strong hover:bg-ink-800 hover:text-foreground disabled:opacity-40"
            >
              <Square className="size-3.5" /> Rule / box
            </button>
            <label
              className={cn(
                "flex items-center gap-1 rounded px-2 py-1 text-[11px] text-muted-strong hover:bg-ink-800 hover:text-foreground",
                (!canEdit || uploading) && "pointer-events-none opacity-40",
              )}
            >
              {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />}
              {uploading ? "Uploading…" : "Upload image"}
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={async (event) => {
                  const files = Array.from(event.target.files ?? []);
                  event.currentTarget.value = "";
                  for (const file of files) await uploadImage(file);
                }}
              />
            </label>
            <button
              type="button"
              onClick={() => setTrayOpen((open) => !open)}
              disabled={!canEdit}
              className="flex items-center gap-1 rounded px-2 py-1 text-[11px] text-muted-strong hover:bg-ink-800 hover:text-foreground disabled:opacity-40"
              title="Toggle the asset tray"
            >
              Library
            </button>

            <div className="ml-auto flex items-center gap-2">
              {renderedUrl && (
                <button
                  type="button"
                  onClick={() => clearRendered(side)}
                  className="flex items-center gap-1 text-[10px] text-muted hover:text-red-400"
                  title="Remove the rendered PNG for this side"
                >
                  <Trash2 className="size-3" /> Rendered
                </button>
              )}
              <Badge tone={renderedUrl ? "sage" : "neutral"}>
                {renderedUrl ? "In exports" : "Not exported yet"}
              </Badge>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_50%_10%,rgba(200,129,74,0.06),transparent_60%)] px-4 py-5">
            <div className="mx-auto w-full max-w-[620px]">
              <CoverCanvas
                sideDoc={sideDoc}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onMove={(id, x, y) =>
                  setDoc((current) => ({
                    ...current,
                    [side]: {
                      ...current[side],
                      layers: current[side].layers.map((layer) =>
                        layer.id === id ? { ...layer, x, y } : layer,
                      ),
                    },
                  }))
                }
                onCommit={scheduleSave}
                onRequestEdit={(id) => setSelectedId(id)}
                onDropFiles={(files, point) => {
                  void (async () => {
                    for (const [index, file] of files.entries()) {
                      await uploadImage(file, {
                        point: index === 0 ? point : { x: point.x + index * 0.04, y: point.y + index * 0.04 },
                      });
                    }
                  })();
                }}
                readOnly={!canEdit}
              />
              <p className="mt-3 text-center text-[10px] uppercase tracking-[0.16em] text-muted/70">
                Drag to position · click to select · 1600 × 2400 (exports at 2×)
              </p>
            </div>
          </div>
        </div>

        {/* ---------------------------------------------------------- inspector */}
        <CoverInspector
          sideDoc={sideDoc}
          selected={selected}
          selectedId={selectedId}
          onSelectLayer={setSelectedId}
          onUploadImage={(file) => {
            const target = selected?.type === "image" ? selected.id : undefined;
            void uploadImage(file, { replaceId: target });
          }}
          onPatchLayer={patchLayer}
          onPatchBackground={(patch) =>
            updateSide((current) => ({ ...current, background: { ...current.background, ...patch } }))
          }
          onDelete={() => {
            if (!selectedId) return;
            updateSide((current) => ({
              ...current,
              layers: current.layers.filter((l) => l.id !== selectedId),
            }));
            setSelectedId(null);
          }}
          onDuplicate={duplicateSelected}
          onMoveLayerOrder={moveOrder}
          onUseBackground={(url) => {
            updateSide((current) => ({
              ...current,
              background: { ...current.background, kind: "image", imageUrl: url },
            }));
          }}
          className="hidden w-[286px] shrink-0 xl:flex"
        />
      </div>

      {/* ------------------------------------------------------ mobile inspector */}
      {selected && (
        <div className="xl:hidden">
          <CoverInspector
            sideDoc={sideDoc}
            selected={selected}
            selectedId={selectedId}
            onSelectLayer={setSelectedId}
            onUploadImage={(file) => {
              const target = selected?.type === "image" ? selected.id : undefined;
              void uploadImage(file, { replaceId: target });
            }}
            onPatchLayer={patchLayer}
            onPatchBackground={(patch) =>
              updateSide((current) => ({ ...current, background: { ...current.background, ...patch } }))
            }
            onDelete={() => {
              updateSide((current) => ({
                ...current,
                layers: current.layers.filter((l) => l.id !== selectedId),
              }));
              setSelectedId(null);
            }}
            onDuplicate={duplicateSelected}
            onMoveLayerOrder={moveOrder}
            onUseBackground={(url) => {
              updateSide((current) => ({
                ...current,
                background: { ...current.background, kind: "image", imageUrl: url },
              }));
            }}
            className="max-h-[45vh] border-t border-l-0"
          />
        </div>
      )}

      {!canEdit && (
        <p className="border-t border-border bg-ink-900/70 px-4 py-2 text-[11px] text-muted">
          You have view-only access to this project, so the cover cannot be edited.
        </p>
      )}
    </div>
  );
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("Could not read the rendered cover."));
    reader.readAsDataURL(blob);
  });
}
