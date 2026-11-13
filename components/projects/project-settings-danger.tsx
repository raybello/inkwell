"use client";

import * as React from "react";
import { AlertTriangle, Crown, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { deleteProjectAction } from "@/lib/actions/projects";
import type { Role } from "@/lib/types";

export function ProjectSettingsDanger({
  projectId,
  projectTitle,
  isOwner,
  members,
}: {
  projectId: string;
  projectTitle: string;
  isOwner: boolean;
  members: { user_id: string; name: string; role: Role }[];
}) {
  const [open, setOpen] = React.useState(false);
  const [confirmText, setConfirmText] = React.useState("");
  const [deleting, setDeleting] = React.useState(false);

  if (!isOwner) {
    return (
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-serif text-lg leading-tight">Danger zone</h2>
        <p className="mt-1 text-sm text-muted">
          Only the project owner can delete this project or transfer ownership.
        </p>
      </section>
    );
  }

  async function remove() {
    setDeleting(true);
    const res = await deleteProjectAction(projectId);
    // deleteProjectAction redirects on success; reaching here means it failed.
    setDeleting(false);
    if (res?.error) toast.error(res.error);
  }

  const match = confirmText.trim() === projectTitle.trim();

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-serif text-lg leading-tight">
              <Crown className="size-4 text-accent" /> Transfer ownership
            </h2>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-muted">
              Hand the project to another collaborator. You would keep editor access and they would control
              collaborators, webhooks and deletion.
            </p>
          </div>
          <Badge tone="neutral">Coming soon</Badge>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <Field label="New owner" className="w-64">
            <Select disabled>
              <option>Choose a collaborator…</option>
              {members
                .filter((m) => m.role !== "owner")
                .map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.name}
                  </option>
                ))}
            </Select>
          </Field>
          <Button variant="secondary" disabled title="Ownership transfer ships with the team workspace update">
            Transfer
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-red-900/40 bg-red-950/15 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-serif text-lg leading-tight text-red-200">
              <AlertTriangle className="size-4" /> Delete this project
            </h2>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-red-200/70">
              Permanently removes {projectTitle}, its chapters, comments, assets, canvases and export history. There is no
              undo and collaborators lose access immediately.
            </p>
          </div>
          <Button variant="danger" onClick={() => setOpen(true)}>
            <Trash2 /> Delete project
          </Button>
        </div>
      </section>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setConfirmText("");
        }}
        title="Delete this project?"
        description="This cannot be undone."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Keep project
            </Button>
            <Button variant="danger" disabled={!match} loading={deleting} onClick={() => void remove()}>
              <Trash2 /> Delete forever
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-muted">
            Type <span className="font-mono text-ink-100">{projectTitle}</span> to confirm.
          </p>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={projectTitle}
            aria-label="Type the project title to confirm"
            autoFocus
          />
        </div>
      </Dialog>
    </div>
  );
}
