"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  Braces,
  Check,
  ChevronDown,
  Download,
  FileCode2,
  FileText,
  Globe2,
  Loader2,
  Monitor,
  Printer,
  RefreshCw,
  Sparkles,
  Type,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button-variants";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Select } from "@/components/ui/input";
import { EmptyState, Switch } from "@/components/ui/misc";
import { cn, relativeTime } from "@/lib/utils";
import { startExportAction, retryExportAction } from "@/lib/actions/export";
import { FORMAT_META, FORMAT_ORDER, type ExportFormat, type ExportOptions } from "@/lib/export/types";
import type { ExportJob } from "@/lib/types";

type StyleName = "literary" | "modern" | "minimal";

interface ChapterOption {
  id: string;
  title: string;
  wordCount: number;
  position: number;
}

interface Props {
  projectId: string;
  projectTitle: string;
  hasCover: boolean;
  chapters: ChapterOption[];
  initialJobs: ExportJob[];
  shareUrl: string | null;
  canExport: boolean;
}

const FORMAT_ICONS: Record<ExportFormat, React.ReactNode> = {
  epub: <BookOpen />,
  pdf: <Printer />,
  pdf_screen: <Monitor />,
  docx: <FileText />,
  markdown: <FileCode2 />,
  html: <Globe2 />,
  json: <Braces />,
};

const STYLES: { id: StyleName; name: string; blurb: string; sample: string; sampleClass: string }[] = [
  {
    id: "literary",
    name: "Literary",
    blurb: "Justified serif text, indented paragraphs, a drop cap.",
    sample: "Garamond warmth",
    sampleClass: "font-serif italic",
  },
  {
    id: "modern",
    name: "Modern",
    blurb: "Crisp sans headings, airy leading, left-aligned.",
    sample: "Clean & contemporary",
    sampleClass: "font-sans",
  },
  {
    id: "minimal",
    name: "Minimal",
    blurb: "Small-caps labels, hairline rules, quiet typography.",
    sample: "NOTHING EXTRA",
    sampleClass: "font-serif uppercase tracking-[0.22em] text-[11px]",
  },
];

const PAGE_SIZES: { value: NonNullable<ExportOptions["pageSize"]>; label: string }[] = [
  { value: "6x9", label: "6 × 9 in (trade)" },
  { value: "a5", label: "A5" },
  { value: "a4", label: "A4" },
];

const STATUS_TONE: Record<ExportJob["status"], "amber" | "accent" | "sage" | "red"> = {
  queued: "amber",
  processing: "accent",
  done: "sage",
  failed: "red",
};

const STATUS_LABEL: Record<ExportJob["status"], string> = {
  queued: "Queued",
  processing: "Typesetting",
  done: "Ready",
  failed: "Failed",
};

