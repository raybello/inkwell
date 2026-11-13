import type { Metadata } from "next";
import { getProfile } from "@/lib/auth";
import { isEmailConfigured } from "@/lib/email";
import { formatDate } from "@/lib/utils";
import { SettingsView } from "@/components/settings/settings-view";

export const metadata: Metadata = { title: "Settings" };

const SECTIONS = [
  { id: "profile", label: "Profile" },
  { id: "appearance", label: "Appearance" },
  { id: "writing", label: "Writing defaults" },
  { id: "account", label: "Account" },
];

export default async function SettingsPage() {
  const profile = await getProfile();
  const settings = (profile?.settings ?? {}) as Record<string, unknown>;
  const account = (settings.account ?? {}) as Record<string, unknown>;
  const deletionRequestedAt =
    typeof account.deletionRequestedAt === "string" ? account.deletionRequestedAt : null;

  return (
    <div className="mx-auto max-w-5xl px-5 pb-10 pt-14 md:px-10 md:py-10">
      <header className="max-w-2xl">
        <p className="text-[11px] uppercase tracking-[0.2em] text-accent">Settings</p>
        <h1 className="mt-2 font-serif text-3xl font-semibold tracking-[-0.02em] md:text-4xl">
          Your writing room
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          How Inkwell looks, what it remembers between projects, and the account behind it.
        </p>
      </header>

      <div className="mt-8 grid gap-8 md:grid-cols-[9rem_minmax(0,1fr)] md:gap-10">
        <nav aria-label="Settings sections" className="md:sticky md:top-6 md:self-start">
          <ul className="flex gap-1 overflow-x-auto pb-1 md:flex-col md:gap-0.5 md:overflow-visible md:pb-0">
            {SECTIONS.map((section) => (
              <li key={section.id} className="shrink-0">
                <a
                  href={`#${section.id}`}
                  className="block whitespace-nowrap rounded-md px-2.5 py-1.5 text-[13px] text-muted-strong transition hover:bg-ink-850 hover:text-foreground"
                >
                  {section.label}
                </a>
              </li>
            ))}
            <li className="shrink-0 md:mt-2 md:border-t md:border-border md:pt-2">
              <a
                href="/app/settings/billing"
                className="block whitespace-nowrap rounded-md px-2.5 py-1.5 text-[13px] text-accent transition hover:bg-accent/10"
              >
                Plans &amp; billing
              </a>
            </li>
          </ul>
        </nav>

        <div className="min-w-0">
          <SettingsView
            profile={{
              id: profile?.id ?? "",
              email: profile?.email ?? null,
              displayName: profile?.display_name ?? "Writer",
              avatarUrl: profile?.avatar_url ?? null,
              plan: profile?.plan ?? "free",
            }}
            settings={settings}
            deletionRequestedLabel={deletionRequestedAt ? formatDate(deletionRequestedAt) : null}
            emailConfigured={isEmailConfigured()}
          />
        </div>
      </div>
    </div>
  );
}
