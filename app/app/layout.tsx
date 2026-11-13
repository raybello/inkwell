import { AppShell } from "@/components/layout/app-shell";
import { getProfile, requireUser } from "@/lib/auth";
import { listProjects } from "@/lib/data";
import { planLimits } from "@/lib/plans";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  const [profile, projects] = await Promise.all([getProfile(), listProjects()]);

  return (
    <AppShell
      projects={projects}
      user={{
        name: profile?.display_name ?? "Writer",
        email: profile?.email ?? "",
        avatar: profile?.avatar_url ?? null,
        plan: profile?.plan ?? "free",
        isAdmin: profile?.is_admin ?? false,
        projectLimit: profile?.is_admin ? null : planLimits(profile?.plan).projects,
      }}
    >
      {children}
    </AppShell>
  );
}
