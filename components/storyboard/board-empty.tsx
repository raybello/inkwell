import Link from "next/link";
import { Frame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";

export function BoardEmpty({
  projectId,
  view,
}: {
  projectId: string;
  view: "storyboard" | "corkboard";
}) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-20">
      <EmptyState
        icon={<Frame />}
        title={`Nothing to ${view === "storyboard" ? "storyboard" : "cork"}`}
        description="Chapters appear here automatically as index cards. Add your first chapter from the outline, then pin reference images to it."
        action={
          <Link href={`/app/projects/${projectId}`}>
            <Button variant="primary">Back to overview</Button>
          </Link>
        }
      />
    </div>
  );
}
