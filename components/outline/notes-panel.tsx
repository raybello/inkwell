"use client";

import * as React from "react";
import {
  BookMarked,
  CalendarClock,
  Loader2,
  MapPin,
  Plus,
  StickyNote,
  Trash2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { EmptyState, Tabs } from "@/components/ui/misc";
import { createNote, deleteNote, updateNote } from "@/lib/actions/outline";
import { cn } from "@/lib/utils";
import type { Note } from "@/lib/types";

const KIND_META: Record<
  Note["kind"],
  { label: string; icon: React.ComponentType<{ className?: string }>; tint: string }
> = {
  note: { label: "Note", icon: StickyNote, tint: "text-muted-strong" },
  character: { label: "Character", icon: UserRound, tint: "text-plum" },
  location: { label: "Location", icon: MapPin, tint: "text-sage" },
  event: { label: "Event", icon: CalendarClock, tint: "text-amber-300" },
  research: { label: "Research", icon: BookMarked, tint: "text-accent-soft" },
};

const KIND_ORDER: Note["kind"][] = ["note", "character", "location", "event", "research"];

const TABS = [
  { id: "all", label: "All" },
  { id: "character", label: "Characters" },
  { id: "location", label: "Locations" },
  { id: "event", label: "Events" },
  { id: "research", label: "Research" },
];

interface NoteDraft {
  kind: Note["kind"];
  title: string;
  body: string;
  tags: string;
}

const EMPTY_DRAFT: NoteDraft = { kind: "note", title: "", body: "", tags: "" };

function draftFrom(note: Note | null): NoteDraft {
  if (!note) return EMPTY_DRAFT;
  return {
    kind: note.kind,
    title: note.title,
    body: note.body ?? "",
    tags: note.tags.join(", "),
  };
}

function splitTags(input: string) {
  return input
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function NoteDialog({
  projectId,
  note,
  onClose,
  onSaved,
}: {
  projectId: string;
  note: Note | null;
  onClose: () => void;
  onSaved: (note: Note, mode: "create" | "update") => void;
}) {
  const [draft, setDraft] = React.useState<NoteDraft>(() => draftFrom(note));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function save() {
    if (!draft.title.trim()) {
      setError("Give the note a title.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      kind: draft.kind,
      title: draft.title,
      body: draft.body,
      tags: splitTags(draft.tags),
    };
    const result = note
      ? await updateNote(projectId, note.id, payload)
      : await createNote(projectId, payload);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    toast.success(note ? "Note updated" : "Note added");
    onSaved(result.data, note ? "update" : "create");
    onClose();
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => !next && onClose()}
      title={note ? "Edit note" : "New note"}
      description="Research stays attached to this project."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void save()} loading={saving}>
            {note ? "Save note" : "Add note"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[150px_minmax(0,1fr)]">
          <Field label="Kind">
            <Select
              value={draft.kind}
              onChange={(e) => setDraft((d) => ({ ...d, kind: e.target.value as Note["kind"] }))}
            >
              {KIND_ORDER.map((kind) => (
                <option key={kind} value={kind}>
                  {KIND_META[kind].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Title">
            <Input
              value={draft.title}
              autoFocus
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="Mira Vance"
            />
          </Field>
        </div>
        <Field label="Body">
          <Textarea
            value={draft.body}
            rows={5}
            onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
            placeholder="Details you will want while drafting."
          />
        </Field>
        <Field label="Tags" hint="Comma separated.">
          <Input
            value={draft.tags}
            onChange={(e) => setDraft((d) => ({ ...d, tags: e.target.value }))}
            placeholder="protagonist, act i"
          />
        </Field>
        {error && <p className="text-xs text-red-400">{error}</p>}
        {saving && (
          <p className="flex items-center gap-1.5 text-[11px] text-muted">
            <Loader2 className="size-3 animate-spin" /> Saving
          </p>
        )}
      </div>
    </Dialog>
  );
}

export function NotesPanel({
  projectId,
  notes: initialNotes,
  canEdit,
}: {
  projectId: string;
  notes: Note[];
  canEdit: boolean;
}) {
  const [notes, setNotes] = React.useState<Note[]>(initialNotes);
  const [tab, setTab] = React.useState("all");
  const [editor, setEditor] = React.useState<{ note: Note | null } | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<Note | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  React.useEffect(() => {
    setNotes(initialNotes);
  }, [initialNotes]);

  const visible = tab === "all" ? notes : notes.filter((note) => note.kind === tab);

  function applySaved(saved: Note, mode: "create" | "update") {
    setNotes((prev) =>
      mode === "create" ? [...prev, saved] : prev.map((n) => (n.id === saved.id ? saved : n)),
    );
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleting(true);
    const result = await deleteNote(projectId, target.id);
    setDeleting(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setNotes((prev) => prev.filter((n) => n.id !== target.id));
    setDeleteTarget(null);
    toast.success("Note deleted");
  }

  return (
    <div className="rounded-xl border border-border bg-card/40">
      <div className="flex flex-col gap-2 border-b border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          tabs={TABS}
          value={tab}
          onChange={setTab}
          className="max-w-full overflow-x-auto border-0 bg-transparent p-0 [&>button]:shrink-0 [&>button]:whitespace-nowrap"
        />
        {canEdit && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditor({ note: null })}
            className="self-start sm:self-auto"
          >
            <Plus className="size-3.5" /> New note
          </Button>
        )}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<BookMarked />}
          title={tab === "all" ? "No notes yet" : "Nothing filed here"}
          description={
            canEdit
              ? "Characters, places, events and research — keep the world beside the manuscript."
              : "The author has not filed any notes in this view."
          }
          className="py-10"
          action={
            canEdit ? (
              <Button variant="secondary" size="sm" onClick={() => setEditor({ note: null })}>
                <Plus /> Add a note
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="divide-y divide-border">
          {visible.map((note) => {
            const meta = KIND_META[note.kind];
            const Icon = meta.icon;
            return (
              <li key={note.id} className="group flex items-start gap-3 px-3 py-3 transition-colors hover:bg-ink-850/40">
                <span
                  className={cn(
                    "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-ink-900",
                    meta.tint,
                  )}
                >
                  <Icon className="size-3.5" />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <button
                      type="button"
                      onClick={() => canEdit && setEditor({ note })}
                      disabled={!canEdit}
                      className="truncate text-left text-[13.5px] font-medium text-ink-100 transition-colors enabled:hover:text-accent-soft disabled:cursor-default"
                    >
                      {note.title}
                    </button>
                    <span className="text-[10px] uppercase tracking-[0.14em] text-muted/70">
                      {meta.label}
                    </span>
                  </div>
                  {note.body && (
                    <p className="mt-0.5 line-clamp-2 text-[12.5px] leading-relaxed text-muted">
                      {note.body}
                    </p>
                  )}
                  {note.tags.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {note.tags.map((tag, index) => (
                        <span
                          key={`${tag}-${index}`}
                          className="rounded-full border border-border-strong px-1.5 py-px text-[10px] text-muted"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {canEdit && (
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(note)}
                    aria-label={`Delete ${note.title}`}
                    title={`Delete ${note.title}`}
                    className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded text-muted opacity-100 transition hover:bg-red-950/50 hover:text-red-300 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {editor && (
        <NoteDialog
          key={editor.note?.id ?? "new"}
          projectId={projectId}
          note={editor.note}
          onClose={() => setEditor(null)}
          onSaved={applySaved}
        />
      )}

      {deleteTarget && (
        <Dialog
          open
          onOpenChange={(next) => !next && setDeleteTarget(null)}
          title="Delete note"
          description={deleteTarget.title}
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
          <p className="text-sm text-muted-strong">This removes the note from the project for everyone.</p>
        </Dialog>
      )}
    </div>
  );
}
