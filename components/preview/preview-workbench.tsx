"use client";

import * as React from "react";
import {
  AlignLeft,
  BookOpen,
  Columns2,
  Maximize2,
  Minimize2,
  Monitor,
  Printer,
  RotateCcw,
  Type,
} from "lucide-react";
import { cn, formatNumber, readingTime } from "@/lib/utils";
import { openerLabel } from "@/lib/export/util";
import { Tabs } from "@/components/ui/misc";

type Mode = "ebook" | "blog" | "print";

export interface PreviewChapter {
  id: string;
  title: string;
  synopsis: string | null;
  html: string;
  wordCount: number;
}

interface Props {
  project: {
    title: string;
    subtitle: string | null;
    author: string;
    coverUrl: string | null;
    updatedAt: string;
  };
  chapters: PreviewChapter[];
  initialChapterId: string | null;
}

const MODES: { id: Mode; label: string; icon: React.ReactNode }[] = [
  { id: "ebook", label: "E-book", icon: <BookOpen className="size-3.5" /> },
  { id: "blog", label: "Article", icon: <Monitor className="size-3.5" /> },
  { id: "print", label: "Print", icon: <Printer className="size-3.5" /> },
];

const CSS = `
.pv-root { --pv-font: var(--font-serif); --pv-size: 19px; --pv-leading: 1.7; --pv-measure: 32rem; }
.pv-prose { font-family: var(--pv-font); font-size: var(--pv-size); line-height: var(--pv-leading); }
.pv-prose p { margin: 0 0 0.9em; }
.pv-prose h1, .pv-prose h2, .pv-prose h3, .pv-prose h4 { font-family: var(--font-serif); line-height: 1.2; break-after: avoid; }
.pv-prose h2 { font-size: 1.4em; margin: 1.9em 0 0.55em; }
.pv-prose h3 { font-size: 1.16em; margin: 1.6em 0 0.45em; }
.pv-prose h4 { font-size: 1.02em; margin: 1.4em 0 0.35em; letter-spacing: 0.03em; }
.pv-prose a { color: #8a4b2a; text-underline-offset: 0.18em; }
.pv-prose blockquote { margin: 1.4em 0; padding-left: 1.1em; border-left: 2px solid currentColor; opacity: 0.78; font-style: italic; }
.pv-prose blockquote p { text-indent: 0; }
.pv-prose ul, .pv-prose ol { margin: 0 0 1.1em; padding-left: 1.35em; }
.pv-prose li { margin-bottom: 0.35em; }
.pv-prose hr { border: 0; height: 1.4em; margin: 1.8em 0; text-align: center; opacity: 0.6; }
.pv-prose hr::after { content: "· · ·"; letter-spacing: 0.5em; }
.pv-prose img { max-width: 100%; height: auto; margin: 1.4em auto; display: block; }
.pv-prose figure { margin: 1.4em 0; }
.pv-prose figcaption { font-family: var(--font-sans); font-size: 0.72em; opacity: 0.65; text-align: center; margin-top: 0.4em; }
.pv-prose table { width: 100%; border-collapse: collapse; margin: 1.4em 0; font-size: 0.9em; }
.pv-prose th, .pv-prose td { border-bottom: 1px solid rgba(0,0,0,0.16); padding: 0.45em 0.6em; text-align: left; vertical-align: top; }
.pv-prose th { font-family: var(--font-sans); font-size: 0.76em; letter-spacing: 0.06em; text-transform: uppercase; }
.pv-prose pre { background: rgba(0,0,0,0.06); padding: 0.9em 1em; border-radius: 4px; overflow-x: auto; font-size: 0.82em; line-height: 1.5; }
.pv-prose code { font-family: var(--font-mono); font-size: 0.88em; background: rgba(0,0,0,0.055); padding: 0.08em 0.28em; border-radius: 3px; }
.pv-prose pre code { background: none; padding: 0; }

/* E-book */
.pv-ebook .pv-body p + p { text-indent: 1.45em; margin-top: 0; }
.pv-ebook .pv-body > p:first-of-type::first-letter { float: left; font-family: var(--font-serif); font-size: 3.2em; line-height: 0.8; padding: 0.06em 0.12em 0 0; color: #8a4b2a; }
.pv-opener { text-align: center; margin: 0 0 2.2em; }
.pv-opener .pv-label { font-family: var(--font-sans); font-size: calc(var(--pv-size) * 0.66); letter-spacing: 0.26em; text-transform: uppercase; opacity: 0.55; margin: 0 0 0.9em; }
.pv-opener h1 { font-family: var(--font-serif); font-size: calc(var(--pv-size) * 1.85); font-weight: 400; margin: 0; }
.pv-opener .pv-rule { width: auto; height: auto; background: none; margin: 1rem 0 0; border: 0; text-align: center; font-family: var(--font-serif); opacity: 0.55; font-size: 0.8em; }
.pv-opener .pv-rule::before { content: "· · ·"; letter-spacing: 0.28em; }
.pv-synopsis { font-style: italic; font-size: calc(var(--pv-size) * 0.9); opacity: 0.62; max-width: 25rem; margin: 1em auto 0; line-height: 1.55; }

/* Blog */
.pv-blog .pv-body p { margin-bottom: 1.15em; }
.pv-blog .pv-body h2 { font-family: var(--font-sans); font-weight: 600; letter-spacing: -0.01em; }
.pv-blog .pv-body h3 { font-family: var(--font-sans); font-weight: 600; }
.pv-blog .pv-body h4 { font-family: var(--font-sans); font-weight: 600; }
.pv-blog .pv-body > p:first-of-type { font-size: 1.06em; }

/* Print */
.pv-print .pv-body p + p { text-indent: 1.3em; margin-top: 0; }
.pv-print .pv-body p { margin-bottom: 0; }
.pv-print .pv-body > p:first-of-type { text-indent: 0; }
.pv-page { background: #f7f2e8; color: #241f1a; box-shadow: 0 24px 60px -32px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.4) inset; border: 1px solid rgba(0,0,0,0.08); }
.pv-print .pv-body h2 { font-size: 1.18em; margin-top: 1.6em; }
.pv-print .pv-body h3 { font-size: 1.05em; }
.pv-running-head { font-family: var(--font-sans); font-size: 9px; letter-spacing: 0.22em; text-transform: uppercase; opacity: 0.5; text-align: center; }
.pv-page-number { font-family: var(--font-sans); font-size: 10px; opacity: 0.55; text-align: center; letter-spacing: 0.08em; }
.pv-break { display: flex; align-items: center; gap: 0.9rem; font-family: var(--font-sans); font-size: 9px; letter-spacing: 0.24em; text-transform: uppercase; opacity: 0.4; margin: 2.4rem 0; }
.pv-break::before, .pv-break::after { content: ""; flex: 1; border-top: 1px dashed currentColor; }
.pv-hero-cover { box-shadow: 0 22px 50px -26px rgba(0,0,0,0.6); border-radius: 2px; }
`;

