import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Feather,
  Frame,
  LayoutGrid,
  PenLine,
  Sparkles,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth";

const features = [
  {
    icon: PenLine,
    title: "Write without friction",
    body: "A block editor that stays out of the way — focus mode, typewriter scroll, live word goals and version history that never loses a sentence.",
  },
  {
    icon: Frame,
    title: "See the story",
    body: "Storyboard lanes, a corkboard and an infinite canvas turn a pile of chapters into a shape you can actually look at.",
  },
  {
    icon: LayoutGrid,
    title: "Organise everything",
    body: "Research, characters, locations and reference images live beside the manuscript — not in six different apps.",
  },
  {
    icon: BookOpen,
    title: "Publish-ready files",
    body: "EPUB 3, print and screen PDF, DOCX, Markdown and HTML, generated from the same source with typographic care.",
  },
  {
    icon: Sparkles,
    title: "AI that knows the book",
    body: "Inline rewrites and a chat panel that reads the current chapter. Pluggable models, your keys.",
  },
  {
    icon: Terminal,
    title: "An API for agents",
    body: "Scoped API keys, a clean REST surface and outbound webhooks, so an agent can draft alongside you.",
  },
];

export default async function LandingPage() {
  const user = await getSessionUser();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-md bg-accent/15 text-accent">
              <Feather className="size-4" />
            </span>
            <span className="font-serif text-lg tracking-tight">Inkwell Studio</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-muted md:flex">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#workflow" className="hover:text-foreground">Workflow</a>
            <a href="#api" className="hover:text-foreground">Agent API</a>
          </nav>
          <div className="flex items-center gap-2">
            {user ? (
              <Link href="/app">
                <Button variant="primary" size="sm">Open studio <ArrowRight /></Button>
              </Link>
            ) : (
              <>
                <Link href="/auth/login">
                  <Button variant="ghost" size="sm">Sign in</Button>
                </Link>
                <Link href="/auth/signup">
                  <Button variant="primary" size="sm">Start writing</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-border">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.55]"
          style={{
            background:
              "radial-gradient(60% 50% at 50% 0%, rgba(200,129,74,0.16), transparent 70%), radial-gradient(40% 40% at 85% 15%, rgba(125,154,126,0.10), transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-20 md:pt-28">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-border-strong bg-ink-900/70 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-muted">
            <span className="size-1.5 rounded-full bg-accent" />
            Draft · Storyboard · Publish
          </p>
          <h1 className="max-w-3xl font-serif text-5xl font-semibold leading-[1.05] tracking-[-0.02em] md:text-7xl">
            From blank page to <span className="italic text-accent">published</span>, without leaving the room.
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-relaxed text-muted-strong">
            Inkwell Studio is the workspace for people who finish books. Write in a clean editor, think
            on a canvas, storyboard the arc, design the cover, then export files that are actually ready
            to sell.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link href={user ? "/app" : "/auth/signup"}>
              <Button variant="primary" size="lg">
                {user ? "Open your library" : "Create your first project"} <ArrowRight />
              </Button>
            </Link>
            <Link href="/auth/login">
              <Button variant="outline" size="lg">I already have an account</Button>
            </Link>
          </div>
          <div className="mt-14 grid gap-3 text-xs text-muted sm:grid-cols-3">
            {[
              ["No credit card", "Free plan includes one full project"],
              ["Your words, portable", "One-click export to EPUB, PDF, DOCX"],
              ["Built for agents", "Scoped REST API and webhooks"],
            ].map(([t, s]) => (
              <div key={t} className="rounded-lg border border-border bg-card/60 px-4 py-3">
                <p className="text-[13px] font-medium text-foreground">{t}</p>
                <p className="mt-0.5">{s}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl px-6 py-24">
        <div className="max-w-2xl">
          <p className="text-[11px] uppercase tracking-[0.2em] text-accent">One workspace</p>
          <h2 className="mt-3 font-serif text-3xl font-semibold md:text-4xl">
            Six tools that usually live in six tabs.
          </h2>
        </div>
        <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="group bg-card p-7 transition hover:bg-card-hover">
              <f.icon className="size-5 text-accent" />
              <h3 className="mt-5 font-serif text-lg">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="workflow" className="border-y border-border bg-ink-900/40">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="grid gap-12 md:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-accent">The arc</p>
              <h2 className="mt-3 font-serif text-3xl font-semibold md:text-4xl">
                A workflow that matches how books actually get made.
              </h2>
              <p className="mt-4 text-muted">
                Most tools optimise for one stage. Inkwell keeps every stage in one project, so the
                outline, the draft, the art and the export never drift apart.
              </p>
            </div>
            <ol className="space-y-6">
              {[
                ["Capture", "Drop the premise on a canvas. Sticky notes, references, images."],
                ["Structure", "Turn it into parts and chapters. Storyboard the arc with images."],
                ["Draft", "Write in a focused editor with goals, snapshots and inline comments."],
                ["Review", "Invite editors and reviewers. Threaded comments, tracked changes."],
                ["Publish", "Design a cover, preview in three layouts, export print-ready files."],
              ].map(([title, body], i) => (
                <li key={title} className="flex gap-5">
                  <span className="mt-0.5 font-mono text-xs text-accent">{String(i + 1).padStart(2, "0")}</span>
                  <div>
                    <p className="font-medium">{title}</p>
                    <p className="text-sm text-muted">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section id="api" className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid gap-10 md:grid-cols-2 md:items-center">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-accent">Agent-ready</p>
            <h2 className="mt-3 font-serif text-3xl font-semibold">Your manuscript is an API.</h2>
            <p className="mt-4 text-muted">
              Generate a scoped key and let an agent draft chapters, pin storyboard images, run
              exports and subscribe to webhooks. Everything the UI can do, the API can do.
            </p>
            <Link href="/docs/api" className="mt-6 inline-flex items-center gap-2 text-sm text-accent hover:text-accent-soft">
              Read the API reference <ArrowRight className="size-3.5" />
            </Link>
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-ink-900">
            <div className="flex items-center gap-1.5 border-b border-border px-4 py-2.5">
              <span className="size-2 rounded-full bg-ink-600" />
              <span className="size-2 rounded-full bg-ink-600" />
              <span className="size-2 rounded-full bg-ink-600" />
              <span className="ml-2 font-mono text-[11px] text-muted">terminal</span>
            </div>
            <pre className="overflow-x-auto p-4 font-mono text-[12px] leading-relaxed text-ink-200">{`curl -X POST https://inkwell.studio/api/v1/projects/$ID/chapters \
  -H "Authorization: Bearer $INKWELL_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Chapter Twelve — The Long Walk",
    "content": "The road out of town was empty..."
  }'`}</pre>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-10 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Inkwell Studio. Built for writers who finish.</p>
          <div className="flex gap-5">
            <Link href="/docs/api" className="hover:text-foreground">API docs</Link>
            <Link href="/auth/login" className="hover:text-foreground">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
