"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { updateProjectAction, type ActionState } from "@/lib/actions/projects";
import type { Project } from "@/lib/types";
import { cn } from "@/lib/utils";

const TYPES: { value: string; label: string }[] = [
  { value: "book", label: "Book" },
  { value: "ebook", label: "E-book" },
  { value: "article", label: "Article" },
  { value: "blog", label: "Blog series" },
  { value: "custom", label: "Custom" },
];

const TARGETS = [
  { value: "", label: "Not decided" },
  { value: "Amazon KDP", label: "Amazon KDP" },
  { value: "IngramSpark", label: "IngramSpark" },
  { value: "Smashwords", label: "Smashwords" },
  { value: "Own website", label: "Own website" },
  { value: "Blog", label: "Blog" },
  { value: "Newsletter", label: "Newsletter" },
];

function Panel({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border border-border bg-card p-5", className)}>
      <div className="mb-4 space-y-0.5">
        <h2 className="font-serif text-lg leading-tight">{title}</h2>
        {description && <p className="text-xs leading-relaxed text-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}

export function ProjectSettingsGeneral({ project, canEdit }: { project: Project; canEdit: boolean }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ActionState, FormData>(updateProjectAction, null);
  const [dirty, setDirty] = React.useState(false);

  React.useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      setDirty(false);
      router.refresh();
    }
    if (state?.error) toast.error(state.error);
  }, [state, router]);

  return (
    <form action={formAction} onChange={() => setDirty(true)} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <input type="hidden" name="id" value={project.id} />

      <div className="space-y-6">
        <Panel title="Identity" description="What the book is called, and the line under the title.">
          <div className="space-y-4">
            <Field label="Title">
              <Input name="title" defaultValue={project.title} placeholder="The Salt Road" required disabled={!canEdit} />
            </Field>
            <Field label="Subtitle" hint="Optional — shown under the title on covers and previews.">
              <Input name="subtitle" defaultValue={project.subtitle ?? ""} placeholder="A novel of the interior" disabled={!canEdit} />
            </Field>
            <Field label="Description" hint="The blurb readers see first. Two or three sentences is plenty.">
              <Textarea
                name="description"
                defaultValue={project.description ?? ""}
                rows={5}
                placeholder="A cartographer walks a road that keeps rewriting itself…"
                disabled={!canEdit}
              />
            </Field>
          </div>
        </Panel>

        <Panel title="Craft" description="Working details that shape the outline and progress meter.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Genre">
              <Input name="genre" defaultValue={project.genre ?? ""} placeholder="Literary fiction" disabled={!canEdit} />
            </Field>
            <Field label="Target word count" hint="Used for progress on the overview.">
              <Input
                name="target_word_count"
                type="number"
                min={0}
                step={1000}
                defaultValue={project.target_word_count ?? 0}
                disabled={!canEdit}
              />
            </Field>
          </div>
        </Panel>
      </div>

      <aside className="space-y-6">
        <Panel title="Publication" description="Where this is headed, and how it's filed.">
          <div className="space-y-4">
            <Field label="Project type">
              <Select name="type" defaultValue={project.type} disabled={!canEdit}>
                {TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Publishing target">
              <Select name="publishing_target" defaultValue={project.publishing_target ?? ""} disabled={!canEdit}>
                {TARGETS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tags" hint="Comma separated — used for filtering in the library.">
              <Input name="tags" defaultValue={project.tags.join(", ")} placeholder="sea, maps, grief" disabled={!canEdit} />
            </Field>
          </div>
        </Panel>

        <div className="sticky top-20 rounded-xl border border-border bg-ink-900/80 p-4 backdrop-blur">
          <p className="text-[11px] leading-relaxed text-muted">
            {canEdit ? "Changes apply to the whole project immediately." : "Only the owner and editors can change project details."}
          </p>
          <Button type="submit" variant="primary" className="mt-3 w-full" loading={pending} disabled={!canEdit || !dirty}>
            <Save /> Save changes
          </Button>
          {state?.error && <p className="mt-2 text-xs text-red-400">{state.error}</p>}
        </div>
      </aside>
    </form>
  );
}