export function PreviewWorkbench({ project, chapters, initialChapterId }: Props) {
  const [mode, setMode] = React.useState<Mode>("ebook");
  const [selected, setSelected] = React.useState<string>(initialChapterId ?? "all");
  const [fullscreen, setFullscreen] = React.useState(false);
  const [family, setFamily] = React.useState<"serif" | "sans">("serif");
  const [size, setSize] = React.useState(19);
  const [leading, setLeading] = React.useState(1.7);
  const [measure, setMeasure] = React.useState(32);

  React.useEffect(() => {
    if (!fullscreen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [fullscreen]);

  const visible = selected === "all" ? chapters : chapters.filter((chapter) => chapter.id === selected);
  const totalWords = visible.reduce((sum, chapter) => sum + chapter.wordCount, 0);
  const isWholeBook = selected === "all" && chapters.length > 1;
  const reset = () => {
    setFamily("serif");
    setSize(19);
    setLeading(1.7);
    setMeasure(32);
  };

  const showBreak = (index: number) => isWholeBook && index > 0;

  return (
    <div
      className={cn(
        "pv-root",
        fullscreen && "fixed inset-0 z-[60] overflow-y-auto bg-background",
      )}
      style={
        {
          "--pv-font": family === "serif" ? "var(--font-serif)" : "var(--font-sans)",
          "--pv-size": `${size}px`,
          "--pv-leading": leading,
          "--pv-measure": `${measure}rem`,
        } as React.CSSProperties
      }
    >
      <style>{CSS}</style>

      <div className={cn("mx-auto flex w-full max-w-[92rem] flex-col lg:flex-row", fullscreen && "min-h-full")}>
        {!fullscreen && (
          <aside className="w-full shrink-0 border-b border-border px-4 py-5 lg:w-[19rem] lg:border-b-0 lg:border-r lg:px-5 lg:py-7">
            <div className="flex items-baseline justify-between">
              <h1 className="font-serif text-2xl">Preview</h1>
              <span className="font-mono text-[11px] text-muted">{formatNumber(totalWords)} words</span>
            </div>
            <p className="mt-1 text-[12px] leading-relaxed text-muted">
              {readingTime(totalWords)} · {visible.length === 1 ? "single chapter" : "whole book"}
            </p>

            <div className="mt-4">
              <Tabs tabs={MODES} value={mode} onChange={(id) => setMode(id as Mode)} className="w-full" />
            </div>

            <div className="mt-6">
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Reading from</p>
              <div className="mt-2 max-h-64 space-y-0.5 overflow-y-auto pr-1">
                <button
                  type="button"
                  onClick={() => setSelected("all")}
                  aria-pressed={selected === "all"}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition",
                    selected === "all" ? "bg-ink-750 text-foreground" : "text-muted-strong hover:bg-ink-850 hover:text-foreground",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Columns2 className="size-3.5" /> Preview whole book
                  </span>
                </button>
                {chapters.map((chapter) => (
                  <button
                    key={chapter.id}
                    type="button"
                    onClick={() => setSelected(chapter.id)}
                    aria-pressed={selected === chapter.id}
                    className={cn(
                      "flex w-full items-start justify-between gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition",
                      selected === chapter.id ? "bg-ink-750 text-foreground" : "text-muted-strong hover:bg-ink-850 hover:text-foreground",
                    )}
                  >
                    <span className="min-w-0 truncate">{chapter.title}</span>
                    <span className="shrink-0 font-mono text-[10px] text-muted">{formatNumber(chapter.wordCount)}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 space-y-4 rounded-xl border border-border bg-card p-3.5">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
                  <Type className="size-3.5" /> Typography
                </p>
                <button type="button" onClick={reset} className="rounded p-1 text-muted hover:bg-ink-800 hover:text-foreground" aria-label="Reset typography">
                  <RotateCcw className="size-3.5" />
                </button>
              </div>

              <div className="flex gap-1 rounded-lg border border-border bg-ink-900/60 p-0.5">
                {(["serif", "sans"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFamily(value)}
                    aria-pressed={family === value}
                    className={cn(
                      "flex-1 rounded-md px-2 py-1.5 text-[12px] transition",
                      value === "serif" ? "font-serif" : "font-sans",
                      family === value ? "bg-ink-750 text-foreground" : "text-muted hover:text-muted-strong",
                    )}
                  >
                    {value === "serif" ? "Serif" : "Sans"}
                  </button>
                ))}
              </div>

              <label className="block">
                <span className="flex items-center justify-between text-[11px] text-muted">
                  <span>Size</span>
                  <span className="font-mono">{size}px</span>
                </span>
                <input
                  type="range"
                  min={15}
                  max={27}
                  step={1}
                  value={size}
                  onChange={(event) => setSize(Number(event.target.value))}
                  className="mt-1.5 w-full accent-accent"
                  aria-label="Preview font size"
                />
              </label>

              <label className="block">
                <span className="flex items-center justify-between text-[11px] text-muted">
                  <span>Line height</span>
                  <span className="font-mono">{leading.toFixed(2)}</span>
                </span>
                <input
                  type="range"
                  min={1.3}
                  max={2.1}
                  step={0.05}
                  value={leading}
                  onChange={(event) => setLeading(Number(event.target.value))}
                  className="mt-1.5 w-full accent-accent"
                  aria-label="Preview line height"
                />
              </label>

              <label className="block">
                <span className="flex items-center justify-between text-[11px] text-muted">
                  <span>Measure</span>
                  <span className="font-mono">{measure}rem</span>
                </span>
                <input
                  type="range"
                  min={24}
                  max={44}
                  step={1}
                  value={measure}
                  onChange={(event) => setMeasure(Number(event.target.value))}
                  className="mt-1.5 w-full accent-accent"
                  aria-label="Preview line length"
                />
              </label>
              <p className="flex items-start gap-1.5 text-[10px] leading-snug text-muted">
                <AlignLeft className="mt-0.5 size-3 shrink-0" />
                Typography is preview-only — it never changes the manuscript.
              </p>
            </div>
          </aside>
        )}

        <section className={cn("min-w-0 flex-1", fullscreen ? "px-4 py-4 md:px-8" : "px-4 py-5 md:px-8 md:py-7")}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted">
              {fullscreen ? (
                <Tabs tabs={MODES} value={mode} onChange={(id) => setMode(id as Mode)} />
              ) : (
                <>
                  <span className="flex items-center gap-1.5">
                    {MODES.find((m) => m.id === mode)?.icon}
                    {MODES.find((m) => m.id === mode)?.label}
                  </span>
                  <span className="text-border-strong">/</span>
                  <span className="normal-case tracking-normal text-muted-strong">
                    {selected === "all" ? project.title : chapters.find((c) => c.id === selected)?.title}
                  </span>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => setFullscreen(!fullscreen)}
              className="rounded-md border border-border-strong p-1.5 text-muted hover:bg-ink-800 hover:text-foreground"
              aria-label={fullscreen ? "Exit fullscreen preview" : "Fullscreen preview"}
            >
              {fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </button>
          </div>

          {visible.length === 0 ? (
            <div className="rounded-xl border border-border bg-card p-10 text-center text-sm text-muted">
              This project has no chapters to preview yet.
            </div>
          ) : mode === "ebook" ? (
            <div className="rounded-xl border border-border bg-paper px-4 py-10 text-paper-ink shadow-[0_28px_70px_-40px_rgba(0,0,0,0.7)] md:px-10 md:py-16">
              {isWholeBook && (
                <header className="mb-14 text-center">
                  {project.coverUrl && (
                    <img src={project.coverUrl} alt="" className="pv-hero-cover mx-auto mb-8 max-h-72 w-auto" />
                  )}
                  {project.subtitle && <p className="mb-3 text-[11px] uppercase tracking-[0.28em] text-ink-500">{project.subtitle}</p>}
                  <h2 className="font-serif text-4xl leading-tight text-paper-ink">{project.title}</h2>
                  {project.author && <p className="mt-4 text-[11px] uppercase tracking-[0.22em] text-ink-500">{project.author}</p>}
                </header>
              )}
              {visible.map((chapter, index) => (
                <React.Fragment key={chapter.id}>
                  {showBreak(index) && <div className="pv-break text-paper-ink">Page break</div>}
                  <article className="mx-auto" style={{ maxWidth: "var(--pv-measure)" }}>
                    <header className="pv-opener">
                      {openerLabel(chapter.title, chapters.indexOf(chapter)) && (
                        <p className="pv-label">{openerLabel(chapter.title, chapters.indexOf(chapter))}</p>
                      )}
                      <h1 className="pv-heading">{chapter.title}</h1>
                      <hr className="pv-rule" />
                      {chapter.synopsis && <p className="pv-synopsis">{chapter.synopsis}</p>}
                    </header>
                    <div
                      className="pv-prose pv-body"
                      dangerouslySetInnerHTML={{ __html: chapter.html || "<p><em>This chapter is empty.</em></p>" }}
                    />
                  </article>
                </React.Fragment>
              ))}
            </div>
          ) : mode === "blog" ? (
            <div className="rounded-xl border border-border bg-card px-5 py-10 md:px-12 md:py-14">
              <div className="mx-auto" style={{ maxWidth: "var(--pv-measure)" }}>
                <header className={cn("border-b border-border pb-8", isWholeBook ? "mb-10 text-center" : "mb-8")}>
                  {isWholeBook ? (
                    <>
                      {project.subtitle && <p className="text-[11px] uppercase tracking-[0.22em] text-accent">{project.subtitle}</p>}
                      <h2 className="mt-2 font-serif text-4xl leading-tight">{project.title}</h2>
                      <p className="mt-3 text-[12px] text-muted">
                        {project.author || "Inkwell Studio"} · {formatNumber(totalWords)} words · {readingTime(totalWords)}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-accent">Article</p>
                      <h2 className="mt-2 font-serif text-3xl leading-tight md:text-4xl">{visible[0].title}</h2>
                      <p className="mt-3 flex flex-wrap items-center gap-x-2 text-[12px] text-muted" suppressHydrationWarning>
                        <span>{project.author || "Inkwell Studio"}</span>
                        <span aria-hidden="true">·</span>
                        <span>{new Date(project.updatedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span>
                        <span aria-hidden="true">·</span>
                        <span>{formatNumber(visible[0].wordCount)} words</span>
                        <span aria-hidden="true">·</span>
                        <span>{readingTime(visible[0].wordCount)}</span>
                      </p>
                    </>
                  )}
                </header>
                {visible.map((chapter, index) => (
                  <React.Fragment key={chapter.id}>
                    {showBreak(index) && <div className="pv-break text-foreground">Next chapter</div>}
                    {isWholeBook && (
                      <h3 className="mb-4 font-serif text-2xl leading-tight">{chapter.title}</h3>
                    )}
                    <div
                      className="pv-prose pv-body text-foreground"
                      dangerouslySetInnerHTML={{ __html: chapter.html || "<p><em>This chapter is empty.</em></p>" }}
                    />
                  </React.Fragment>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {visible.map((chapter, index) => (
                <React.Fragment key={chapter.id}>
                  {showBreak(index) && <div className="pv-break text-muted">Page break</div>}
                  <div className="flex justify-center">
                    <div
                      className="pv-page w-full max-w-[36rem] px-8 py-8 md:px-14 md:py-12"
                      style={{ minHeight: "42rem" }}
                    >
                      <p className="pv-running-head">{project.title}</p>
                      <article className="mt-10" style={{ maxWidth: "var(--pv-measure)" }}>
                        <header className="mb-8 text-center">
                          {openerLabel(chapter.title, chapters.indexOf(chapter)) && (
                            <p className="mb-3 text-[10px] uppercase tracking-[0.24em] opacity-55">
                              {openerLabel(chapter.title, chapters.indexOf(chapter))}
                            </p>
                          )}
                          <h1 className="font-serif text-3xl leading-tight">{chapter.title}</h1>
                          <p className="mt-4 text-center text-[10px] tracking-[0.4em] opacity-40">· · ·</p>
                        </header>
                        <div
                          className="pv-prose pv-body"
                          dangerouslySetInnerHTML={{ __html: chapter.html || "<p><em>This chapter is empty.</em></p>" }}
                        />
                      </article>
                      <p className="pv-page-number mt-14">— {index + 1} —</p>
                    </div>
                  </div>
                </React.Fragment>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
