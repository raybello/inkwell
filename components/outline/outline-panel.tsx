"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  GripVertical,
  Layers,
  PenLine,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge, STATUS_LABEL, STATUS_TONE } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { ChapterMetaDialog } from "@/components/outline/chapter-meta-dialog";
import {
  createChapter,
  createChapters,
  deleteChapter,
  renameChapter,
  reorderChapters,
  type ReorderItem,
} from "@/lib/actions/outline";
import { cn, formatNumber, truncate } from "@/lib/utils";
import type { Chapter } from "@/lib/types";

const INDENT = 16;

const STATUS_DOT: Record<string, string> = {
  draft: "bg-ink-500",
  in_progress: "bg-accent",
  complete: "bg-sage",
  needs_review: "bg-amber-500",
};

type Row = {
  chapter: Chapter;
  depth: number;
  childCount: number;
  words: number;
};

/* --------------------------------------------------------------- tree helpers */

function groupByParent(chapters: Chapter[]) {
  const ids = new Set(chapters.map((c) => c.id));
  const groups = new Map<string | null, Chapter[]>();
  for (const raw of chapters) {
    const chapter =
      raw.parent_id && !ids.has(raw.parent_id) ? { ...raw, parent_id: null } : raw;
    const key = chapter.parent_id ?? null;
    const list = groups.get(key) ?? [];
    list.push(chapter);
    groups.set(key, list);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => a.position - b.position || a.title.localeCompare(b.title));
  }
  return groups;
}

function buildRows(chapters: Chapter[], collapsed: Set<string>): Row[] {
  const groups = groupByParent(chapters);
  const totals = new Map<string, number>();

  const totalFor = (chapter: Chapter): number => {
    const cached = totals.get(chapter.id);
    if (cached !== undefined) return cached;
    const kids = groups.get(chapter.id) ?? [];
    const sum = (chapter.word_count ?? 0) + kids.reduce((acc, kid) => acc + totalFor(kid), 0);
    totals.set(chapter.id, sum);
    return sum;
  };

  const rows: Row[] = [];
  const walk = (parentId: string | null, depth: number) => {
    for (const chapter of groups.get(parentId) ?? []) {
      const kids = groups.get(chapter.id) ?? [];
      rows.push({ chapter, depth, childCount: kids.length, words: totalFor(chapter) });
      if (kids.length && !collapsed.has(chapter.id)) walk(chapter.id, depth + 1);
    }
  };
  walk(null, 0);
  return rows;
}

type Projection = { depth: number; parentId: string | null; index: number; order: Row[] };

function projectDrop(rows: Row[], activeId: string, overId: string, dx: number): Projection | null {
  const activeIndex = rows.findIndex((r) => r.chapter.id === activeId);
  if (activeIndex < 0) return null;
  const activeRow = rows[activeIndex];

  // the dragged row travels with its whole subtree — its children must not take part in the maths
  const descendants = new Set<string>();
  for (let i = activeIndex + 1; i < rows.length; i++) {
    if (rows[i].depth <= activeRow.depth) break;
    descendants.add(rows[i].chapter.id);
  }
  if (descendants.has(overId) || overId === activeId) return null;

  const filtered = rows.filter((r) => !descendants.has(r.chapter.id));
  const from = filtered.findIndex((r) => r.chapter.id === activeId);
  const to = filtered.findIndex((r) => r.chapter.id === overId);
  if (from < 0 || to < 0) return null;

  const order = arrayMove(filtered, from, to);
  const previous = order[to - 1];
  const next = order[to + 1];

  const maxDepth = previous ? previous.depth + 1 : 0;
  const minDepth = next ? next.depth : 0;
  let depth = activeRow.depth + Math.round(dx / INDENT);
  depth = Math.min(depth, maxDepth);
  depth = Math.max(depth, minDepth, 0);

  let parentId: string | null = null;
  if (depth > 0) {
    parentId = null;
    for (let i = to - 1; i >= 0; i--) {
      if (order[i].depth === depth - 1) {
        parentId = order[i].chapter.id;
        break;
      }
    }
    if (!parentId) depth = 0;
  }

  return { depth, parentId, index: to, order };
}

/* --------------------------------------------------------------- rename input */

