"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, BookOpen, Minus, Plus, Printer, Type } from "lucide-react";
import { cn, formatNumber, readingTime } from "@/lib/utils";
import { STYLE_TEMPLATES } from "@/lib/export/styles";
import type { StyleName } from "@/lib/export/types";

export interface ShareChapter {
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
    description: string | null;
    genre: string | null;
    coverUrl: string | null;
  };
  chapters: ShareChapter[];
  theme: StyleName;
  chapterScoped: boolean;
}

const CSS = `
.sr-root { --sr-size: 19px; background: var(--sr-paper); color: var(--sr-ink); font-family: var(--sr-body); }
.sr-prose { font-family: var(--sr-body); font-size: var(--sr-size); line-height: 1.76; }
.sr-prose p { margin: 0 0 0.9em; }
.sr-body p + p { text-indent: 1.4em; margin-top: 0; }
.sr-body > p:first-of-type { text-indent: 0; }
.sr-body > p:first-of-type::first-letter { float: left; font-family: var(--sr-heading); font-size: 3.2em; line-height: 0.8; padding: 0.06em 0.12em 0 0; color: var(--sr-accent); }
.sr-no-drop .sr-body > p:first-of-type::first-letter { float: none; font-size: inherit; line-height: inherit; padding: 0; color: inherit; }
.sr-prose h1, .sr-prose h2, .sr-prose h3, .sr-prose h4 { font-family: var(--sr-heading); line-height: 1.22; }
.sr-prose h2 { font-size: 1.35em; margin: 1.9em 0 0.55em; }
.sr-prose h3 { font-size: 1.13em; margin: 1.6em 0 0.45em; }
.sr-prose h4 { font-size: 1em; margin: 1.4em 0 0.35em; letter-spacing: 0.04em; }
.sr-prose a { color: var(--sr-accent); text-underline-offset: 0.18em; }
.sr-prose blockquote { margin: 1.4em 0; padding-left: 1.1em; border-left: 2px solid var(--sr-rule); color: var(--sr-muted); font-style: italic; }
.sr-prose blockquote p { text-indent: 0; }
.sr-prose ul, .sr-prose ol { padding-left: 1.35em; margin: 0 0 1.1em; }
.sr-prose li { margin-bottom: 0.35em; }
.sr-prose hr { border: 0; text-align: center; margin: 2em 0; color: var(--sr-muted); }
.sr-prose hr::after { content: "· · ·"; letter-spacing: 0.55em; }
.sr-prose img { max-width: 100%; height: auto; margin: 1.5em auto; display: block; }
.sr-prose figure { margin: 1.5em 0; }
.sr-prose figcaption { font-family: var(--sr-label); font-size: 0.74em; color: var(--sr-muted); text-align: center; margin-top: 0.45em; }
.sr-prose table { width: 100%; border-collapse: collapse; margin: 1.4em 0; font-size: 0.9em; }
.sr-prose th, .sr-prose td { border-bottom: 1px solid var(--sr-rule); padding: 0.45em 0.6em; text-align: left; vertical-align: top; }
.sr-prose th { font-family: var(--sr-label); font-size: 0.76em; letter-spacing: 0.07em; text-transform: uppercase; }
.sr-prose pre { background: rgba(0,0,0,0.055); padding: 0.9em 1em; overflow-x: auto; font-size: 0.82em; line-height: 1.5; }
.sr-prose code { font-family: var(--font-mono); font-size: 0.88em; background: rgba(0,0,0,0.05); padding: 0.08em 0.28em; border-radius: 3px; }
.sr-prose pre code { background: none; padding: 0; }
.sr-hero { background: var(--sr-hero); color: var(--sr-hero-ink); position: relative; overflow: hidden; }
.sr-hero::after { content: ""; position: absolute; inset: 0; background: repeating-linear-gradient(0deg, rgba(255,255,255,0.018) 0 1px, transparent 1px 3px); pointer-events: none; }
.sr-cover { box-shadow: 0 32px 70px -30px rgba(0,0,0,0.75); border-radius: 2px; }
.sr-eyebrow { font-family: var(--sr-label); font-size: 10px; letter-spacing: 0.28em; text-transform: uppercase; opacity: 0.62; }
.sr-title { font-family: var(--sr-heading); font-weight: 400; line-height: 1.02; letter-spacing: -0.01em; }
.sr-author { font-family: var(--sr-label); font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; opacity: 0.78; }
.sr-opener { text-align: center; margin: 0 0 2.6rem; }
.sr-opener .label { font-family: var(--sr-label); font-size: calc(var(--sr-size) * 0.53); letter-spacing: 0.26em; text-transform: uppercase; color: var(--sr-muted); margin-bottom: 0.9rem; }
.sr-opener h2 { font-family: var(--sr-heading); font-size: calc(var(--sr-size) * 1.9); font-weight: 400; line-height: 1.15; margin: 0; }
.sr-opener .rule { width: 3rem; height: 1px; background: var(--sr-rule); margin: 1.3rem auto 0; }
.sr-opener .synopsis { font-style: italic; color: var(--sr-muted); font-size: calc(var(--sr-size) * 0.92); max-width: 25rem; margin: 1rem auto 0; line-height: 1.55; }
.sr-chapter { scroll-margin-top: 2rem; }
.sr-toc-link { display: flex; align-items: baseline; justify-content: space-between; gap: 0.6rem; border-left: 2px solid transparent; color: var(--sr-muted); }
.sr-toc-link:hover { color: var(--sr-ink); background: rgba(0,0,0,0.03); }
.sr-toc-link[data-active="true"] { border-color: var(--sr-accent); color: var(--sr-ink); background: rgba(0,0,0,0.035); }
.sr-progress-bar { position: fixed; top: 0; left: 0; height: 2px; background: var(--sr-accent); z-index: 50; transition: width 120ms linear; }
.sr-range { accent-color: var(--sr-accent); }
@media (max-width: 1023px) { .sr-title { font-size: clamp(2.6rem, 9vw, 3.4rem); } }
@media print {
  .sr-no-print { display: none !important; }
  .sr-root { background: #fff; color: #000; }
  .sr-hero { background: #fff; color: #000; padding-top: 0 !important; padding-bottom: 1.5rem !important; border-bottom: 1px solid #ccc; }
  .sr-hero::after { display: none; }
  .sr-cover { box-shadow: none; max-height: 8rem; }
  .sr-chapter { break-before: page; page-break-before: always; }
  .sr-chapter:first-of-type { break-before: auto; page-break-before: auto; }
  .sr-prose a { color: inherit; text-decoration: none; }
  .sr-body > p:first-of-type::first-letter { color: #000; }
  .sr-main { max-width: none !important; }
}
`;