function sizeLabel(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function jobTitle(job: ExportJob, chapters: ChapterOption[]): string {
  const format = FORMAT_META[job.format]?.label ?? job.format;
  if (job.scope === "chapter") {
    const chapter = chapters.find((c) => c.id === job.chapter_id);
    return `${format} · ${chapter?.title ?? "Chapter"}`;
  }
  return format;
}

export function ExportWorkbench({ projectId, projectTitle, hasCover, chapters, initialJobs, shareUrl, canExport }: Props) {
  const [format, setFormat] = React.useState<ExportFormat>("epub");
  const [style, setStyle] = React.useState<StyleName>("literary");
  const [scope, setScope] = React.useState<"project" | "chapter">("project");
  const [chapterId, setChapterId] = React.useState<string>(chapters[0]?.id ?? "");
  const [includeCover, setIncludeCover] = React.useState(hasCover);
  const [includeToc, setIncludeToc] = React.useState(true);
  const [includeSynopses, setIncludeSynopses] = React.useState(false);
  const [dropCaps, setDropCaps] = React.useState(true);
  const [chapterBreaks, setChapterBreaks] = React.useState(true);
  const [pageSize, setPageSize] = React.useState<NonNullable<ExportOptions["pageSize"]>>("6x9");
  const [jobs, setJobs] = React.useState<ExportJob[]>(initialJobs);
  const [busy, setBusy] = React.useState(false);
  const [retrying, setRetrying] = React.useState<string | null>(null);

  // Drop caps are part of the Literary template; Modern and Minimal opt out.
  React.useEffect(() => {
    setDropCaps(style === "literary");
  }, [style]);

  const meta = FORMAT_META[format];
  const isPdf = format === "pdf";
  const isScreenPdf = format === "pdf_screen";

  // Poll queued/processing jobs until they settle.
  React.useEffect(() => {
    const pending = jobs.filter((job) => job.status === "queued" || job.status === "processing");
    if (!pending.length) return;
    let cancelled = false;
    const timer = setInterval(async () => {
      const updates = await Promise.all(
        pending.map(async (job) => {
          try {
            const res = await fetch(`/api/exports/${job.id}`, { cache: "no-store" });
            if (!res.ok) return null;
            return (await res.json()) as Partial<ExportJob> & { id: string };
          } catch {
            return null;
          }
        }),
      );
      if (cancelled) return;
      setJobs((prev) =>
        prev.map((job) => {
          const update = updates.find((u) => u?.id === job.id);
          return update ? { ...job, ...update } : job;
        }),
      );
    }, 1500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [jobs]);

  const onExport = async () => {
    setBusy(true);
    try {
      const result = await startExportAction({
        projectId,
        format,
        style,
        scope,
        chapterId: scope === "chapter" ? chapterId : null,
        options: {
          includeCover,
          includeToc,
          includeSynopses,
          dropCaps,
          chapterBreaks,
          pageSize,
          author: undefined,
        },
      });
      if (result.ok) {
        setJobs((prev) => [result.job, ...prev.filter((job) => job.id !== result.job.id)]);
        toast.success(`${meta.label} is ready`, {
          description: result.job.size_bytes ? `${sizeLabel(result.job.size_bytes)} · ${scope === "chapter" ? "single chapter" : projectTitle}` : undefined,
        });
      } else {
        if (result.job) setJobs((prev) => [result.job as ExportJob, ...prev.filter((job) => job.id !== result.job?.id)]);
        toast.error("Export failed", { description: result.error });
      }
    } catch (error) {
      toast.error("Export failed", { description: error instanceof Error ? error.message : "Unexpected error" });
    } finally {
      setBusy(false);
    }
  };

  const onRetry = async (job: ExportJob) => {
    setRetrying(job.id);
    try {
      const result = await retryExportAction(job.id);
      if (result.ok) {
        setJobs((prev) => prev.map((row) => (row.id === result.job.id ? result.job : row)));
        toast.success(`${FORMAT_META[result.job.format]?.label ?? "Export"} rebuilt`);
      } else {
        if (result.job) setJobs((prev) => prev.map((row) => (row.id === result.job?.id ? (result.job as ExportJob) : row)));
        toast.error("Retry failed", { description: result.error });
      }
    } finally {
      setRetrying(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-8">
      {!canExport && (
        <div className="mb-5 rounded-lg border border-amber-700/40 bg-amber-900/15 px-3.5 py-2.5 text-[12px] text-amber-200">
          You have view-only access to this project. Existing downloads are available, but only editors
          and the owner can create new exports.
        </div>
      )}

      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Export &amp; publish</p>
          <h1 className="mt-1 font-serif text-3xl">Take the book with you</h1>
          <p className="mt-1.5 max-w-xl text-sm text-muted">
            Typeset {projectTitle} as a reading copy, a manuscript, or a clean file for the web. Every
            format is generated from the current chapters — nothing is baked in.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted">
          <Sparkles className="size-3.5 text-accent" />
          {chapters.length} {chapters.length === 1 ? "chapter" : "chapters"} ·{" "}
          {chapters.reduce((sum, c) => sum + c.wordCount, 0).toLocaleString("en-US")} words
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-6">
          <section aria-labelledby="format-heading">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="format-heading" className="font-serif text-lg">
                1. Format
              </h2>
              <span className="text-[11px] text-muted">{meta.ext.toUpperCase()}</span>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {FORMAT_ORDER.map((id) => {
                const item = FORMAT_META[id];
                const active = id === format;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setFormat(id)}
                    aria-pressed={active}
                    className={cn(
                      "group flex items-start gap-3 rounded-xl border p-3.5 text-left transition",
                      active
                        ? "border-accent/60 bg-accent/[0.07] shadow-[0_0_0_1px_rgba(200,129,74,0.25)_inset]"
                        : "border-border bg-card hover:border-border-strong hover:bg-card-hover",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md border [&_svg]:size-4",
                        active ? "border-accent/40 bg-accent/15 text-accent" : "border-border-strong bg-ink-850 text-muted-strong",
                      )}
                    >
                      {FORMAT_ICONS[id]}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-medium">{item.label}</span>
                        {active && <Check className="size-3.5 text-accent" aria-hidden="true" />}
                      </span>
                      <span className="mt-1 block text-[12px] leading-relaxed text-muted">{item.blurb}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="style-heading">
            <h2 id="style-heading" className="mb-3 font-serif text-lg">
              2. Style
            </h2>
            <div className="grid gap-2.5 sm:grid-cols-3">
              {STYLES.map((item) => {
                const active = style === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setStyle(item.id)}
                    aria-pressed={active}
                    className={cn(
                      "rounded-xl border p-3 text-left transition",
                      active ? "border-accent/60 bg-accent/[0.06]" : "border-border bg-card hover:border-border-strong",
                    )}
                  >
                    <span className="flex h-16 flex-col justify-center gap-1 rounded-md border border-border bg-paper px-3 text-paper-ink">
                      <span className={cn("truncate text-[13px] leading-tight", item.sampleClass)}>{item.sample}</span>
                      <span className="flex flex-col gap-[3px]" aria-hidden="true">
                        <span className="h-px w-full bg-ink-900/25" />
                        <span className="h-px w-4/5 bg-ink-900/20" />
                        <span className="h-px w-11/12 bg-ink-900/15" />
                      </span>
                    </span>
                    <span className="mt-2 flex items-center gap-1.5 text-[13px] font-medium">
                      {item.name}
                      {active && <Check className="size-3.5 text-accent" />}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-relaxed text-muted">{item.blurb}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="scope-heading" className="grid gap-4 sm:grid-cols-2">
            <div>
              <h2 id="scope-heading" className="mb-3 font-serif text-lg">
                3. Scope
              </h2>
              <div className="flex gap-1 rounded-lg border border-border bg-ink-900/60 p-1">
                <button
                  type="button"
                  onClick={() => setScope("project")}
                  aria-pressed={scope === "project"}
                  className={cn(
                    "flex-1 rounded-md px-3 py-2 text-[13px] transition",
                    scope === "project" ? "bg-ink-750 text-foreground" : "text-muted hover:text-muted-strong",
                  )}
                >
                  Whole project
                </button>
                <button
                  type="button"
                  onClick={() => setScope("chapter")}
                  aria-pressed={scope === "chapter"}
                  className={cn(
                    "flex-1 rounded-md px-3 py-2 text-[13px] transition",
                    scope === "chapter" ? "bg-ink-750 text-foreground" : "text-muted hover:text-muted-strong",
                  )}
                >
                  Single chapter
                </button>
              </div>
              {scope === "chapter" && (
                <Field className="mt-3" label="Chapter">
                  <div className="relative">
                    <Select
                      value={chapterId}
                      onChange={(event) => setChapterId(event.target.value)}
                      aria-label="Chapter to export"
                    >
                      {chapters.map((chapter) => (
                        <option key={chapter.id} value={chapter.id}>
                          {chapter.title}
                        </option>
                      ))}
                    </Select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
                  </div>
                </Field>
              )}
            </div>

            <div>
              <h2 className="mb-3 font-serif text-lg">4. Options</h2>
              <div className="space-y-2.5 rounded-xl border border-border bg-card p-3.5">
                <Switch checked={includeCover} onChange={setIncludeCover} label="Include cover" />
                <p className="text-[11px] leading-snug text-muted">
                  {hasCover ? "Uses the project cover image where the format supports it." : "No cover image is set on this project yet."}
                </p>
                <div className="h-px bg-border" />
                <Switch checked={includeToc} onChange={setIncludeToc} label="Table of contents" />
                <Switch checked={includeSynopses} onChange={setIncludeSynopses} label="Chapter synopses" />
                <Switch checked={dropCaps} onChange={setDropCaps} label="Drop caps" />
                {isScreenPdf && (
                  <>
                    <div className="h-px bg-border" />
                    <Switch checked={chapterBreaks} onChange={setChapterBreaks} label="Chapter page breaks" />
                  </>
                )}
                {isPdf && (
                  <Field label="Trim size" className="pt-1">
                    <Select value={pageSize} onChange={(event) => setPageSize(event.target.value as NonNullable<ExportOptions["pageSize"]>)}>
                      {PAGE_SIZES.map((size) => (
                        <option key={size.value} value={size.value}>
                          {size.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
              </div>
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-ink-900/50 p-3.5">
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm">
                <Type className="size-4 text-muted" />
                {meta.label} · <span className="text-muted">{style[0].toUpperCase() + style.slice(1)}</span>
              </p>
              <p className="mt-0.5 text-[11px] text-muted">
                {scope === "chapter"
                  ? chapters.find((c) => c.id === chapterId)?.title ?? "Choose a chapter"
                  : "Includes every chapter, front matter and contents"}
                {isPdf ? ` · ${PAGE_SIZES.find((p) => p.value === pageSize)?.label}` : ""}
              </p>
            </div>
            <Button
              variant="primary"
              size="lg"
              onClick={onExport}
              loading={busy}
              disabled={!canExport || (scope === "chapter" && !chapterId)}
            >
              {!busy && <Download />}
              {busy ? "Typesetting…" : "Export"}
            </Button>
          </div>
        </div>

        <aside className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Recent exports</CardTitle>
                {jobs.some((job) => job.status === "processing" || job.status === "queued") && (
                  <Loader2 className="size-3.5 animate-spin text-accent" aria-label="Generating" />
                )}
              </div>
              <CardDescription className="text-[12px]">Downloads stay available from storage.</CardDescription>
            </CardHeader>
            <CardContent className="pt-1">
              {jobs.length === 0 ? (
                <EmptyState
                  className="py-8"
                  icon={<Download />}
                  title="Nothing exported yet"
                  description="Choose a format and your first file will appear here."
                />
              ) : (
                <ul className="divide-y divide-border">
                  {jobs.slice(0, 8).map((job) => {
                    const isActive = job.status === "queued" || job.status === "processing";
                    return (
                      <li key={job.id} className="py-3 first:pt-0 last:pb-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium">{jobTitle(job, chapters)}</p>
                            <p className="mt-0.5 text-[11px] text-muted" suppressHydrationWarning>
                              {relativeTime(job.created_at)} · {sizeLabel(job.size_bytes)}
                            </p>
                          </div>
                          <Badge tone={STATUS_TONE[job.status]} className="shrink-0">
                            {isActive && <Loader2 className="size-2.5 animate-spin" />}
                            {STATUS_LABEL[job.status]}
                          </Badge>
                        </div>
                        {job.status === "failed" && (
                          <div className="mt-2 flex items-start gap-2 rounded-md border border-red-900/50 bg-red-950/30 p-2">
                            <AlertTriangle className="mt-0.5 size-3 shrink-0 text-red-400" />
                            <p className="min-w-0 flex-1 break-words text-[11px] leading-snug text-red-300">
                              {job.error ?? "Export failed."}
                            </p>
                          </div>
                        )}
                        <div className="mt-2 flex items-center gap-1.5">
                          {job.status === "done" && job.download_url ? (
                            <a
                              href={job.download_url}
                              target="_blank"
                              rel="noreferrer"
                              className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "h-7 text-[11px]")}
                            >
                              <Download className="size-3" /> Download
                            </a>
                          ) : null}
                          {job.status === "failed" && canExport && (
                            <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => onRetry(job)} loading={retrying === job.id}>
                              {retrying !== job.id && <RefreshCw className="size-3" />} Retry
                            </Button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Public reading link</CardTitle>
              <CardDescription className="text-[12px]">
                {shareUrl ? "Readers see a typeset, read-only version — no account needed." : "Turn on the public link from the Share menu to give beta readers access."}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-1">
              {shareUrl ? (
                <Link href={shareUrl} target="_blank" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full")}>
                  Open public reader <ArrowUpRight className="size-3.5" />
                </Link>
              ) : (
                <p className="text-[11px] leading-relaxed text-muted">Sharing is off. You can still export any format above.</p>
              )}
            </CardContent>
          </Card>

          <p className="px-1 text-[11px] leading-relaxed text-muted">
            Exports are generated server-side from the latest saved chapters. Files are kept in the
            project&apos;s export storage and can be re-downloaded at any time.
          </p>
        </aside>
      </div>
    </div>
  );
}
