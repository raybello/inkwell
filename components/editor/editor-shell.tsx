"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
import {
  Focus,
  Info,
  Loader2,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  PanelLeft,
  PanelRight,
  Search,
  Trash2,
  Type,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Dropdown, DropdownItem, DropdownLabel, DropdownSeparator } from "@/components/ui/dropdown";
import { createChapterAction, deleteChapterAction, renameChapterAction, reorderChaptersAction, updateChapterSynopsisAction } from "@/lib/actions/chapters";
import { listChapterVersionsAction } from "@/lib/actions/versions";
import { buildExtensions } from "@/lib/editor/extensions";
import { SearchHighlight } from "@/lib/editor/search-highlight";
import { addDailyWords, readDailyWords } from "@/lib/editor/daily-goal";
import { useChapterCollab } from "@/lib/collab/use-chapter-collab";
import { cn, formatNumber, readingTime } from "@/lib/utils";
import type { ChapterStatus } from "@/lib/types";
import { ChapterRail } from "./chapter-rail";
import { EditorSidePanel, type SidePanelTab } from "./side-panel";
import { EditorToolbar } from "./editor-toolbar";
import { StatusPill } from "./status-pill";
import { WordGoalRing } from "./word-goal-ring";
import { PresenceAvatars } from "./presence-row";
import { useChapterAutosave, type SaveState } from "./use-autosave";
import { useTypewriterScroll } from "./use-typewriter-scroll";
import { FindReplaceDialog } from "./find-replace-dialog";
import { ImageDialog, LinkDialog, type ImageInsertPayload, type LinkPayload } from "./insert-dialogs";
import { ChapterDetailsDialog, DeleteChapterDialog, RenameChapterDialog } from "./chapter-dialogs";
import type { AssetOption, ChapterListItem, EditorUser, VersionItem } from "./types";

function normalizeDoc(content: unknown) {
  if (content && typeof content === "object" && (content as { type?: string }).type === "doc") return content;
  return { type: "doc", content: [{ type: "paragraph" }] };
}

function formatClock(timestamp: number | null) {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function SaveIndicator({ state, savedAt, error }: { state: SaveState; savedAt: number | null; error: string | null }) {
  if (state === "error") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-red-400" title={error ?? undefined}>
        <span className="size-1.5 rounded-full bg-red-500" /> Not saved
      </span>
    );
  }
  if (state === "saving") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
        <Loader2 className="size-3 animate-spin" /> Saving…
      </span>
    );
  }
  if (state === "dirty") {
    return <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">Unsaved changes</span>;
  }
  if (state === "saved" && savedAt) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-sage">
        <span className="size-1.5 rounded-full bg-sage" /> Saved {formatClock(savedAt)}
      </span>
    );
  }
  return <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">All changes saved</span>;
}