function chapterLabel(title: string, index: number): string {
  if (/^\s*(chapter|part|prologue|epilogue|interlude|appendix|introduction|foreword)\b/i.test(title)) return "";
  return `Chapter ${index + 1}`;
}

export function ShareReader({ project, chapters, theme, chapterScoped }: Props) {
  const style = STYLE_TEMPLATES[theme] ?? STYLE_TEMPLATES.literary;
  const [size, setSize] = React.useState(19);
  const [family, setFamily] = React.useState<"serif" | "sans">("serif");
  const [active, setActive] = React.useState(chapters[0]?.id ?? "");
  const [progress, setProgress] = React.useState(0);

  const totalWords = chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0);

  React.useEffect(() => {
    const sections = chapters
      .map((chapter) => document.getElementById(`chapter-${chapter.id}`))
      .filter((el): el is HTMLElement => Boolean(el));
    if (!sections.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) setActive(visible[0].target.id.replace("chapter-", ""));
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: [0, 1] },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [chapters]);

  React.useEffect(() => {
    const onScroll = () => {
      const root = document.documentElement;
      const max = root.scrollHeight - root.clientHeight;
      setProgress(max > 0 ? Math.min(100, Math.max(0, (root.scrollTop / max) * 100)) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={cn("sr-root min-h-screen", !style.dropCap && "sr-no-drop")}
      style={
        {
          "--sr-ink": style.colors.ink,
          "--sr-muted": style.colors.muted,
          "--sr-accent": style.colors.accent,
          "--sr-rule": style.colors.rule,
          "--sr-paper": style.colors.paper,
          "--sr-hero": style.colors.coverInk,
          "--sr-hero-ink": "#f2eadf",
          "--sr-body": family === "serif" ? style.bodyFont : 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
          "--sr-heading": style.headingFont,
          "--sr-label": style.labelFont,
          "--sr-size": `${size}px`,
        } as React.CSSProperties
      }
    >
      <style>{CSS}</style>
      <div className="sr-progress-bar sr-no-print" style={{ width: `${progress}%` }} aria-hidden="true" />

      <header className="sr-hero px-5 py-14 md:py-20">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-9 text-center md:flex-row md:items-end md:text-left">
          {project.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={project.coverUrl} alt={`${project.title} cover`} className="sr-cover max-h-72 w-auto shrink-0 md:max-h-80" />
          )}
          <div className="min-w-0">
            <p className="sr-eyebrow">{project.genre || "A reading copy from Inkwell Studio"}</p>
            <h1 className="sr-title mt-3 text-5xl md:text-6xl">{project.title}</h1>
            {project.subtitle && (
              <p className="mt-3 font-serif text-lg italic opacity-70">{project.subtitle}</p>
            )}
            {project.author && <p className="sr-author mt-6">by {project.author}</p>}
            {project.description && (
              <p className="mx-auto mt-5 max-w-lg text-[13px] leading-relaxed opacity-65 md:mx-0">{project.description}</p>
            )}
            <p className="mt-6 flex flex-wrap items-center justify-center gap-x-2 text-[11px] opacity-55 md:justify-start">
              <span>{chapterScoped ? "Excerpt" : `${chapters.length} ${chapters.length === 1 ? "chapter" : "chapters"}`}</span>
              <span aria-hidden="true">·</span>
              <span>{formatNumber(totalWords)} words</span>
              <span aria-hidden="true">·</span>
              <span>{readingTime(totalWords)}</span>
            </p>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-14 lg:px-8 lg:py-16">
        <aside className="sr-no-print lg:sticky lg:top-10 lg:h-fit">
          {!chapterScoped && chapters.length > 1 && (
            <nav aria-label="Contents">
              <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.2em] text-muted" style={{ color: "var(--sr-muted)" }}>
                <BookOpen className="size-3" /> Contents
              </p>
              <ol className="mt-3 space-y-0.5">
                {chapters.map((chapter, index) => (
                  <li key={chapter.id}>
                    <a
                      href={`#chapter-${chapter.id}`}
                      data-active={active === chapter.id}
                      className="sr-toc-link rounded-r-md px-2 py-1.5 text-[12.5px] leading-snug transition"
                    >
                      <span className="min-w-0">
                        <span className="mr-1.5 font-mono text-[10px] opacity-55">{String(index + 1).padStart(2, "0")}</span>
                        {chapter.title}
                      </span>
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          )}

          <div className="mt-7 rounded-lg border p-3" style={{ borderColor: "var(--sr-rule)" }}>
            <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.16em]" style={{ color: "var(--sr-muted)" }}>
              <Type className="size-3" /> Reading settings
            </p>
            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSize((value) => Math.max(15, value - 1))}
                className="flex size-7 items-center justify-center rounded border text-sm transition hover:bg-black/[0.04]"
                style={{ borderColor: "var(--sr-rule)" }}
                aria-label="Decrease text size"
              >
                <Minus className="size-3" />
              </button>
              <span className="min-w-[3rem] text-center font-mono text-[11px]" style={{ color: "var(--sr-muted)" }}>
                {size}px
              </span>
              <button
                type="button"
                onClick={() => setSize((value) => Math.min(28, value + 1))}
                className="flex size-7 items-center justify-center rounded border text-sm transition hover:bg-black/[0.04]"
                style={{ borderColor: "var(--sr-rule)" }}
                aria-label="Increase text size"
              >
                <Plus className="size-3" />
              </button>
            </div>
            <div className="mt-2 flex gap-1">
              {(["serif", "sans"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFamily(value)}
                  aria-pressed={family === value}
                  className={cn(
                    "flex-1 rounded border px-2 py-1 text-[11px] transition",
                    value === "serif" ? "font-serif" : "font-sans",
                    family === value ? "bg-black/[0.05]" : "opacity-60 hover:opacity-100",
                  )}
                  style={{ borderColor: "var(--sr-rule)" }}
                >
                  {value === "serif" ? "Serif" : "Sans"}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded border px-2 py-1.5 text-[11px] transition hover:bg-black/[0.04]"
              style={{ borderColor: "var(--sr-rule)", color: "var(--sr-muted)" }}
            >
              <Printer className="size-3" /> Print this book
            </button>
          </div>
        </aside>

        <main className="sr-main min-w-0" style={{ maxWidth: "36rem" }}>
          {chapters.map((chapter, index) => (
            <section key={chapter.id} id={`chapter-${chapter.id}`} className="sr-chapter mb-16 last:mb-0">
              <header className="sr-opener">
                {style.openerLabel && chapterLabel(chapter.title, index) && (
                  <p className="label">{chapterLabel(chapter.title, index)}</p>
                )}
                <h2>{chapter.title}</h2>
                {style.chapterRule !== "none" && <div className="rule" aria-hidden="true" />}
                {chapter.synopsis && <p className="synopsis">{chapter.synopsis}</p>}
              </header>
              <div
                className="sr-prose sr-body"
                dangerouslySetInnerHTML={{ __html: chapter.html || "<p><em>This chapter is empty.</em></p>" }}
              />
            </section>
          ))}

          <div className="mt-16 border-t pt-8 text-center" style={{ borderColor: "var(--sr-rule)" }}>
            <Link href="/" className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] transition hover:opacity-100" style={{ color: "var(--sr-muted)" }}>
              Made with Inkwell Studio <ArrowUpRight className="size-3" />
            </Link>
            <p className="mt-2 text-[10px]" style={{ color: "var(--sr-muted)" }}>
              {project.author ? `${project.author} · ` : ""}Shared reading copy
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