function RenameInput({
  value,
  onCommit,
  onCancel,
}: {
  value: string;
  onCommit: (next: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = React.useState(value);
  const done = React.useRef(false);

  const commit = () => {
    if (done.current) return;
    done.current = true;
    onCommit(draft);
  };

  return (
    <Input
      autoFocus
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={commit}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          done.current = true;
          onCancel();
        }
        e.stopPropagation();
      }}
      aria-label="Section title"
      className="h-7 min-w-0 flex-1 px-2 py-0 text-[13px]"
    />
  );
}

/* ---------------------------------------------------------------------- row */

type RowProps = {
  row: Row;
  projectId: string;
  canEdit: boolean;
  collapsed: boolean;
  renaming: boolean;
  busy: string | null;
  projection: Projection | null;
  isDraggingAny: boolean;
  onToggle: (id: string) => void;
  onStartRename: (id: string) => void;
  onCommitRename: (id: string, title: string) => void;
  onCancelRename: () => void;
  onAddChild: (chapter: Chapter) => void;
  onAddSibling: (chapter: Chapter) => void;
  onDelete: (chapter: Chapter) => void;
  onEditMeta: (chapter: Chapter) => void;
};

function OutlineRow({
  row,
  projectId,
  canEdit,
  collapsed,
  renaming,
  busy,
  projection,
  isDraggingAny,
  onToggle,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onAddChild,
  onAddSibling,
  onDelete,
  onEditMeta,
}: RowProps) {
  const router = useRouter();
  const { chapter } = row;
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging, isOver } =
    useSortable({ id: chapter.id, disabled: !canEdit });

  const hasChildren = row.childCount > 0;
  const showDropLine = isOver && isDraggingAny && projection && projection.index >= 0;

  // single click opens the editor, double click renames — the timer makes both work
  const clickTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(
    () => () => {
      if (clickTimer.current) clearTimeout(clickTimer.current);
    },
    [],
  );

  const openEditor = () => router.push(`/app/projects/${projectId}/editor/${chapter.id}`);
  const handleTitleClick = () => {
    if (!canEdit) {
      openEditor();
      return;
    }
    if (clickTimer.current) return;
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      openEditor();
    }, 240);
  };
  const handleTitleDoubleClick = () => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    if (canEdit) onStartRename(chapter.id);
  };

  return (
    <div
      ref={setNodeRef}
      role="treeitem"
      aria-level={row.depth + 1}
      aria-expanded={hasChildren ? !collapsed : undefined}
      aria-selected={false}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group relative rounded-md pr-1 transition-colors",
        isDragging && "z-10 opacity-40",
        !isDragging && "hover:bg-ink-850/70",
      )}
    >
      <div className="flex min-h-9 items-center gap-1">
        <span aria-hidden style={{ width: row.depth * INDENT + 4 }} className="shrink-0" />

        {canEdit ? (
          <button
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Reorder ${chapter.title}`}
            className="flex size-5 cursor-grab touch-none items-center justify-center rounded text-muted/50 opacity-0 transition hover:text-foreground focus-visible:opacity-100 active:cursor-grabbing group-hover:opacity-100"
          >
            <GripVertical className="size-3.5" />
          </button>
        ) : (
          <span className="size-5" aria-hidden />
        )}

        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggle(chapter.id)}
            aria-label={collapsed ? `Expand ${chapter.title}` : `Collapse ${chapter.title}`}
            className="flex size-5 shrink-0 items-center justify-center rounded text-muted transition hover:bg-ink-800 hover:text-foreground"
          >
            {collapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </button>
        ) : (
          <span className="size-5 shrink-0" aria-hidden />
        )}

        <span
          className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[chapter.status] ?? "bg-ink-500")}
          title={STATUS_LABEL[chapter.status] ?? chapter.status}
          aria-label={STATUS_LABEL[chapter.status] ?? chapter.status}
          role="img"
        />

        {chapter.color && (
          <span
            aria-hidden
            className="h-3.5 w-0.5 shrink-0 rounded-full"
            style={{ backgroundColor: chapter.color }}
          />
        )}

        <div className="flex min-w-0 flex-1 flex-col py-1">
          {renaming ? (
            <RenameInput
              value={chapter.title}
              onCommit={(title) => onCommitRename(chapter.id, title)}
              onCancel={onCancelRename}
            />
          ) : (
            <button
              type="button"
              onClick={handleTitleClick}
              onDoubleClick={handleTitleDoubleClick}
              className={cn(
                "min-w-0 truncate text-left text-[13.5px] leading-tight transition-colors hover:text-accent-soft",
                hasChildren ? "font-medium text-ink-100" : "text-ink-200",
              )}
              title={canEdit ? `${chapter.title} — double-click to rename` : chapter.title}
            >
              {chapter.title}
            </button>
          )}

          {!renaming && (
            <button
              type="button"
              onClick={() => canEdit && onEditMeta(chapter)}
              disabled={!canEdit}
              className={cn(
                "mt-0.5 min-w-0 truncate text-left text-[11.5px] italic leading-tight transition-colors",
                chapter.synopsis
                  ? "text-muted/80 hover:text-muted-strong disabled:hover:text-muted/80"
                  : "text-muted/40 opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
              )}
              aria-label={chapter.synopsis ? `Edit synopsis for ${chapter.title}` : `Add synopsis for ${chapter.title}`}
            >
              {chapter.synopsis ? truncate(chapter.synopsis, 120) : canEdit ? "Add synopsis…" : "No synopsis"}
            </button>
          )}
        </div>

        <Badge
          tone={STATUS_TONE[chapter.status]}
          className="hidden shrink-0 xl:inline-flex"
        >
          {STATUS_LABEL[chapter.status] ?? chapter.status}
        </Badge>

        <span className="w-12 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted">
          {formatNumber(row.words)}
        </span>

        {canEdit && (
          <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
            <RowAction
              label={`Open ${chapter.title}`}
              onClick={() => router.push(`/app/projects/${projectId}/editor/${chapter.id}`)}
              className="hidden sm:flex"
            >
              <PenLine />
            </RowAction>
            <RowAction label={`Add section inside ${chapter.title}`} onClick={() => onAddChild(chapter)} disabled={busy === `child-${chapter.id}`}>
              <Plus />
            </RowAction>
            <RowAction label={`Add section after ${chapter.title}`} onClick={() => onAddSibling(chapter)} disabled={busy === `sibling-${chapter.id}`}>
              <CornerDownRight />
            </RowAction>
            <RowAction label={`Delete ${chapter.title}`} onClick={() => onDelete(chapter)} danger>
              <Trash2 />
            </RowAction>
          </div>
        )}
      </div>

      {showDropLine && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent"
          style={{ marginLeft: 12 + projection!.depth * INDENT, right: 8 }}
        />
      )}
    </div>
  );
}

function RowAction({
  label,
  onClick,
  disabled,
  danger,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-6 items-center justify-center rounded text-muted transition hover:bg-ink-800 hover:text-foreground disabled:opacity-40 [&_svg]:size-3.5",
        danger && "hover:bg-red-950/50 hover:text-red-300",
        className,
      )}
    >
      {children}
    </button>
  );
}

function descendantCount(chapters: Chapter[], id: string) {
  let count = 0;
  const stack = [id];
  while (stack.length) {
    const parent = stack.pop() as string;
    for (const chapter of chapters) {
      if (chapter.parent_id === parent) {
        count += 1;
        stack.push(chapter.id);
      }
    }
  }
  return count;
}

/* ---------------------------------------------------------------------- panel */

export function OutlinePanel({
  projectId,
  chapters: initialChapters,
  canEdit,
}: {
  projectId: string;
  chapters: Chapter[];
  canEdit: boolean;
}) {
  const [items, setItems] = React.useState<Chapter[]>(initialChapters);
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());
  const [renamingId, setRenamingId] = React.useState<string | null>(null);
  const [metaTarget, setMetaTarget] = React.useState<Chapter | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Chapter | null>(null);
  const [pending, setPending] = React.useState<string | null>(null);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [projection, setProjection] = React.useState<Projection | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  // server is the source of truth after every revalidation
  React.useEffect(() => {
    setItems(initialChapters);
  }, [initialChapters]);

  const rows = React.useMemo(() => buildRows(items, collapsed), [items, collapsed]);
  const rowById = React.useMemo(
    () => new Map(rows.map((row) => [row.chapter.id, row])),
    [rows],
  );
  const activeRow = activeId ? rowById.get(activeId) ?? null : null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const toggle = (id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expand = (id: string) => {
    setCollapsed((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  /* ------------------------------------------------------------- mutations */

  async function handleRename(chapterId: string, title: string) {
    setRenamingId(null);
    const current = items.find((c) => c.id === chapterId);
    const clean = title.trim();
    if (!current || !clean || clean === current.title) return;

    const previous = items;
    setItems((prev) => prev.map((c) => (c.id === chapterId ? { ...c, title: clean } : c)));
    const result = await renameChapter(projectId, chapterId, clean);
    if (!result.ok) {
      setItems(previous);
      toast.error(result.error);
    }
  }

  async function addChapter(parentId: string | null, after?: Chapter) {
    const key = after ? `sibling-${after.id}` : `child-${parentId ?? "root"}`;
    if (pending) return;
    setPending(key);
    try {
      const result = await createChapter(projectId, { parentId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      const created = result.data;
      setItems((prev) => [...prev, created]);
      if (parentId) expand(parentId);
      setRenamingId(created.id);

      if (after) {
        const siblings = items
          .filter((c) => (c.parent_id ?? null) === (after.parent_id ?? null))
          .sort((a, b) => a.position - b.position)
          .map((c) => c);
        const index = siblings.findIndex((c) => c.id === after.id);
        siblings.splice(index >= 0 ? index + 1 : siblings.length, 0, created);
        const payload: ReorderItem[] = siblings.map((c, i) => ({
          id: c.id,
          parent_id: after.parent_id ?? null,
          position: i,
        }));
        await reorderChapters(projectId, payload);
      }
    } finally {
      setPending(null);
    }
  }

  async function addBatch(count: number) {
    if (pending) return;
    setPending(`batch-${count}`);
    try {
      const result = await createChapters(projectId, count);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setItems((prev) => [...prev, ...result.data]);
      toast.success(`${result.data.length} chapters added`);
    } finally {
      setPending(null);
    }
  }

  async function addPart() {
    if (pending) return;
    setPending("part");
    try {
      const result = await createChapter(projectId, { title: "New Part" });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setItems((prev) => [...prev, result.data]);
      setRenamingId(result.data.id);
    } finally {
      setPending(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleting(true);
    const result = await deleteChapter(projectId, target.id);
    setDeleting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    // mirror the database cascade locally so nothing orphaned lingers on screen
    const doomed = new Set<string>([target.id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const chapter of items) {
        if (chapter.parent_id && doomed.has(chapter.parent_id) && !doomed.has(chapter.id)) {
          doomed.add(chapter.id);
          grew = true;
        }
      }
    }
    setItems((prev) => prev.filter((c) => !doomed.has(c.id)));
    toast.success(
      doomed.size > 1 ? `Section and ${doomed.size - 1} nested sections deleted` : "Section deleted",
    );
    setDeleteTarget(null);
  }

  /* ------------------------------------------------------------------ dnd */

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
    setProjection(null);
  }

  function onDragOver(event: DragOverEvent) {
    if (!event.over || !activeId) return;
    setProjection(projectDrop(rows, activeId, String(event.over.id), event.delta.x));
  }

  function onDragEnd(event: DragEndEvent) {
    const active = String(event.active.id);
    const over = event.over ? String(event.over.id) : null;
    setActiveId(null);
    setProjection(null);
    if (!over || over === active) return;

    const drop = projectDrop(rows, active, over, event.delta.x);
    if (!drop) return;

    const before = items;
    const finalRows = drop.order.map((row) =>
      row.chapter.id === active ? { ...row, depth: drop.depth } : row,
    );

    const counters = new Map<string, number>();
    const payload: ReorderItem[] = finalRows.map((row) => {
      const parentId = row.chapter.id === active ? drop.parentId : row.chapter.parent_id ?? null;
      const key = parentId ?? "__root__";
      const position = counters.get(key) ?? 0;
      counters.set(key, position + 1);
      return { id: row.chapter.id, parent_id: parentId, position };
    });

    setItems((prev) =>
      prev.map((chapter) => {
        const next = payload.find((p) => p.id === chapter.id);
        return next ? { ...chapter, parent_id: next.parent_id, position: next.position } : chapter;
      }),
    );
    if (drop.parentId) expand(drop.parentId);

    void reorderChapters(projectId, payload).then((result) => {
      if (!result.ok) {
        setItems(before);
        toast.error(result.error);
      }
    });
  }

  const busyAny = pending !== null || deleting;
  const deleteNested = deleteTarget ? descendantCount(items, deleteTarget.id) : 0;

  return (
    <div className="rounded-xl border border-border bg-card/40">
      <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <Layers className="size-3.5 text-muted" />
          <span className="text-[11px] uppercase tracking-[0.16em] text-muted">Structure</span>
        </div>
        <p className="hidden text-[11px] text-muted/70 sm:block">
          {canEdit ? "Drag to reorder · double-click a title to rename" : "Read only"}
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Layers />}
          title="No chapters yet"
          description="Build the spine of the book — parts, chapters, scenes — then write into it."
          className="py-10"
          action={
            canEdit ? (
              <Button variant="primary" size="sm" onClick={() => void addChapter(null)} loading={pending === "child-root"}>
                <Plus /> Add the first chapter
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div role="tree" aria-label="Outline" className="p-1.5">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
            onDragCancel={() => {
              setActiveId(null);
              setProjection(null);
            }}
          >
            <SortableContext
              items={rows.map((row) => row.chapter.id)}
              strategy={verticalListSortingStrategy}
            >
              {rows.map((row) => (
                <OutlineRow
                  key={row.chapter.id}
                  row={row}
                  projectId={projectId}
                  canEdit={canEdit}
                  collapsed={collapsed.has(row.chapter.id)}
                  renaming={renamingId === row.chapter.id}
                  busy={pending}
                  projection={projection}
                  isDraggingAny={activeId !== null}
                  onToggle={toggle}
                  onStartRename={setRenamingId}
                  onCommitRename={handleRename}
                  onCancelRename={() => setRenamingId(null)}
                  onAddChild={(chapter) => void addChapter(chapter.id)}
                  onAddSibling={(chapter) => void addChapter(chapter.parent_id ?? null, chapter)}
                  onDelete={(chapter) => setDeleteTarget(chapter)}
                  onEditMeta={(chapter) => setMetaTarget(chapter)}
                />
              ))}
            </SortableContext>

            <DragOverlay dropAnimation={null}>
              {activeRow && (
                <div className="flex items-center gap-2 rounded-md border border-border-strong bg-ink-850 px-2.5 py-1.5 text-[13px] shadow-2xl">
                  <GripVertical className="size-3.5 text-muted" />
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      STATUS_DOT[activeRow.chapter.status] ?? "bg-ink-500",
                    )}
                  />
                  <span className="max-w-[240px] truncate font-medium">{activeRow.chapter.title}</span>
                  <span className="font-mono text-[11px] text-muted">{formatNumber(activeRow.words)}</span>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        </div>
      )}

      {canEdit && (
        <div className="flex flex-wrap items-center gap-1 border-t border-border px-2.5 py-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void addChapter(null)}
            loading={pending === "child-root"}
            disabled={busyAny}
          >
            <Plus className="size-3.5" /> Add chapter
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void addBatch(3)}
            loading={pending === "batch-3"}
            disabled={busyAny}
          >
            <Plus className="size-3.5" /> Add 3 chapters
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void addPart()}
            loading={pending === "part"}
            disabled={busyAny}
            className="text-muted"
          >
            <Plus className="size-3.5" /> Part
          </Button>
          <span className="ml-auto hidden text-[11px] text-muted/60 sm:block">
            {items.length} {items.length === 1 ? "section" : "sections"}
          </span>
        </div>
      )}

      {metaTarget && (
        <ChapterMetaDialog
          key={metaTarget.id}
          projectId={projectId}
          chapter={metaTarget}
          onClose={() => setMetaTarget(null)}
          onSaved={(saved) =>
            setItems((prev) => prev.map((c) => (c.id === saved.id ? saved : c)))
          }
        />
      )}

      {deleteTarget && (
        <Dialog
          open
          onOpenChange={(next) => !next && setDeleteTarget(null)}
          title="Delete section"
          description={
            deleteNested > 0
              ? `Includes ${deleteNested} nested ${deleteNested === 1 ? "section" : "sections"}`
              : "This section has no children"
          }
          footer={
            <>
              <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Cancel
              </Button>
              <Button variant="danger" onClick={() => void confirmDelete()} loading={deleting}>
                Delete
              </Button>
            </>
          }
        >
          <p className="text-sm text-muted-strong">
            <span className="font-medium text-ink-100">{deleteTarget.title}</span> will be removed
            along with any comments on it. This cannot be undone.
          </p>
        </Dialog>
      )}
    </div>
  );
}