export function EditorShell({
  projectId,
  chapter,
  chapters: initialChapters,
  assets,
  versions: initialVersions,
  user,
  canEdit,
  dailyGoal,
}: {
  projectId: string;
  chapter: ChapterListItem & { content: unknown; content_md?: string };
  chapters: ChapterListItem[];
  assets: AssetOption[];
  versions: VersionItem[];
  user: EditorUser;
  canEdit: boolean;
  dailyGoal: number;
}) {
  const router = useRouter();

  const [chapters, setChapters] = React.useState<ChapterListItem[]>(initialChapters);
  const [title, setTitle] = React.useState(chapter.title);
  const [status, setStatus] = React.useState<ChapterStatus>(chapter.status);
  const [synopsis, setSynopsis] = React.useState(chapter.synopsis ?? "");
  const [panelTab, setPanelTab] = React.useState<SidePanelTab>("versions");
  const [focused, setFocused] = React.useState(false);
  const [typewriter, setTypewriter] = React.useState(false);
  const [railOpen, setRailOpen] = React.useState(false);
  const [panelOpen, setPanelOpen] = React.useState(false);
  const [findOpen, setFindOpen] = React.useState(false);
  const [imageOpen, setImageOpen] = React.useState(false);
  const [linkOpen, setLinkOpen] = React.useState(false);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [renameTarget, setRenameTarget] = React.useState<ChapterListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<ChapterListItem | null>(null);
  const [busy, setBusy] = React.useState<"rename" | "delete" | "details" | null>(null);
  const [versions, setVersions] = React.useState<VersionItem[]>(initialVersions);
  const [versionsLoading, setVersionsLoading] = React.useState(false);

  const [liveWords, setLiveWords] = React.useState(chapter.word_count);
  const [liveChars, setLiveChars] = React.useState(chapter.content_md?.length ?? 0);
  const [dailyWords, setDailyWords] = React.useState(0);

  const editorRef = React.useRef<Editor | null>(null);
  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const prevWordsRef = React.useRef(chapter.word_count);
  const savedTitleRef = React.useRef(chapter.title);
  const bootedAtRef = React.useRef(0);
  const focusedRef = React.useRef(focused);
  focusedRef.current = focused;

  const collab = useChapterCollab({
    chapterId: chapter.id,
    user,
    initialContent: chapter.content,
    enabled: true,
  });
  // Latch collaboration on once it has connected: if the channel later drops we
  // must keep editing the same Yjs document rather than rebuild the editor.
  const [collabLatched, setCollabLatched] = React.useState(false);
  React.useEffect(() => {
    if (collab.status === "ready" && collab.awareness) setCollabLatched(true);
  }, [collab.status, collab.awareness]);
  const collabMode = collabLatched && !!collab.awareness;

  const autosave = useChapterAutosave({
    projectId,
    chapterId: chapter.id,
    enabled: canEdit,
    delay: 1200,
    getContent: () => {
      try {
        return editorRef.current ? editorRef.current.getJSON() : null;
      } catch {
        return null;
      }
    },
    onSaved: (receipt) => {
      setChapters((current) =>
        current.map((item) =>
          item.id === chapter.id ? { ...item, word_count: receipt.wordCount, updated_at: receipt.updatedAt } : item,
        ),
      );
    },
  });
  const flushRef = React.useRef(autosave.flush);
  flushRef.current = autosave.flush;

  const recordWords = React.useCallback(
    (next: number) => {
      if (!canEdit) return;
      const delta = next - prevWordsRef.current;
      prevWordsRef.current = next;
      if (delta > 0) {
        const total = addDailyWords(projectId, delta);
        setDailyWords(total);
      }
    },
    [canEdit, projectId],
  );

  const handleEditorUpdate = React.useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const words = editor.storage.characterCount.words() as number;
    const chars = editor.storage.characterCount.characters() as number;
    setLiveWords(words);
    setLiveChars(chars);

    if (Date.now() - bootedAtRef.current < 450) return;
    recordWords(words);
    autosave.schedule();
  }, [autosave, recordWords]);

  const extensions = React.useMemo(() => {
    if (collabMode) {
      return [
        ...buildExtensions({ placeholder: "Begin where the story left off…", collab: true }),
        SearchHighlight,
        Collaboration.configure({ document: collab.ydoc, field: "default" }),
        CollaborationCursor.configure({
          provider: { awareness: collab.awareness },
          user: { name: user.name, color: user.color },
          render: (cursorUser: Record<string, unknown>) => {
            const color = typeof cursorUser.color === "string" ? cursorUser.color : "#c8814a";
            const name = typeof cursorUser.name === "string" ? cursorUser.name : "Writer";
            const caret = document.createElement("span");
            caret.className = "collaboration-cursor__caret";
            caret.style.borderLeft = `2px solid ${color}`;
            caret.style.marginLeft = "-1px";
            caret.style.marginRight = "-1px";
            caret.style.position = "relative";
            caret.style.pointerEvents = "none";
            caret.style.wordBreak = "normal";
            const label = document.createElement("div");
            label.textContent = name;
            label.style.position = "absolute";
            label.style.bottom = "100%";
            label.style.left = "-2px";
            label.style.backgroundColor = color;
            label.style.color = "#1b1611";
            label.style.fontFamily = "var(--font-sans), sans-serif";
            label.style.fontSize = "10px";
            label.style.fontWeight = "600";
            label.style.lineHeight = "1.4";
            label.style.padding = "1px 5px";
            label.style.borderRadius = "3px";
            label.style.whiteSpace = "nowrap";
            label.style.userSelect = "none";
            caret.appendChild(label);
            return caret;
          },
          selectionRender: (cursorUser: Record<string, unknown>) => ({
            nodeName: "span",
            class: "collaboration-cursor__selection",
            style: `background-color: ${typeof cursorUser.color === "string" ? cursorUser.color : "#c8814a"}33;`,
          }),
        }),
      ];
    }
    return [...buildExtensions({ placeholder: "Begin where the story left off…" }), SearchHighlight];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collabMode, collab.ydoc, collab.awareness, user.name, user.color]);

  const editor = useEditor(
    {
      immediatelyRender: false,
      editable: canEdit,
      extensions,
      content: collabMode ? undefined : normalizeDoc(chapter.content),
      editorProps: {
        attributes: {
          class: "ink-prose outline-none",
          spellcheck: "true",
          "aria-label": "Chapter body",
        },
      },
      onCreate: ({ editor: instance }) => {
        bootedAtRef.current = Date.now();
        const words = instance.storage.characterCount.words() as number;
        const chars = instance.storage.characterCount.characters() as number;
        setLiveWords(words);
        setLiveChars(chars);
        prevWordsRef.current = words;
      },
      onUpdate: handleEditorUpdate,
      onBlur: () => {
        if (canEdit) void flushRef.current();
      },
    },
    [collabMode, chapter.id, canEdit],
  );

  editorRef.current = editor;

  useTypewriterScroll({ editor, containerRef: scrollRef, enabled: typewriter });

  // daily words + typewriter preference are browser-local
  React.useEffect(() => {
    setDailyWords(readDailyWords(projectId));
    try {
      setTypewriter(window.localStorage.getItem("inkwell:typewriter") === "1");
    } catch {
      // ignore
    }
  }, [projectId]);

  const toggleTypewriter = React.useCallback(() => {
    setTypewriter((current) => {
      const next = !current;
      try {
        window.localStorage.setItem("inkwell:typewriter", next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  // bridge to the comments panel: selection → thread, and thread → selection
  const requestComment = React.useCallback(() => {
    const instance = editorRef.current;
    if (!instance) return;
    const { from, to } = instance.state.selection;
    const text = from === to ? "" : instance.state.doc.textBetween(from, to, " ");
    setPanelTab("comments");
    window.dispatchEvent(
      new CustomEvent("inkwell:comment-request", { detail: { text, from, to } }),
    );
  }, []);

  React.useEffect(() => {
    const onFocusAnchor = (event: Event) => {
      const detail = (event as CustomEvent<{ from?: number; to?: number }>).detail;
      const instance = editorRef.current;
      if (!instance) return;
      if (typeof detail?.from !== "number" || typeof detail?.to !== "number") return;
      const max = instance.state.doc.content.size;
      const from = Math.min(Math.max(1, detail.from), Math.max(1, max - 1));
      const to = Math.min(Math.max(from, detail.to), max);
      instance.chain().focus().setTextSelection({ from, to }).scrollIntoView().run();
    };
    window.addEventListener("inkwell:comment-focus", onFocusAnchor);
    return () => window.removeEventListener("inkwell:comment-focus", onFocusAnchor);
  }, []);

  // global shortcuts: save, find, focus, escape, link
  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      const editor = editorRef.current;
      const claim = () => {
        event.preventDefault();
        // The app shell binds ⌘K to the command palette; inside the editor the
        // same chord belongs to "add link", so stop the event here.
        event.stopPropagation();
        event.stopImmediatePropagation();
      };
      if (mod && event.key.toLowerCase() === "s") {
        claim();
        void flushRef.current();
        return;
      }
      if (mod && event.key.toLowerCase() === "f") {
        claim();
        setFindOpen(true);
        return;
      }
      if (mod && event.key.toLowerCase() === "k" && editor && canEdit) {
        claim();
        setLinkOpen(true);
        return;
      }
      if (mod && event.shiftKey && event.key.toLowerCase() === "m") {
        claim();
        requestComment();
        return;
      }
      if (mod && event.key === "Enter") {
        claim();
        setFocused((value) => !value);
        return;
      }
      if (event.key === "Escape" && focusedRef.current) {
        setFocused(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [canEdit]);

  // Closing the drawer when the viewport grows avoids hidden duplicate chrome.
  React.useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      if (query.matches) {
        setRailOpen(false);
        setPanelOpen(false);
      }
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const refreshVersions = React.useCallback(async () => {
    setVersionsLoading(true);
    const result = await listChapterVersionsAction(chapter.id);
    setVersionsLoading(false);
    if (result.ok) {
      setVersions(result.data.map((item) => ({ ...item, kind: item.kind as "auto" | "manual" })));
    }
  }, [chapter.id]);

  const handlePanelTab = React.useCallback(
    (next: SidePanelTab) => {
      setPanelTab(next);
      if (next === "versions") void refreshVersions();
    },
    [refreshVersions],
  );

  const applyExternalContent = React.useCallback(
    (content: unknown, wordCount: number) => {
      const instance = editorRef.current;
      if (!instance) return;
      instance.commands.setContent(normalizeDoc(content) as never, false);
      setLiveWords(wordCount);
      prevWordsRef.current = wordCount;
    },
    [],
  );

  const saveTitle = React.useCallback(
    async (next: string) => {
      const trimmed = next.trim() || "Untitled Chapter";
      if (trimmed === savedTitleRef.current) return;
      const previous = savedTitleRef.current;
      setTitle(trimmed);
      setChapters((current) => current.map((item) => (item.id === chapter.id ? { ...item, title: trimmed } : item)));
      const result = await renameChapterAction(projectId, chapter.id, trimmed);
      if (!result.ok) {
        setTitle(previous);
        setChapters((current) => current.map((item) => (item.id === chapter.id ? { ...item, title: previous } : item)));
        toast.error(result.error);
        return;
      }
      savedTitleRef.current = result.data.title;
    },
    [chapter.id, projectId],
  );

  const handleAddChapter = React.useCallback(async () => {
    await flushRef.current();
    const result = await createChapterAction(projectId, {
      title: `Chapter ${chapters.length + 1}`,
      afterChapterId: chapter.id,
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Chapter added.");
    router.push(`/app/projects/${projectId}/editor/${result.data.id}`);
  }, [chapter.id, chapters.length, projectId, router]);

  const handleRename = React.useCallback(
    async (target: ChapterListItem | null, nextTitle: string) => {
      if (!target) return;
      setBusy("rename");
      const result = await renameChapterAction(projectId, target.id, nextTitle);
      setBusy(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setChapters((current) =>
        current.map((item) => (item.id === target.id ? { ...item, title: result.data.title } : item)),
      );
      if (target.id === chapter.id) {
        setTitle(result.data.title);
        savedTitleRef.current = result.data.title;
      }
      setRenameTarget(null);
      toast.success("Chapter renamed.");
    },
    [chapter.id, projectId],
  );

  const handleDelete = React.useCallback(async () => {
    if (!deleteTarget) return;
    setBusy("delete");
    const result = await deleteChapterAction(projectId, deleteTarget.id);
    setBusy(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const remaining = chapters.filter((item) => item.id !== deleteTarget.id);
    setChapters(remaining);
    setDeleteTarget(null);
    toast.success("Chapter deleted.");
    if (deleteTarget.id === chapter.id) {
      const next = remaining[0];
      router.push(next ? `/app/projects/${projectId}/editor/${next.id}` : `/app/projects/${projectId}`);
    }
  }, [chapter.id, chapters, deleteTarget, projectId, router]);

  const handleMove = React.useCallback(
    async (target: ChapterListItem, direction: -1 | 1) => {
      const index = chapters.findIndex((item) => item.id === target.id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= chapters.length) return;
      const next = [...chapters];
      const [moved] = next.splice(index, 1);
      next.splice(nextIndex, 0, moved);
      setChapters(next);
      const result = await reorderChaptersAction(projectId, next.map((item) => item.id));
      if (!result.ok) {
        setChapters(chapters);
        toast.error(result.error);
      }
    },
    [chapters, projectId],
  );

  const handleDetailsSave = React.useCallback(
    async (value: string) => {
      setBusy("details");
      const result = await updateChapterSynopsisAction(projectId, chapter.id, value);
      setBusy(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setSynopsis(result.data.synopsis);
      setChapters((current) =>
        current.map((item) => (item.id === chapter.id ? { ...item, synopsis: result.data.synopsis } : item)),
      );
      setDetailsOpen(false);
      toast.success("Synopsis saved.");
    },
    [chapter.id, projectId],
  );

  const insertImage = React.useCallback((payload: ImageInsertPayload) => {
    editorRef.current?.chain().focus().setImage({ src: payload.src, alt: payload.alt }).run();
  }, []);

  const applyLink = React.useCallback((payload: LinkPayload) => {
    const instance = editorRef.current;
    if (!instance) return;
    const { from, to } = instance.state.selection;
    if (from === to) {
      instance
        .chain()
        .focus()
        .insertContent({
          type: "text",
          text: payload.text || payload.href,
          marks: [{ type: "link", attrs: { href: payload.href } }],
        })
        .run();
    } else {
      instance.chain().focus().extendMarkRange("link").setLink({ href: payload.href }).run();
    }
  }, []);

  const removeLink = React.useCallback(() => {
    editorRef.current?.chain().focus().extendMarkRange("link").unsetLink().run();
  }, []);

  const linkContext = React.useMemo(() => {
    const instance = editorRef.current;
    if (!instance) return { href: "", text: "", hasSelection: false };
    const href = (instance.getAttributes("link").href as string | undefined) ?? "";
    const { from, to } = instance.state.selection;
    return {
      href,
      text: from === to ? "" : instance.state.doc.textBetween(from, to, " "),
      hasSelection: from !== to,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkOpen, editor]);

  const chapterNumber = Math.max(1, chapters.findIndex((item) => item.id === chapter.id) + 1);
  const totalChapters = Math.max(chapters.length, 1);
  const readMinutes = readingTime(liveWords);

  return (
    <div
      className={cn(
        "relative flex min-h-0 flex-col bg-background",
        focused ? "fixed inset-0 z-50 h-dvh overflow-hidden" : "h-[calc(100dvh-5.75rem)] min-h-[560px]",
      )}
    >
      {/* ---------------------------------------------------------- top bar */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-ink-900/60 px-2 backdrop-blur sm:px-3">
        <button
          type="button"
          onClick={() => setRailOpen(true)}
          className="rounded-md p-1.5 text-muted transition hover:bg-ink-800 hover:text-foreground lg:hidden"
          aria-label="Open chapters"
        >
          <PanelLeft className="size-4" />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onBlur={() => void saveTitle(title)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.currentTarget.blur();
                }
                if (event.key === "Escape") {
                  setTitle(savedTitleRef.current);
                  event.currentTarget.blur();
                }
              }}
              readOnly={!canEdit}
              aria-label="Chapter title"
              maxLength={200}
              className="min-w-0 max-w-[220px] truncate rounded-sm border-b border-transparent bg-transparent font-serif text-[16px] font-medium leading-tight text-foreground outline-none transition hover:border-border-strong focus:border-accent/70 sm:max-w-[420px]"
            />
            <StatusPill
              projectId={projectId}
              chapterId={chapter.id}
              status={status}
              canEdit={canEdit}
              onChange={(next) => {
                setStatus(next);
                setChapters((current) =>
                  current.map((item) => (item.id === chapter.id ? { ...item, status: next } : item)),
                );
              }}
              className="shrink-0"
            />
          </div>
          <div className="mt-0.5 flex items-center gap-2 pl-0.5 text-[10.5px] text-muted">
            {canEdit ? (
              <SaveIndicator state={autosave.state} savedAt={autosave.savedAt} error={autosave.error} />
            ) : (
              <span className="text-plum">Read-only</span>
            )}
            <span aria-hidden>·</span>
            <span className="font-mono">
              Ch. {chapterNumber}/{totalChapters}
            </span>
            <span className="hidden sm:inline" aria-hidden>
              ·
            </span>
            <span className="hidden sm:inline">{collab.status === "ready" ? "Live" : "Local"}</span>
          </div>
        </div>

        <div className={cn("hidden items-center gap-3 lg:flex", focused && "lg:hidden")}>
          <PresenceAvatars peers={collab.peers} status={collab.status} />
        </div>

        <WordGoalRing words={dailyWords} goal={dailyGoal} className={cn(focused && "hidden")} />

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setFocused((value) => !value)}
            className="rounded-md p-1.5 text-muted transition hover:bg-ink-800 hover:text-foreground"
            aria-label={focused ? "Exit focus mode" : "Enter focus mode"}
            title={focused ? "Exit focus mode (Esc)" : "Focus mode (⌘⏎)"}
          >
            {focused ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </button>

          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            className="rounded-md p-1.5 text-muted transition hover:bg-ink-800 hover:text-foreground xl:hidden"
            aria-label="Open chapter panel"
          >
            <PanelRight className="size-4" />
          </button>

          <Dropdown
            align="end"
            trigger={
              <button
                type="button"
                className="rounded-md p-1.5 text-muted transition hover:bg-ink-800 hover:text-foreground"
                aria-label="Chapter menu"
              >
                <MoreHorizontal className="size-4" />
              </button>
            }
          >
            {(close) => (
              <>
                <DropdownLabel>{title || "Untitled Chapter"}</DropdownLabel>
                <DropdownItem
                  icon={<Info />}
                  onClick={() => {
                    close();
                    setDetailsOpen(true);
                  }}
                >
                  Chapter details…
                </DropdownItem>
                <DropdownItem
                  icon={<Search />}
                  onClick={() => {
                    close();
                    setFindOpen(true);
                  }}
                >
                  Find & replace
                </DropdownItem>
                <DropdownItem
                  icon={<Type />}
                  onClick={() => {
                    close();
                    toggleTypewriter();
                  }}
                >
                  {typewriter ? "Turn typewriter off" : "Turn typewriter on"}
                </DropdownItem>
                <DropdownItem
                  icon={<Focus />}
                  onClick={() => {
                    close();
                    setFocused(true);
                  }}
                >
                  Focus mode
                </DropdownItem>
                {canEdit && (
                  <>
                    <DropdownSeparator />
                    <DropdownItem
                      icon={<Trash2 />}
                      danger
                      onClick={() => {
                        close();
                        setDeleteTarget(chapters.find((item) => item.id === chapter.id) ?? null);
                      }}
                    >
                      Delete chapter
                    </DropdownItem>
                  </>
                )}
              </>
            )}
          </Dropdown>
        </div>
      </header>

      <EditorToolbar
        editor={editor}
        canEdit={canEdit}
        wordCount={liveWords}
        onOpenFind={() => setFindOpen(true)}
        onOpenImage={() => setImageOpen(true)}
        onOpenLink={() => setLinkOpen(true)}
        onComment={canEdit ? requestComment : undefined}
        onToggleFocus={() => setFocused((value) => !value)}
        focused={focused}
        typewriter={typewriter}
        onToggleTypewriter={toggleTypewriter}
        className={cn(focused && "hidden")}
      />

      {/* ------------------------------------------------------ working area */}
      <div className="flex min-h-0 flex-1">
        <ChapterRail
          projectId={projectId}
          chapters={chapters}
          activeId={chapter.id}
          liveWords={liveWords}
          canEdit={canEdit}
          onAdd={() => void handleAddChapter()}
          onRename={(target) => setRenameTarget(target)}
          onRequestDelete={(target) => setDeleteTarget(target)}
          onMove={(target, direction) => void handleMove(target, direction)}
          className={cn("hidden w-[248px] shrink-0 border-r lg:flex", focused && "lg:hidden")}
        />

        <main className="relative flex min-w-0 flex-1 flex-col">
          <div
            ref={scrollRef}
            data-editor-scroll
            className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(ellipse_at_top,rgba(200,129,74,0.055),transparent_55%)] px-2 pb-10 pt-4 sm:px-6 sm:pt-8"
          >
            <div
              className={cn(
                "mx-auto w-full max-w-[calc(68ch+7rem)]",
                focused && "max-w-[calc(68ch+5rem)]",
              )}
            >
              <div className="rounded-[3px] bg-paper px-5 py-8 shadow-[0_18px_50px_-24px_rgba(0,0,0,0.75)] ring-1 ring-black/10 sm:px-10 sm:py-12 lg:px-14 lg:py-16">
                <div className="mx-auto max-w-[68ch]">
                  {!editor ? (
                    <div className="space-y-3 py-2" aria-hidden>
                      <div className="h-6 w-2/3 animate-pulse rounded bg-black/10" />
                      <div className="h-3.5 w-full animate-pulse rounded bg-black/10" />
                      <div className="h-3.5 w-11/12 animate-pulse rounded bg-black/10" />
                      <div className="h-3.5 w-10/12 animate-pulse rounded bg-black/10" />
                      <div className="h-3.5 w-full animate-pulse rounded bg-black/10" />
                      <div className="h-3.5 w-9/12 animate-pulse rounded bg-black/10" />
                    </div>
                  ) : (
                    <EditorContent editor={editor} />
                  )}
                </div>
              </div>

              <p className="mx-auto mt-4 max-w-[68ch] px-2 pb-8 text-center font-mono text-[10px] uppercase tracking-[0.2em] text-muted/60">
                {formatNumber(liveWords)} words · {readMinutes}
              </p>
            </div>
          </div>

          {/* ------------------------------------------------------ status bar */}
          <div className="flex h-8 shrink-0 items-center gap-3 border-t border-border bg-ink-900/70 px-3 font-mono text-[10.5px] text-muted">
            <span className="text-muted-strong">{formatNumber(liveWords)} words</span>
            <span>{formatNumber(liveChars)} chars</span>
            <span className="hidden sm:inline">{readMinutes}</span>
            <span className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={toggleTypewriter}
                aria-pressed={typewriter}
                className={cn(
                  "inline-flex items-center gap-1 rounded px-1.5 py-0.5 transition hover:bg-ink-750 hover:text-foreground",
                  typewriter && "text-accent-soft",
                )}
                title="Typewriter scrolling"
              >
                <Type className="size-3" /> Typewriter
              </button>
              <button
                type="button"
                onClick={() => setFindOpen(true)}
                className="hidden items-center gap-1 rounded px-1.5 py-0.5 transition hover:bg-ink-750 hover:text-foreground sm:inline-flex"
              >
                Find ⌘F
              </button>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => void autosave.flush()}
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 transition hover:bg-ink-750 hover:text-foreground"
                >
                  Save ⌘S
                </button>
              )}
            </span>
          </div>
        </main>

        <EditorSidePanel
          projectId={projectId}
          canEdit={canEdit}
          chapter={{ ...chapter, title, status, word_count: liveWords, synopsis }}
          versions={versions}
          versionsLoading={versionsLoading}
          tab={panelTab}
          onTabChange={handlePanelTab}
          onRefreshVersions={() => void refreshVersions()}
          onRestored={applyExternalContent}
          flushPending={autosave.flush}
          className={cn("hidden w-[320px] shrink-0 xl:flex xl:w-[336px]", focused && "xl:hidden")}
        />
      </div>

      {/* -------------------------------------------------- mobile drawers */}
      {railOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={() => setRailOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-[284px] flex-col border-r border-border-strong bg-ink-900 shadow-2xl fade-in">
            <button
              type="button"
              onClick={() => setRailOpen(false)}
              className="absolute right-2 top-2 z-10 rounded-md p-1 text-muted hover:bg-ink-750 hover:text-foreground"
              aria-label="Close chapters"
            >
              <X className="size-4" />
            </button>
            <ChapterRail
              projectId={projectId}
              chapters={chapters}
              activeId={chapter.id}
              liveWords={liveWords}
              canEdit={canEdit}
              onAdd={() => void handleAddChapter()}
              onRename={(target) => setRenameTarget(target)}
              onRequestDelete={(target) => setDeleteTarget(target)}
              onMove={(target, direction) => void handleMove(target, direction)}
              className="h-full"
            />
          </div>
        </div>
      )}

      {panelOpen && (
        <div className="fixed inset-0 z-50 xl:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={() => setPanelOpen(false)} />
          <div className="absolute inset-y-0 right-0 flex w-[320px] max-w-[90vw] flex-col border-l border-border-strong bg-ink-900 shadow-2xl fade-in">
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              className="absolute right-2 top-2 z-10 rounded-md p-1 text-muted hover:bg-ink-750 hover:text-foreground"
              aria-label="Close panel"
            >
              <X className="size-4" />
            </button>
            <EditorSidePanel
              projectId={projectId}
              canEdit={canEdit}
              chapter={{ ...chapter, title, status, word_count: liveWords, synopsis }}
              versions={versions}
              versionsLoading={versionsLoading}
              tab={panelTab}
              onTabChange={handlePanelTab}
              onRefreshVersions={() => void refreshVersions()}
              onRestored={applyExternalContent}
              flushPending={autosave.flush}
              className="h-full"
            />
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------ dialogs */}
      <FindReplaceDialog
        open={findOpen}
        onOpenChange={setFindOpen}
        editor={editor}
        projectId={projectId}
        chapterId={chapter.id}
        chapterTitle={title}
        canEdit={canEdit}
        onExternalContentChange={applyExternalContent}
        flushPending={autosave.flush}
      />

      <ImageDialog open={imageOpen} onOpenChange={setImageOpen} assets={assets} onInsert={insertImage} />

      <LinkDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        initialHref={linkContext.href}
        initialText={linkContext.text}
        hasSelection={linkContext.hasSelection}
        onApply={applyLink}
        onRemove={removeLink}
      />

      <ChapterDetailsDialog
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        chapter={{ ...chapter, title, status, word_count: liveWords, synopsis }}
        canEdit={canEdit}
        onSave={(value) => void handleDetailsSave(value)}
        saving={busy === "details"}
      />

      <RenameChapterDialog
        open={renameTarget !== null}
        onOpenChange={(open) => (!open ? setRenameTarget(null) : undefined)}
        initialTitle={renameTarget?.title ?? ""}
        saving={busy === "rename"}
        onSave={(nextTitle) => void handleRename(renameTarget, nextTitle)}
      />

      <DeleteChapterDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => (!open ? setDeleteTarget(null) : undefined)}
        chapter={deleteTarget}
        onConfirm={() => void handleDelete()}
        deleting={busy === "delete"}
      />
    </div>
  );
}
