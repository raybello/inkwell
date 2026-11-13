import type { Metadata } from "next";
import Link from "next/link";
import { Feather, Terminal } from "lucide-react";
import { ApiDocs } from "@/components/docs/api-docs";

export const metadata: Metadata = {
  title: "Agent API reference — Inkwell Studio",
  description:
    "REST reference for the Inkwell Agent API: API-key auth, scopes, rate limits, chapter and asset endpoints, exports, AI proxying and signed webhooks.",
};

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 lg:px-8">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-md bg-accent/15 text-accent">
                <Feather className="size-4" />
              </span>
              <span className="font-serif text-lg tracking-tight">Inkwell Studio</span>
            </Link>
            <span className="hidden items-center gap-1.5 text-[12px] text-muted sm:flex">
              <Terminal className="size-3.5" />
              API reference
            </span>
          </div>
          <nav className="flex items-center gap-4 text-[13px] text-muted-strong">
            <Link href="/docs/api" className="hidden text-foreground sm:inline">
              Reference
            </Link>
            <Link href="/app/settings/api" className="transition hover:text-foreground">
              API keys
            </Link>
            <Link
              href="/app"
              className="rounded-md border border-border-strong px-3 py-1.5 transition hover:border-accent/50 hover:text-foreground"
            >
              Open studio
            </Link>
          </nav>
        </div>
      </header>

      <ApiDocs />
    </div>
  );
}
