"use client";

import * as React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import "tldraw/tldraw.css";
import type {
  Editor,
  TLAsset,
  TLAssetId,
  TLEditorSnapshot,
  TLImageShape,
  TLNoteShape,
  TLShapePartial,
} from "tldraw";
import {
  ArrowLeft,
  Check,
  CloudOff,
  Eye,
  Loader2,
  PanelRight,
  Scissors,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { renameCanvas, saveCanvasContent, uploadCanvasImage } from "@/lib/actions/canvas";
import { encodePreview, normalizeSnapshot, plainRichText, shapeText } from "./canvas-preview";
import { AssetDrawer, ASSET_DRAG_TYPE, type CanvasAsset, type DraggedAsset } from "./asset-drawer";
import { ClipDialog, type ClipPayload } from "./clip-dialog";

const Tldraw = dynamic(async () => (await import("tldraw")).Tldraw, {
  ssr: false,
  loading: () => <BoardSkeleton />,
});

export interface BoardCanvas {
  id: string;
  name: string;
  content: unknown;
  updated_at: string;
}

type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

const SAVE_DEBOUNCE = 1500;

function BoardSkeleton() {
  return (
    <div className="flex size-full flex-col items-center justify-center gap-3 bg-ink-900">
      <Loader2 className="size-5 animate-spin text-accent" />
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Preparing the board</p>
    </div>
  );
}

function selectionPayload(editor: Editor): ClipPayload {
  const shapes = editor.getSelectedShapes();
  const blocks: string[] = [];
  for (const shape of shapes) {
    const text = shapeText(shape.props as Record<string, unknown>);
    if (text) blocks.push(text);
  }
  return { text: blocks.join("\n\n"), shapeCount: shapes.length };
}

export function CanvasBoard({
  projectId,
  projectTitle,
  canvas,
  assets,
  chapters,
  canEdit,
}: {
  projectId: string;
  projectTitle: string;
  canvas: BoardCanvas;
  assets: CanvasAsset[];
  chapters: { id: string; title: string }[];
  canEdit: boolean;
}) {
  const boardPath = `/app/projects/${projectId}/canvas`;

  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const editorRef = React.useRef<Editor | null>(null);
  const unsubscribe = React.useRef<(() => void) | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = React.useRef(false);
  const viewportDirty = React.useRef(false);
  const inFlight = React.useRef(false);

  const [mounted, setMounted] = React.useState(false);
  const [name, setName] = React.useState(canvas.name);
  const [committedName, setCommittedName] = React.useState(canvas.name);
  const [saveState, setSaveState] = React.useState<SaveState>("idle");
  const [savedAt, setSavedAt] = React.useState<string>(canvas.updated_at);
  const [selection, setSelection] = React.useState<ClipPayload>({ text: "", shapeCount: 0 });
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [clipOpen, setClipOpen] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  const persist = React.useCallback(
    async (force = false) => {
      const editor = editorRef.current;
      if (!editor || !canEdit) return;
      if (!dirty.current && !force) return;
      if (inFlight.current) return;

      dirty.current = false;
      viewportDirty.current = false;
      inFlight.current = true;
      setSaveState("saving");

      try {
        const snapshot = editor.getSnapshot();
        const preview = encodePreview(snapshot);
        const result = await saveCanvasContent(canvas.id, snapshot, preview);
        if (result.ok) {
          setSaveState("saved");
          setSavedAt(result.data.savedAt);
        } else {
          setSaveState("error");
        }
      } catch {
        setSaveState("error");
      } finally {
        inFlight.current = false;
      }

      // Edits that landed mid-flight must not be dropped.
      if (dirty.current) {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => {
          timer.current = null;
          void persist();
        }, SAVE_DEBOUNCE);
      }
    },
    [canEdit, canvas.id],
  );

  const scheduleSave = React.useCallback(() => {
    dirty.current = true;
    setSaveState((state) => (state === "saving" ? state : "dirty"));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      void persist();
    }, SAVE_DEBOUNCE);
  }, [persist]);

  const handleMount = React.useCallback(
    (editor: Editor) => {
      editorRef.current = editor;
      editor.user.updateUserPreferences({ colorScheme: "dark" });

      const snapshot = normalizeSnapshot(canvas.content);
      if (snapshot) {
        try {
          editor.loadSnapshot(snapshot as Partial<TLEditorSnapshot>);
        } catch {
          // A corrupt snapshot should never block the editor — start from a blank board.
          toast.error("This canvas could not be restored. Starting with a blank board.");
        }
      }

      if (!canEdit) {
        editor.updateInstanceState({ isReadonly: true });
        setSaveState("idle");
        return;
      }

      const updateSelection = () => setSelection(selectionPayload(editor));

      const stopDocument = editor.store.listen(
        () => {
          updateSelection();
          scheduleSave();
        },
        { scope: "document", source: "user" },
      );
      // Selection changes are session state, so they need their own listener.
      const stopSelection = editor.store.listen(updateSelection, { source: "user" });
      // Camera changes are session state too — persist the viewport quietly.
      const stopViewport = editor.store.listen(
        () => {
          viewportDirty.current = true;
          if (viewTimer.current) clearTimeout(viewTimer.current);
          viewTimer.current = setTimeout(() => {
            viewTimer.current = null;
            void persist(true);
          }, 4000);
        },
        { scope: "session", source: "user" },
      );

      unsubscribe.current = () => {
        stopDocument();
        stopSelection();
        stopViewport();
      };
    },
    [canEdit, canvas.content, scheduleSave, persist],
  );

  // Flush on ⌘S / Ctrl+S.
  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (!canEdit) return;
        void persist(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canEdit, persist]);

  // Flush on unmount, tab hide and page unload.
  React.useEffect(() => {
    const flush = () => {
      if (!dirty.current && !viewportDirty.current) return;
      if (timer.current) clearTimeout(timer.current);
      if (viewTimer.current) clearTimeout(viewTimer.current);
      timer.current = null;
      viewTimer.current = null;
      void persist(true);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };

    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
      if (timer.current) clearTimeout(timer.current);
      if (viewTimer.current) clearTimeout(viewTimer.current);
      flush();
      unsubscribe.current?.();
      unsubscribe.current = null;
    };
  }, [persist]);

  // Escape closes the drawer before anything else.
  React.useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const commitName = React.useCallback(async () => {
    const next = name.replace(/\s+/g, " ").trim();
    if (!next) {
      setName(committedName);
      return;
    }
    if (next === committedName) {
      setName(committedName);
      return;
    }
    try {
      const result = await renameCanvas(canvas.id, next);
      if (!result.ok) {
        setName(committedName);
        toast.error(result.error);
        return;
      }
      setCommittedName(result.data.name);
      setName(result.data.name);
    } catch {
      setName(committedName);
      toast.error("Could not rename the canvas.");
    }
  }, [canvas.id, committedName, name]);

  const insertImage = React.useCallback(
    async (asset: DraggedAsset, point: { x: number; y: number }) => {
      const editor = editorRef.current;
      if (!editor) return;
      if (!canEdit) {
        toast.error("This canvas is view only.");
        return;
      }

      const { AssetRecordType, createShapeId } = await import("tldraw");
      const naturalWidth = asset.w > 0 ? asset.w : 420;
      const naturalHeight = asset.h > 0 ? asset.h : Math.round(naturalWidth * 0.66);
      const scale = Math.min(1, 520 / naturalWidth);
      const w = Math.max(32, Math.round(naturalWidth * scale));
      const h = Math.max(32, Math.round(naturalHeight * scale));

      const assetId = AssetRecordType.createId() as TLAssetId;
      const record: TLAsset = {
        id: assetId,
        type: "image",
        typeName: "asset",
        props: {
          name: asset.name,
          src: asset.url,
          w: naturalWidth,
          h: naturalHeight,
          mimeType: asset.mimeType || null,
          isAnimated: false,
        },
        meta: {},
      };

      editor.createAssets([record]);
      const partial = {
        id: createShapeId(),
        type: "image",
        x: Math.round(point.x - w / 2),
        y: Math.round(point.y - h / 2),
        props: { assetId, w, h },
      } as unknown as TLShapePartial<TLImageShape>;

      editor.createShapes([partial]);
      editor.setCurrentTool("select");
    },
    [canEdit],
  );

  // Capture phase: tldraw also listens for drops, and we want asset drags first.
  React.useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const onDragOver = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes(ASSET_DRAG_TYPE)) return;
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "copy";
    };

    const onDrop = (event: DragEvent) => {
      const raw = event.dataTransfer?.getData(ASSET_DRAG_TYPE);
      if (!raw) return;
      event.preventDefault();
      event.stopPropagation();

      const editor = editorRef.current;
      if (!editor) return;

      let asset: DraggedAsset;
      try {
        asset = JSON.parse(raw) as DraggedAsset;
      } catch {
        return;
      }
      if (!asset?.url) return;

      const rect = host.getBoundingClientRect();
      const point = editor.screenToPage({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
      void insertImage(asset, point);
    };

    host.addEventListener("dragover", onDragOver, true);
    host.addEventListener("drop", onDrop, true);
    return () => {
      host.removeEventListener("dragover", onDragOver, true);
      host.removeEventListener("drop", onDrop, true);
    };
  }, [insertImage]);

  const handleAddNote = React.useCallback(async () => {
    const editor = editorRef.current;
    const host = hostRef.current;
    if (!editor || !host) return;
    if (!canEdit) {
      toast.error("This canvas is view only.");
      return;
    }

    const { createShapeId } = await import("tldraw");
    const point = editor.screenToPage({ x: host.clientWidth / 2, y: host.clientHeight / 2 });
    const partial = {
      id: createShapeId(),
      type: "note",
      x: Math.round(point.x - 110),
      y: Math.round(point.y - 90),
      props: { richText: plainRichText("New note"), color: "yellow" },
    } as unknown as TLShapePartial<TLNoteShape>;

    editor.createShapes([partial]);
    editor.setCurrentTool("select");
  }, [canEdit]);

  const handleAddImage = React.useCallback(
    async (file: File) => {
      const editor = editorRef.current;
      const host = hostRef.current;
      if (!editor || !host) return;
      if (!canEdit) {
        toast.error("This canvas is view only.");
        return;
      }

      setUploading(true);
      try {
        const size = await new Promise<{ w: number; h: number }>((resolve) => {
          const img = new Image();
          const url = URL.createObjectURL(file);
          img.onload = () => {
            resolve({ w: img.naturalWidth, h: img.naturalHeight });
            URL.revokeObjectURL(url);
          };
          img.onerror = () => {
            resolve({ w: 0, h: 0 });
            URL.revokeObjectURL(url);
          };
          img.src = url;
        });

        const formData = new FormData();
        formData.set("projectId", projectId);
        formData.set("file", file);
        formData.set("w", String(size.w));
        formData.set("h", String(size.h));

        const result = await uploadCanvasImage(formData);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }

        const point = editor.screenToPage({ x: host.clientWidth / 2, y: host.clientHeight / 2 });
        await insertImage(
          {
            url: result.data.url,
            w: result.data.w || size.w,
            h: result.data.h || size.h,
            name: result.data.name,
            mimeType: result.data.mimeType,
          },
          point,
        );
        toast.success("Image added to canvas");
      } catch {
        toast.error("Could not add that image.");
      } finally {
        setUploading(false);
      }
    },
    [canEdit, insertImage, projectId],
  );

  const openClip = React.useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const payload = selectionPayload(editor);
    if (!payload.shapeCount) {
      toast.error("Select something on the canvas first.");
      return;
    }
    setSelection(payload);
    setClipOpen(true);
  }, []);

  const saveLabel =
    saveState === "error"
      ? "Save failed — ⌘S to retry"
      : saveState === "saving"
        ? "Saving…"
        : saveState === "dirty"
          ? "Unsaved changes"
          : "Snapshot saved";

  const savedTime = mounted && savedAt
    ? new Date(savedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : null;
  const savedPrefix = canEdit ? "Snapshot saved" : "Last saved";

  return (
    <div className="inkwell-board fixed inset-y-0 left-0 right-0 z-30 flex flex-col overflow-hidden bg-background md:left-[268px]">
      <style>{`
        .inkwell-board .tl-theme__dark {
          --color-background: #12100e;
          --color-panel: #17140f;
          --color-panel-contrast: #1e1a16;
          --color-panel-overlay: rgba(18,16,14,0.94);
          --color-low: #1e1a16;
          --color-low-border: #2a2520;
          --color-divider: #2a2520;
          --color-text: #efe6d9;
          --color-text-0: #efe6d9;
          --color-text-1: #d9cbbb;
          --color-text-3: #91806d;
          --color-text-shadow: #12100e;
          --color-hint: rgba(255, 255, 255, 0.07);
          --color-muted-none: rgba(255, 255, 255, 0);
          --color-muted-0: rgba(255, 255, 255, 0.02);
          --color-muted-1: rgba(255, 255, 255, 0.07);
          --color-muted-2: rgba(255, 255, 255, 0.04);
          --color-culled: #1b1713;
          --color-panel-transparent: rgba(23, 20, 15, 0);
          --color-overlay: rgba(0, 0, 0, 0.5);
          --color-grid: #26211c;
          --color-selected: #c8814a;
          --color-selected-contrast: #12100e;
          --color-selection-fill: rgba(200,129,74,0.10);
          --color-selection-stroke: #c8814a;
          --color-focus: #c8814a;
          --color-primary: #c8814a;
          --color-brush-fill: rgba(200,129,74,0.12);
          --color-brush-stroke: rgba(200,129,74,0.4);
          --color-snap: #c8814a;
          --color-info: #6f93ba;
          color-scheme: dark;
        }
        .inkwell-board .tlui-layout__top { padding-top: 64px; }
        .inkwell-board .tlui-layout__bottom__main { padding-bottom: 4px; }
        .inkwell-board .tl-container {
          font-family: var(--font-inter), ui-sans-serif, system-ui, -apple-system, sans-serif;
        }
        @media (max-width: 640px) {
          .inkwell-board .tlui-layout__top { padding-top: 104px; }
        }
      `}</style>

      <div
        ref={hostRef}
        className="relative h-full min-h-0 w-full flex-1 overflow-hidden"
      >
        <Tldraw
          onMount={handleMount}
          className="absolute inset-0"
          options={{ maxPages: 1 }}
        />

        {/* Floating chrome — generous padding, never blocks the canvas underneath. */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] flex flex-wrap items-start justify-between gap-2 p-3 md:p-4">
          <div className="pointer-events-auto flex min-w-0 items-center gap-1.5 rounded-lg border border-border-strong bg-ink-900/90 p-1.5 pl-1 shadow-lg backdrop-blur-md">
            <Link
              href={boardPath}
              aria-label="Back to canvases"
              title="Back to canvases"
              className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-ink-800 hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <div className="hidden h-5 w-px shrink-0 bg-border sm:block" />
            <div className="min-w-0">
              <div className="hidden items-center gap-1 px-1 text-[10px] uppercase tracking-[0.14em] text-muted sm:flex">
                <Link href={`/app/projects/${projectId}`} className="truncate transition hover:text-muted-strong">
                  {projectTitle}
                </Link>
                <span className="text-muted/50">/</span>
                <span>Canvas</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  onBlur={() => void commitName()}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      event.currentTarget.blur();
                    }
                    if (event.key === "Escape") {
                      setName(committedName);
                      event.currentTarget.blur();
                    }
                  }}
                  readOnly={!canEdit}
                  maxLength={120}
                  aria-label="Canvas name"
                  style={{ width: `${Math.min(38, Math.max(10, name.length + 1))}ch` }}
                  className="min-w-0 max-w-[240px] truncate rounded-sm bg-transparent px-1 py-0.5 font-serif text-[15px] text-foreground outline-none transition hover:bg-ink-850/70 focus:bg-ink-850 focus:ring-1 focus:ring-accent/50 md:max-w-[320px]"
                />
                <span
                  role="status"
                  aria-live="polite"
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px]",
                    saveState === "error"
                      ? "border-red-800/60 bg-red-950/40 text-red-300"
                      : saveState === "saved" || saveState === "idle"
                        ? "border-border text-muted"
                        : "border-accent/30 bg-accent/10 text-accent-soft",
                  )}
                  title={saveLabel}
                >
                  {saveState === "saving" ? (
                    <Loader2 className="size-2.5 animate-spin" />
                  ) : saveState === "error" ? (
                    <CloudOff className="size-2.5" />
                  ) : saveState === "dirty" ? (
                    <span className="size-1.5 rounded-full bg-accent-soft" />
                  ) : (
                    <Check className="size-2.5 text-sage" />
                  )}
                  <span className="hidden whitespace-nowrap sm:inline">
                    {saveState === "saved" || saveState === "idle"
                      ? savedTime
                        ? `${savedPrefix} ${savedTime}`
                        : savedPrefix
                      : saveLabel}
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div className="pointer-events-none absolute left-1/2 top-4 hidden -translate-x-1/2 xl:block">
            <span className="rounded-full border border-border/60 bg-ink-900/50 px-2.5 py-1 text-[10px] text-muted/80 backdrop-blur-sm">
              Space + drag to pan · ⌘S saves
            </span>
          </div>

          <div className="pointer-events-auto flex items-center gap-1.5">
            {!canEdit && (
              <span className="flex items-center gap-1.5 rounded-lg border border-plum/40 bg-plum/15 px-2.5 py-1.5 text-[11px] text-plum backdrop-blur-md">
                <Eye className="size-3.5" /> View only
              </span>
            )}
            {canEdit && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={openClip}
                  disabled={selection.shapeCount === 0}
                  className="bg-ink-900/90 backdrop-blur-md disabled:opacity-60"
                  title={selection.shapeCount ? "Clip selection to the project" : "Select shapes first"}
                >
                  <Scissors />
                  <span className="hidden sm:inline">
                    Clip to project{selection.shapeCount ? ` (${selection.shapeCount})` : ""}
                  </span>
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setDrawerOpen((open) => !open)}
                  aria-pressed={drawerOpen}
                  className={cn(
                    "bg-ink-900/90 backdrop-blur-md",
                    drawerOpen && "border-accent/50 text-accent-soft",
                  )}
                >
                  <PanelRight />
                  <span className="hidden sm:inline">Assets</span>
                </Button>
              </>
            )}
          </div>
        </div>

        {canEdit && (
          <>
            <AssetDrawer
              open={drawerOpen}
              onClose={() => setDrawerOpen(false)}
              assets={assets}
              onAddImage={handleAddImage}
              onAddNote={handleAddNote}
              onInsert={(asset) => {
                const editor = editorRef.current;
                const host = hostRef.current;
                if (!editor || !host) return;
                void insertImage(
                  asset,
                  editor.screenToPage({ x: host.clientWidth / 2, y: host.clientHeight / 2 }),
                );
              }}
              uploading={uploading}
            />
          </>
        )}
      </div>

      {canEdit && (
        <ClipDialog
          open={clipOpen}
          onOpenChange={setClipOpen}
          canvasId={canvas.id}
          canvasName={committedName}
          chapters={chapters}
          selection={selection}
        />
      )}
    </div>
  );
}
