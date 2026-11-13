import { NewProjectWizard } from "@/components/projects/new-project-wizard";
import { getProfile } from "@/lib/auth";

export const metadata = { title: "New project" };

export default async function NewProjectPage() {
  const profile = await getProfile();
  const plan = profile?.plan ?? "free";
  return <NewProjectWizard plan={plan} />;
}
