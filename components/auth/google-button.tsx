"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { signInWithGoogleAction } from "@/lib/actions/auth";

export function GoogleButton() {
  const [pending, setPending] = React.useState(false);
  return (
    <Button
      variant="outline"
      className="w-full"
      loading={pending}
      onClick={async () => {
        setPending(true);
        const res = await signInWithGoogleAction();
        if (res?.error) {
          toast.error("Google sign-in is not configured for this project yet.");
          setPending(false);
        }
      }}
    >
      <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
        <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.2-5.5 4.2A6.3 6.3 0 1 1 16.2 7l2.7-2.6A10 10 0 1 0 22 12c0-.6-.06-1.2-.16-1.8H12Z" />
      </svg>
      Continue with Google
    </Button>
  );
}
