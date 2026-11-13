import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  Columns3,
  Download,
  PenLine,
  Plus,
} from "lucide-react";
import { getProjectContext, listChapters } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button-variants";
import { Badge, STATUS_LABEL } from "@/components/ui/badge";
import { EmptyState, Progress } from "@/components/ui/misc";
import { OutlinePanel } from "@/components/outline/outline-panel";
import { NotesPanel } from "@/components/outline/notes-panel";
import { ActivityFeed } from "@/components/projects/activity-feed";
import { cn, formatDate, formatNumber, relativeTime } from "@/lib/utils";
import type { Activity, Chapter, Note, Profile } from "@/lib/types";

const TYPE_LABEL: Record<string, string> = {
  book: "Book",
  ebook: "E-book",
  article: "Article",
  blog: "Blog",
  custom: "Project",
};

const STATUS_ORDER = ["draft", "in_progress", "complete", "needs_review"] as const;
type StatusKey = (typeof STATUS_ORDER)[number];

const STATUS_BAR: Record<string, string> = {
  draft: "bg-ink-500",
  in_progress: "bg-accent",
  complete: "bg-sage",
  needs_review: "bg-amber-500",
};

function readOrder(chapters: Chapter[]): Chapter[] {
  const ids = new Set(chapters.map((c) => c.id));
  const groups = new Map<string | null, Chapter[]>();
  for (const chapter of chapters) {
    const key = chapter.parent_id && ids.has(chapter.parent_id) ? chapter.parent_id : null;
    const list = groups.get(key) ?? [];
    list.push(chapter);
    groups.set(key, list);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => a.position - b.position || a.title.localeCompare(b.title));
  }

  const out: Chapter[] = [];
  const seen = new Set<string>();
  const walk = (parentId: string | null) => {
    for (const chapter of groups.get(parentId) ?? []) {
      if (seen.has(chapter.id)) continue;
      seen.add(chapter.id);
      out.push(chapter);
      walk(chapter.id);
    }
  };
  walk(null);
  return out;
}

function wordsLoggedToday(activities: Activity[]) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  let total = 0;
  for (const activity of activities) {
    if (new Date(activity.created_at).getTime() < start.getTime()) continue;
    const matches = activity.summary?.match(/(\d[\d,]*)\s*words?\b/gi);
    if (!matches) continue;
    for (const hit of matches) {
      const value = Number(hit.replace(/[^\d]/g, ""));
      if (Number.isFinite(value)) total += value;
    }
  }
  return total;
}

function SectionHead({
  title,
  meta,
  action,
}: {
  title: string;
  meta?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3 border-b border-border pb-2">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h2 className="font-serif text-lg leading-none">{title}</h2>
        {meta && <span className="text-[11px] text-muted">{meta}</span>}
      </div>
      {action}
    </div>
  );
}

function RailHead({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-[11px] uppercase tracking-[0.16em] text-muted">{children}</h2>
  );
}

function Stat({
  label,
  value,
  hint,
  children,
}: {
  label: string;
  value: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-background px-3.5 py-3">
      <p className="text-[10px] uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-1.5 font-mono text-[17px] leading-none text-ink-100">{value}</p>
      {children}
      {hint && <p className="mt-1 text-[10.5px] leading-tight text-muted/70">{hint}</p>}
    </div>
  );
}

function GoalRing({ pct }: { pct: number }) {
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const filled = (Math.min(100, Math.max(0, pct)) / 100) * circumference;

  return (
    <div
      className="relative grid size-14 shrink-0 place-items-center"
      role="img"
      aria-label={`${Math.round(pct)} percent of today's goal`}
    >
      <svg viewBox="0 0 60 60" className="size-14 -rotate-90">
        <circle cx="30" cy="30" r={radius} fill="none" stroke="var(--ink-750)" strokeWidth="4" />
        <circle
          cx="30"
          cy="30"
          r={radius}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
        />
      </svg>
      <span className="absolute font-mono text-[11px] tabular-nums text-ink-200">
        {Math.round(pct)}%
      </span>
    </div>
  );
}

