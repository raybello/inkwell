import { redirect } from "next/navigation";

/** The standalone cover studio moved to the project-level Cover tab. */
export default async function LegacyCoverStudio({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/app/projects/${id}/cover`);
}
