import Link from "next/link";
import { BookLock } from "lucide-react";

export default function ShareNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-border-strong bg-ink-850 text-muted">
          <BookLock className="size-5" />
        </div>
        <p className="mt-5 text-[11px] uppercase tracking-[0.22em] text-muted">Reading copy</p>
        <h1 className="mt-2 font-serif text-2xl">This link is no longer available</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted">
          The author may have turned sharing off, or the link was mistyped. Ask them for a fresh
          reading link.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-9 items-center justify-center rounded-md border border-border-strong bg-ink-800 px-4 text-sm text-ink-100 transition hover:border-ink-600 hover:bg-ink-750"
        >
          Go to Inkwell Studio
        </Link>
      </div>
    </main>
  );
}