export default async function ProjectHome({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { project, canEdit, role, members, profile } = await getProjectContext(id);
  const chapters = await listChapters(id);

  const supabase = await createClient();
  const [{ data: activityRows }, { data: noteRows }] = await Promise.all([
    supabase
      .from("activities")
      .select("*")
      .eq("project_id", id)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("notes")
      .select("*")
      .eq("project_id", id)
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false }),
  ]);

  const rawActivities = (activityRows ?? []) as Activity[];
  const actorIds = Array.from(
    new Set(rawActivities.map((a) => a.actor_id).filter((value): value is string => !!value)),
  );
  let actors: Profile[] = [];
  if (actorIds.length) {
    const { data } = await supabase.from("profiles").select("*").in("id", actorIds);
    actors = (data ?? []) as Profile[];
  }
  const activities: Activity[] = rawActivities.map((activity) => ({
    ...activity,
    actor: actors.find((actor) => actor.id === activity.actor_id) ?? null,
  }));

  const notes = (noteRows ?? []) as Note[];

  const ordered = readOrder(chapters);
  const totalWords = chapters.reduce((sum, chapter) => sum + (chapter.word_count ?? 0), 0);
  const pages = totalWords > 0 ? Math.max(1, Math.round(totalWords / 250)) : 0;
  const target = project.target_word_count ?? 0;
  const progressPct =
    target > 0 ? Math.min(100, Math.round((totalWords / target) * 100)) : null;

  const lastEdited = chapters.reduce(
    (latest, chapter) => (chapter.updated_at > latest ? chapter.updated_at : latest),
    project.updated_at,
  );

  const parentIds = new Set(
    chapters.map((chapter) => chapter.parent_id).filter((value): value is string => !!value),
  );
  const partCount = parentIds.size;

  const firstLeaf = ordered.find((chapter) => !parentIds.has(chapter.id));
  const firstChapter = firstLeaf ?? ordered[0] ?? null;

  const byRecency = [...chapters].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );
  const resumeChapter = byRecency.find((chapter) => (chapter.word_count ?? 0) > 0) ?? byRecency[0] ?? null;

  const statusCounts: Record<StatusKey, number> = {
    draft: 0,
    in_progress: 0,
    complete: 0,
    needs_review: 0,
  };
  for (const chapter of chapters) {
    if (chapter.status in statusCounts) statusCounts[chapter.status as StatusKey] += 1;
  }

  const dailyGoalRaw = Number(project.settings?.daily_goal_words ?? 500);
  const dailyGoal = Number.isFinite(dailyGoalRaw) && dailyGoalRaw > 0 ? dailyGoalRaw : 500;
  const todayWords = wordsLoggedToday(rawActivities);
  const goalPct = Math.min(100, Math.round((todayWords / dailyGoal) * 100));

  const authorName =
    members.find((member) => member.role === "owner")?.profile?.display_name ||
    profile?.display_name ||
    "Writer";

  const editorHref = (chapter: Chapter) => `/app/projects/${id}/editor/${chapter.id}`;
  const base = `/app/projects/${id}`;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-9">
      {/* ------------------------------------------------------------------ hero */}
      <section className="flex flex-col gap-5 sm:flex-row sm:items-start">
        {project.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.cover_image_url}
            alt=""
            className="h-[132px] w-[98px] shrink-0 rounded-md border border-border-strong object-cover shadow-sm sm:h-[168px] sm:w-[124px]"
          />
        ) : (
          <div className="relative flex h-[132px] w-[98px] shrink-0 flex-col justify-between overflow-hidden rounded-md border border-border-strong bg-[radial-gradient(130%_100%_at_50%_0%,rgba(200,129,74,0.16),transparent_70%)] p-2.5 sm:h-[168px] sm:w-[124px] sm:p-3">
            <span className="text-[8px] uppercase leading-tight tracking-[0.18em] text-muted sm:text-[9px]">
              {project.genre ?? TYPE_LABEL[project.type] ?? "Project"}
            </span>
            <p className="font-serif text-[13px] leading-tight text-ink-100 sm:text-[15px]">
              {project.title}
            </p>
            <div>
              <div className="mb-1 h-px w-5 bg-accent/60" />
              <p className="truncate text-[8px] uppercase tracking-[0.16em] text-muted sm:text-[9px]">
                {authorName}
              </p>
            </div>
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10.5px] uppercase tracking-[0.16em] text-muted">
            <span>{TYPE_LABEL[project.type] ?? "Project"}</span>
            {project.genre && (
              <>
                <span aria-hidden>·</span>
                <span>{project.genre}</span>
              </>
            )}
            <span aria-hidden>·</span>
            <span>{role}</span>
            <Badge tone={project.status === "published" ? "sage" : "neutral"} className="ml-1">
              {project.status}
            </Badge>
          </div>

          <h1 className="mt-2 font-serif text-3xl leading-[1.1] tracking-tight md:text-4xl">
            {project.title}
          </h1>
          {project.subtitle && (
            <p className="mt-1 font-serif text-base text-muted-strong md:text-lg">
              {project.subtitle}
            </p>
          )}

          {project.description ? (
            <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-muted-strong">
              {project.description}
            </p>
          ) : (
            <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-muted/70">
              {canEdit
                ? "No description yet — add one in project settings so collaborators know what this is."
                : "No description has been written for this project yet."}
            </p>
          )}

          {project.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {project.tags.map((tag, index) => (
                <Badge key={`${tag}-${index}`}>{tag}</Badge>
              ))}
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {firstChapter ? (
              <Link
                href={editorHref(firstChapter)}
                className={buttonVariants({ variant: "primary", size: "md" })}
              >
                <PenLine /> Continue writing <ArrowRight />
              </Link>
            ) : canEdit ? (
              <span className="inline-flex items-center gap-2 rounded-md border border-dashed border-border-strong px-3 py-2 text-[12.5px] text-muted">
                <Plus className="size-3.5" /> Add a chapter below to start writing
              </span>
            ) : null}

            <Link
              href={`${base}/storyboard`}
              className={buttonVariants({ variant: "outline", size: "md" })}
            >
              <Columns3 /> Open storyboard
            </Link>
            <Link
              href={`${base}/export`}
              className={buttonVariants({ variant: "ghost", size: "md" })}
            >
              <Download /> Export
            </Link>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------------------- stats */}
      <div className="mt-7 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3 xl:grid-cols-6">
        <Stat label="Words" value={formatNumber(totalWords)} hint={target ? `of ${formatNumber(target)} target` : "No target set"} />
        <Stat label="Chapters" value={formatNumber(chapters.length)} hint={partCount ? `${partCount} parts` : "Flat structure"} />
        <Stat label="Pages" value={formatNumber(pages)} hint="≈250 words a page" />
        <Stat
          label="Progress"
          value={progressPct !== null ? `${progressPct}%` : "—"}
          hint={progressPct !== null ? "of word target" : "Set a target to track"}
        >
          {progressPct !== null && <Progress value={progressPct} className="mt-1.5 h-1" />}
        </Stat>
        <Stat label="Last edited" value={relativeTime(lastEdited)} hint={formatDate(lastEdited)} />
        <Stat
          label="Collaborators"
          value={formatNumber(Math.max(1, members.length))}
          hint={members.length > 1 ? "incl. you" : "Just you"}
        />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-x-10 gap-y-8 min-[900px]:grid-cols-[minmax(0,1fr)_294px]">
        <div className="min-w-0">
          {/* ------------------------------------------------------- continue card */}
          <section>
            <div className="rounded-xl border border-border bg-card/60 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.16em] text-muted">
                  <CalendarClock className="size-3" /> Continue where you left off
                </p>
                {resumeChapter && (
                  <span className="text-[11px] text-muted/70">
                    {relativeTime(resumeChapter.updated_at)}
                  </span>
                )}
              </div>

              {resumeChapter ? (
                <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-serif text-xl leading-tight">
                      {resumeChapter.title}
                    </h3>
                    <p className="mt-1.5 line-clamp-2 max-w-xl text-[13px] leading-relaxed text-muted">
                      {resumeChapter.synopsis || "No synopsis yet — open the chapter and add one to the outline card."}
                    </p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
                      <span className="font-mono">{formatNumber(resumeChapter.word_count)} words</span>
                      <span aria-hidden>·</span>
                      <span className="flex items-center gap-1">
                        <span
                          className={cn(
                            "size-1.5 rounded-full",
                            STATUS_BAR[resumeChapter.status] ?? "bg-ink-500",
                          )}
                        />
                        {STATUS_LABEL[resumeChapter.status] ?? resumeChapter.status}
                      </span>
                      {resumeChapter.pov && (
                        <>
                          <span aria-hidden>·</span>
                          <span>POV {resumeChapter.pov}</span>
                        </>
                      )}
                      {resumeChapter.arc && (
                        <>
                          <span aria-hidden>·</span>
                          <span>{resumeChapter.arc}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <Link
                    href={editorHref(resumeChapter)}
                    className={cn(buttonVariants({ variant: "primary", size: "md" }), "shrink-0")}
                  >
                    Resume <ArrowRight />
                  </Link>
                </div>
              ) : (
                <EmptyState
                  icon={<BookOpen />}
                  title="The page is still blank"
                  description="Create the first chapter in the outline below and the manuscript starts here."
                  className="py-8"
                />
              )}
            </div>
          </section>

          {/* ------------------------------------------------------------- outline */}
          <section className="mt-9">
            <SectionHead
              title="Outline"
              meta={`${chapters.length} ${chapters.length === 1 ? "section" : "sections"}${partCount ? ` · ${partCount} parts` : ""}`}
            />
            <OutlinePanel projectId={id} chapters={chapters} canEdit={canEdit} />
          </section>

          {/* --------------------------------------------------------------- notes */}
          <section className="mt-9">
            <SectionHead
              title="Notes & research"
              meta={`${notes.length} ${notes.length === 1 ? "note" : "notes"}`}
            />
            <NotesPanel projectId={id} notes={notes} canEdit={canEdit} />
          </section>
        </div>

        {/* ----------------------------------------------------------------- rail */}
        <aside className="min-w-0 border-t border-border pt-6 min-[900px]:border-l min-[900px]:border-t-0 min-[900px]:pl-6 min-[900px]:pt-1">
          <div className="space-y-0">
            <section className="border-b border-border pb-5">
              <RailHead>Daily goal</RailHead>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-2xl leading-none text-ink-100">
                    {formatNumber(todayWords)}
                    <span className="ml-1 font-sans text-[12px] text-muted">
                      / {formatNumber(dailyGoal)}
                    </span>
                  </p>
                  <p className="mt-1.5 text-[11px] leading-snug text-muted">
                    words logged today
                  </p>
                  <Link
                    href={firstChapter ? editorHref(firstChapter) : `${base}/settings`}
                    className="mt-2.5 inline-flex items-center gap-1 text-[11.5px] text-accent hover:text-accent-soft"
                  >
                    {todayWords >= dailyGoal ? "Goal met — keep going" : "Write toward today's goal"}
                    <ArrowRight className="size-3" />
                  </Link>
                </div>
                <GoalRing pct={goalPct} />
              </div>
            </section>

            <section className="border-b border-border py-5">
              <RailHead>By status</RailHead>
              {chapters.length === 0 ? (
                <p className="text-[12.5px] text-muted">No chapters to summarise yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {STATUS_ORDER.map((status) => {
                    const count = statusCounts[status];
                    const pct = chapters.length ? (count / chapters.length) * 100 : 0;
                    return (
                      <div key={status}>
                        <div className="flex items-center justify-between gap-2 text-[11.5px]">
                          <span className="flex items-center gap-1.5 text-muted-strong">
                            <span
                              className={cn("size-1.5 rounded-full", STATUS_BAR[status])}
                              aria-hidden
                            />
                            {STATUS_LABEL[status]}
                          </span>
                          <span className="font-mono text-[11px] tabular-nums text-muted">
                            {count}
                          </span>
                        </div>
                        <div className="mt-1 h-1 overflow-hidden rounded-full bg-ink-800">
                          <div
                            className={cn("h-full rounded-full transition-all", STATUS_BAR[status])}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="py-5">
              <RailHead>Activity</RailHead>
              <ActivityFeed activities={activities} limit={12} />
            </section>
          </div>
        </aside>
      </div>
    </div>
  );
}
