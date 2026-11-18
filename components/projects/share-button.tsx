"use client";

import * as React from "react";
import { Check, Copy, Globe, Lock, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/misc";
import { createClient } from "@/lib/supabase/client";
import { nanoid } from "nanoid";

export function ShareButton({
  projectId,
  isPublic,
  shareToken,
}: {
  projectId: string;
  isPublic: boolean;
  shareToken: string | null;
}) {
  const [open, setOpen] = React.useState(false);
  const [enabled, setEnabled] = React.useState(isPublic);
  const [token, setToken] = React.useState(shareToken);
  const [copied, setCopied] = React.useState(false);
  const [, setPending] = React.useState(false);

  const url = token ? `${typeof window !== "undefined" ? window.location.origin : ""}/share/${token}` : "";

  const toggle = async (next: boolean) => {
    setPending(true);
    const supabase = createClient();
    const newToken = token ?? nanoid(24);
    const { error } = await supabase
      .from("projects")
      .update({ is_public: next, share_token: newToken })
      .eq("id", projectId);
    setPending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setEnabled(next);
    setToken(newToken);
    toast.success(next ? "Public link enabled" : "Public link disabled");
  };

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Share2 /> <span className="hidden sm:inline">Share</span>
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title="Share this project" description="A read-only link for beta readers.">
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border bg-ink-850/60 px-3 py-2.5">
            <div className="flex items-center gap-2 text-sm">
              {enabled ? <Globe className="size-4 text-sage" /> : <Lock className="size-4 text-muted" />}
              <span>{enabled ? "Anyone with the link can read" : "Private"}</span>
            </div>
            <Switch checked={enabled} onChange={toggle} />
          </div>
          {enabled && url && (
            <div className="flex gap-2">
              <input
                readOnly
                value={url}
                className="h-9 flex-1 rounded-md border border-border bg-ink-900 px-2.5 font-mono text-[11px] text-muted-strong"
              />
              <Button
                variant="secondary"
                onClick={() => {
                  navigator.clipboard.writeText(url);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? <Check className="text-sage" /> : <Copy />}
              </Button>
            </div>
          )}
          <p className="text-xs text-muted">
            For editors and collaborators with write access, invite them from{" "}
            <span className="text-foreground">Project settings → Collaborators</span>.
          </p>
        </div>
      </Dialog>
    </>
  );
}
