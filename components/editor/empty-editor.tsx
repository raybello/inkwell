"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PenLine } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { createChapterAction } from "@/lib/actions/chapters";

export function EmptyEditor({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  const start = async () => {
    setPending(true);
    const result = await createChapterAction(projectId, { title: "Chapter One" });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    router.push(`/app/projects/${projectId}/editor/${result.data.id}`);
  };

  return (
    <div className="flex h-[calc(100dvh-5.75rem)] min-h-[520px] items-center justify-center bg-[radial-gradient(ellipse_at_top,rgba(200,129,74,0.05),transparent_55%)] px-6">
      <EmptyState
        icon={<PenLine />}
        title="A blank manuscript"
        description="Every book begins with a single chapter. Create one and the writing desk is yours."
        action={
          <Button variant="primary" loading={pending} onClick={() => void start()}>
            Write the first chapter
          </Button>
        }
      />
    </div>
  );
}
