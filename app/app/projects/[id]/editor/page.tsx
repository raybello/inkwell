import { redirect } from "next/navigation";
import { getProjectContext } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { EmptyEditor } from "@/components/editor/empty-editor";

export default async function EditorIndexPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await getProjectContext(id);

  const supabase = await createClient();
  const { data: first } = await supabase
    .from("chapters")
    .select("id")
    .eq("project_id", id)
    .order("position", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!first) return <EmptyEditor projectId={id} />;
  redirect(`/app/projects/${id}/editor/${first.id}`);
}
