"use client";

import * as React from "react";
import { useActionState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  FileText,
  Globe,
  Newspaper,
  PenLine,
  Sparkles,
  Wand2,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea, Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createProjectAction, type ActionState } from "@/lib/actions/projects";

const TYPES = [
  { id: "book", label: "Book", icon: BookOpen, hint: "Novel, memoir, non-fiction" },
  { id: "ebook", label: "E-book", icon: FileText, hint: "Guide, workbook, lead magnet" },
  { id: "article", label: "Article", icon: Newspaper, hint: "Long-form, essay" },
  { id: "blog", label: "Blog series", icon: Globe, hint: "Posts that build on each other" },
  { id: "custom", label: "Custom", icon: Wand2, hint: "Your own structure" },
];

const GENRES = [
  "Literary Fiction", "Fantasy", "Science Fiction", "Mystery", "Thriller", "Romance",
  "Historical Fiction", "Horror", "Young Adult", "Memoir", "Non-fiction", "Self-help",
  "Business", "Poetry", "Children's",
];

export function NewProjectWizard({ plan }: { plan: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(createProjectAction, null);
  const [step, setStep] = React.useState(0);
  const [type, setType] = React.useState("book");

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/app" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground">
        <ArrowLeft className="size-3" /> Library
      </Link>

      <div className="mt-6 flex items-center gap-1.5">
        {["Format", "Details", "Target"].map((label, i) => (
          <React.Fragment key={label}>
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-full border text-[10px]",
                  i === step
                    ? "border-accent bg-accent text-ink-950"
                    : i < step
                      ? "border-accent/40 bg-accent/15 text-accent"
                      : "border-border-strong text-muted",
                )}
              >
                {i + 1}
              </span>
              <span className={cn("text-[11px] uppercase tracking-[0.14em]", i === step ? "text-foreground" : "text-muted")}>
                {label}
              </span>
            </div>
            {i < 2 && <div className="h-px flex-1 bg-border" />}
          </React.Fragment>
        ))}
      </div>

      <h1 className="mt-8 font-serif text-4xl font-semibold tracking-[-0.02em]">Start a new project</h1>
      <p className="mt-2 text-sm text-muted">
        Two minutes of setup saves a lot of lost notes later. Everything can change afterwards.
      </p>

      <form action={formAction} className="mt-8 space-y-8">
        <input type="hidden" name="type" value={type} />

        {step === 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {TYPES.map((t) => {
              const active = type === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setType(t.id)}
                  className={cn(
                    "flex items-start gap-3 rounded-lg border px-4 py-3 text-left transition",
                    active
                      ? "border-accent/60 bg-accent/8"
                      : "border-border bg-card hover:border-border-strong hover:bg-card-hover",
                  )}
                >
                  <t.icon className={cn("mt-0.5 size-4", active ? "text-accent" : "text-muted")} />
                  <div>
                    <p className="text-sm font-medium">{t.label}</p>
                    <p className="text-[11px] text-muted">{t.hint}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4 rounded-xl border border-border bg-card p-5">
            <Field label="Working title">
              <Input name="title" placeholder="The Salt Road" required autoFocus className="text-base" />
            </Field>
            <Field label="Subtitle" hint="Optional — often the series or promise.">
              <Input name="subtitle" placeholder="A novel of the northern coast" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Genre">
                <Select name="genre" defaultValue="">
                  <option value="">Choose…</option>
                  {GENRES.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Publishing target">
                <Select name="publishing_target" defaultValue="">
                  <option value="">Undecided</option>
                  <option value="amazon_kdp">Amazon KDP</option>
                  <option value="smashwords">Smashwords</option>
                  <option value="own_site">Own site</option>
                  <option value="blog">Blog</option>
                  <option value="agent">Traditional / agent</option>
                </Select>
              </Field>
            </div>
            <Field label="Description" hint="The back-cover pitch, roughly.">
              <Textarea name="description" placeholder="A cartographer returns to a town that no longer appears on her maps…" />
            </Field>
            <Field label="Tags" hint="Comma separated — used by the library filters.">
              <Input name="tags" placeholder="slow-burn, coastal, dual-timeline" />
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 rounded-xl border border-border bg-card p-5">
            <Field label="Target word count" hint="A goal, not a cage. Typical novels: 70k–100k.">
              <Input name="target_word_count" type="number" defaultValue={80000} min={0} step={1000} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              {plan === "free" ? (
                <div className="rounded-lg border border-accent/25 bg-accent/8 p-4">
                  <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-accent">
                    <Sparkles className="size-3" /> Free plan
                  </p>
                  <p className="mt-2 text-sm">One active project, all export formats, no collaborators.</p>
                  <Link href="/app/settings/billing" className="mt-2 inline-block text-xs text-accent hover:underline">
                    Compare plans →
                  </Link>
                </div>
              ) : (
                <div className="rounded-lg border border-sage/25 bg-sage/8 p-4">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-sage">{plan} plan</p>
                  <p className="mt-2 text-sm">Unlimited projects, collaborators and API access.</p>
                </div>
              )}
              <div className="rounded-lg border border-border bg-ink-850/60 p-4 text-xs text-muted">
                <p className="mb-1 font-medium text-foreground">What gets created</p>
                <ul className="space-y-0.5">
                  <li>· A first chapter, ready to type</li>
                  <li>· An empty outline and storyboard</li>
                  <li>· Asset library + cover studio</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {state?.error && (
          <p className="rounded-md border border-red-900/50 bg-red-950/40 px-3 py-2 text-xs text-red-300">{state.error}</p>
        )}

        <div className="flex items-center justify-between border-t border-border pt-5">
          <Button type="button" variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            <ArrowLeft /> Back
          </Button>
          {step < 2 ? (
            <Button type="button" variant="primary" onClick={() => setStep((s) => s + 1)}>
              Continue <ArrowRight />
            </Button>
          ) : (
            <Button type="submit" variant="primary" loading={pending}>
              <PenLine /> Create project
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
