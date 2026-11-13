import Link from "next/link";
import { Feather } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-full border border-border-strong bg-ink-900 text-accent">
        <Feather className="size-5" />
      </span>
      <div>
        <h1 className="font-serif text-3xl">This page is unwritten</h1>
        <p className="mt-2 max-w-sm text-sm text-muted">
          The link may be broken, or the project may have been deleted.
        </p>
      </div>
      <Link href="/app">
        <Button variant="primary">Back to your library</Button>
      </Link>
    </div>
  );
}
