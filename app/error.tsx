"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-[11px] uppercase tracking-[0.2em] text-accent">Something broke</p>
      <h1 className="font-serif text-3xl">A page fell out of the manuscript</h1>
      <p className="max-w-md text-sm text-muted">
        {error.message || "An unexpected error occurred."} Your work is saved — the auto-save runs before
        anything else.
      </p>
      <div className="flex gap-2">
        <Button variant="primary" onClick={reset}>Try again</Button>
        <Button variant="outline" onClick={() => (window.location.href = "/app")}>Back to library</Button>
      </div>
    </div>
  );
}
