import Link from "next/link";
import { Feather } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col justify-center px-6 py-12 sm:px-16">
        <div className="mx-auto w-full max-w-sm">
          <Link href="/" className="mb-10 inline-flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-md bg-accent/15 text-accent">
              <Feather className="size-4" />
            </span>
            <span className="font-serif text-lg">Inkwell Studio</span>
          </Link>
          {children}
        </div>
      </div>
      <div className="relative hidden overflow-hidden border-l border-border bg-ink-900 lg:block">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(70% 60% at 30% 20%, rgba(200,129,74,0.18), transparent 65%), radial-gradient(50% 50% at 80% 80%, rgba(125,154,126,0.10), transparent 70%)",
          }}
        />
        <div className="relative flex h-full flex-col justify-end p-14">
          <blockquote className="max-w-md font-serif text-3xl leading-snug tracking-[-0.01em]">
            “The first draft is just you telling yourself the story.”
          </blockquote>
          <p className="mt-4 text-sm text-muted">Terry Pratchett</p>
          <div className="mt-12 grid grid-cols-3 gap-4 border-t border-border pt-6 text-xs text-muted">
            <div>
              <p className="font-serif text-2xl text-foreground">1</p>
              <p>workspace</p>
            </div>
            <div>
              <p className="font-serif text-2xl text-foreground">7</p>
              <p>export formats</p>
            </div>
            <div>
              <p className="font-serif text-2xl text-foreground">0</p>
              <p>lost drafts</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
