"use client";

import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowUpRight,
  Check,
  CreditCard,
  Loader2,
  LogOut,
  Moon,
  Sun,
  Trash2,
  Type,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input, Label, Select, Textarea } from "@/components/ui/input";
import { Avatar } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { signOutAction } from "@/lib/actions/auth";
import {
  cancelAccountDeletion,
  requestAccountDeletion,
  updateProfile,
  updateSettings,
  type AppearanceSettings,
  type SettingsState,
  type ThemePreference,
  type WritingDefaults,
} from "@/lib/actions/settings";
import type { ProjectType } from "@/lib/types";

const FONT_SIZES = [16, 18, 20, 22];
/** Must match the phrase the server action validates. */
const DELETE_CONFIRMATION = "DELETE";
const PROJECT_TYPES: { value: ProjectType; label: string }[] = [
  { value: "book", label: "Book" },
  { value: "ebook", label: "Ebook" },
  { value: "article", label: "Article" },
  { value: "blog", label: "Blog series" },
  { value: "custom", label: "Custom" },
];

const DEFAULT_APPEARANCE: AppearanceSettings = {
  theme: "dark",
  fontSize: 18,
  focusMode: false,
  dailyWordGoal: 0,
};

const DEFAULT_WRITING: WritingDefaults = { type: "book", genre: "", targetWords: 80000 };

function normaliseAppearance(raw: unknown): AppearanceSettings {
  const value = (raw ?? {}) as Record<string, unknown>;
  const theme: ThemePreference = value.theme === "light" ? "light" : "dark";
  const fontSize = typeof value.fontSize === "number" ? value.fontSize : DEFAULT_APPEARANCE.fontSize;
  return {
    theme,
    fontSize: FONT_SIZES.includes(fontSize) ? fontSize : DEFAULT_APPEARANCE.fontSize,
    focusMode: Boolean(value.focusMode),
    dailyWordGoal: typeof value.dailyWordGoal === "number" ? value.dailyWordGoal : 0,
  };
}

function normaliseWriting(raw: unknown): WritingDefaults {
  const value = (raw ?? {}) as Record<string, unknown>;
  const type = PROJECT_TYPES.some((t) => t.value === value.type)
    ? (value.type as ProjectType)
    : DEFAULT_WRITING.type;
  return {
    type,
    genre: typeof value.genre === "string" ? value.genre : "",
    targetWords: typeof value.targetWords === "number" ? value.targetWords : DEFAULT_WRITING.targetWords,
  };
}

function applyTheme(theme: ThemePreference) {
  document.documentElement.classList.toggle("light", theme === "light");
  try {
    localStorage.setItem("inkwell-theme", theme);
  } catch {
    // private mode / storage disabled — the class still applies for this session
  }
}

export interface SettingsViewProps {
  profile: {
    id: string;
    email: string | null;
    displayName: string;
    avatarUrl: string | null;
    plan: string;
  };
  settings: Record<string, unknown>;
  /** Pre-formatted on the server so hydration never disagrees. */
  deletionRequestedLabel: string | null;
  emailConfigured: boolean;
}

export function SettingsView({ profile, settings, deletionRequestedLabel, emailConfigured }: SettingsViewProps) {
  const initialAppearance = normaliseAppearance(settings.appearance);
  const initialWriting = normaliseWriting(settings.writing);

  const [appearance, setAppearance] = React.useState<AppearanceSettings>(initialAppearance);
  const [writing, setWriting] = React.useState<WritingDefaults>(initialWriting);
  const [savingPrefs, startSavePrefs] = React.useTransition();
  const [savedFlag, setSavedFlag] = React.useState<string | null>(null);


  // Reflect the *actual* theme (sidebar toggle may have changed it) without writing.
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem("inkwell-theme");
      if (stored === "light" || stored === "dark") {
        setAppearance((a) => (a.theme === stored ? a : { ...a, theme: stored }));
      } else if (initialAppearance.theme === "light") {
        // No local choice yet: honour the theme saved on the profile.
        applyTheme("light");
      }
    } catch {
      // ignore
    }
    // initialAppearance is read once on mount by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = React.useCallback(
    (patch: Parameters<typeof updateSettings>[0], label: string) => {
      startSavePrefs(async () => {
        const result = await updateSettings(patch);
        if (!result.ok) {
          toast.error(result.error ?? "Could not save preferences.");
          return;
        }
        setSavedFlag(label);
        window.setTimeout(() => setSavedFlag((v) => (v === label ? null : v)), 1800);
      });
    },
    [],
  );

  function chooseTheme(theme: ThemePreference) {
    setAppearance((a) => ({ ...a, theme }));
    applyTheme(theme);
    persist({ appearance: { theme } }, "theme");
  }

  return (
    <div className="divide-y divide-border">
      {/* ------------------------------------------------------------ profile */}
      <section id="profile" className="scroll-mt-6 py-8 first:pt-0">
        <SectionHeading
          title="Profile"
          help="How you appear to collaborators across projects and comments."
        />
        <ProfileForm profile={profile} />
      </section>

      {/* -------------------------------------------------------- appearance */}
      <section id="appearance" className="scroll-mt-6 py-8">
        <SectionHeading
          title="Appearance"
          help="Applies to this browser. Editor preferences are stored with your account."
          trailing={
            savingPrefs ? (
              <span className="flex items-center gap-1.5 text-[11px] text-muted">
                <Loader2 className="size-3 animate-spin" /> Saving
              </span>
            ) : savedFlag ? (
              <span className="flex items-center gap-1.5 text-[11px] text-sage">
                <Check className="size-3" /> Saved
              </span>
            ) : null
          }
        />

        <div className="mt-5 space-y-5">
          <Row label="Theme" help="Inkwell defaults to the dark reading room.">
            <div className="flex gap-2">
              <ThemeCard
                label="Dark"
                icon={<Moon className="size-4" />}
                active={appearance.theme === "dark"}
                swatch="bg-ink-950"
                onClick={() => chooseTheme("dark")}
              />
              <ThemeCard
                label="Light"
                icon={<Sun className="size-4" />}
                active={appearance.theme === "light"}
                swatch="bg-paper"
                onClick={() => chooseTheme("light")}
              />
            </div>
          </Row>

          <Row label="Editor text size" help="The base size of prose in the writing view.">
            <div className="flex items-center gap-2">
              <Type className="size-4 text-muted" aria-hidden />
              <Select
                aria-label="Editor text size"
                value={appearance.fontSize}
                onChange={(e) => {
                  const fontSize = Number(e.target.value);
                  setAppearance((a) => ({ ...a, fontSize }));
                  persist({ appearance: { fontSize } }, "font");
                }}
                className="w-32"
              >
                {FONT_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size} px
                  </option>
                ))}
              </Select>
            </div>
          </Row>

          <Row label="Focus mode" help="Open chapters without the sidebar or outline panel.">
            <ToggleRow
              checked={appearance.focusMode}
              label={appearance.focusMode ? "On by default" : "Off"}
              onChange={(focusMode) => {
                setAppearance((a) => ({ ...a, focusMode }));
                persist({ appearance: { focusMode } }, "focus");
              }}
            />
          </Row>

          <Row label="Daily word goal" help="A quiet target in the editor. Set to 0 to hide it.">
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={100000}
                step={100}
                aria-label="Daily word goal"
                value={appearance.dailyWordGoal}
                onChange={(e) => {
                  const dailyWordGoal = Number(e.target.value) || 0;
                  setAppearance((a) => ({ ...a, dailyWordGoal }));
                }}
                onBlur={() => persist({ appearance: { dailyWordGoal: appearance.dailyWordGoal } }, "goal")}
                className="w-32 font-mono"
              />
              <span className="text-xs text-muted">words / day</span>
            </div>
          </Row>
        </div>
      </section>

      {/* --------------------------------------------------- writing defaults */}
      <section id="writing" className="scroll-mt-6 py-8">
        <SectionHeading
          title="Writing defaults"
          help="Pre-filled when you start a new project. You can change them per project."
        />
        <WritingForm
          value={writing}
          onChange={setWriting}
          onSave={() => {
            startSavePrefs(async () => {
              const result = await updateSettings({ writing });
              if (!result.ok) {
                toast.error(result.error ?? "Could not save writing defaults.");
                return;
              }
              toast.success("Writing defaults saved.");
            });
          }}
        />
      </section>

      {/* ---------------------------------------------------------- account */}
      <section id="account" className="scroll-mt-6 py-8">
        <SectionHeading title="Account" help="Sign-in, email and the door out." />

        <div className="mt-5 space-y-5">
          <Row label="Sign-in email" help="Contact support if you need to change the address on your account.">
            <Input value={profile.email ?? ""} readOnly disabled aria-label="Sign-in email" className="w-full max-w-sm" />
          </Row>

          <Row label="Session" help="Signing out leaves all drafts saved.">
            <form action={signOutAction}>
              <Button type="submit" variant="outline" size="sm">
                <LogOut /> Sign out
              </Button>
            </form>
          </Row>

          <Row
            label="Email delivery"
            help={
              emailConfigured
                ? "Invites, export notices and comment alerts are delivered through Resend."
                : "Transactional email is not configured in this environment, so invites and alerts are not sent."
            }
          >
            <Badge tone={emailConfigured ? "sage" : "amber"}>
              {emailConfigured ? "Configured" : "Not configured"}
            </Badge>
          </Row>

          <div className="rounded-lg border border-border bg-ink-850/40 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">Delete account</p>
                <p className="max-w-md text-xs leading-relaxed text-muted">
                  This files a deletion request. Nothing is removed immediately — we confirm by email and
                  keep your projects for 14 days in case you change your mind.
                </p>
              </div>
              {deletionRequestedLabel ? (
                <div className="flex flex-col items-end gap-1">
                  <Badge tone="amber">Requested {deletionRequestedLabel}</Badge>
                  <CancelDeletionButton />
                </div>
              ) : (
                <DeleteAccountDialog email={profile.email} emailConfigured={emailConfigured} />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ billing link */}
      <section className="py-8">
        <Link
          href="/app/settings/billing"
          className="group flex items-center justify-between gap-4 rounded-xl border border-border bg-card px-4 py-4 transition hover:border-border-strong hover:bg-card-hover"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-accent/25 bg-accent/10 text-accent">
              <CreditCard className="size-4" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block font-serif text-base">Plans &amp; billing</span>
              <span className="block truncate text-xs text-muted">
                You&apos;re on the {profile.plan === "free" ? "Free" : profile.plan === "pro" ? "Pro" : "Studio"} plan ·
                usage, invoices and plan changes
              </span>
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1 text-[11px] uppercase tracking-[0.14em] text-muted group-hover:text-accent">
            Open <ArrowUpRight className="size-3.5" />
          </span>
        </Link>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ profile */

function ProfileForm({ profile }: { profile: SettingsViewProps["profile"] }) {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(updateProfile, null);
  const [avatarUrl, setAvatarUrl] = React.useState(profile.avatarUrl ?? "");
  const [displayName, setDisplayName] = React.useState(profile.displayName);

  React.useEffect(() => {
    if (state?.success) toast.success(state.success);
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="mt-5 space-y-5">
      <Row label="Avatar" help="Paste a link to an image, or leave blank for initials.">
        <div className="flex items-start gap-3">
          <Avatar name={displayName} src={avatarUrl || null} size={44} />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Input
              name="avatar_url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://images.example.com/portrait.jpg"
              aria-label="Avatar image URL"
              inputMode="url"
            />
            <p className="text-[11px] text-muted">Preview updates as you type. Square images work best.</p>
          </div>
        </div>
      </Row>

      <Row label="Display name" help="Shown on comments, invites and share pages.">
        <div className="max-w-sm">
          <Input
            name="display_name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            aria-label="Display name"
            required
            minLength={2}
            maxLength={60}
          />
        </div>
      </Row>

      <div className="flex items-center gap-2 pl-0 md:pl-[13.5rem]">
        <Button type="submit" variant="primary" size="sm" loading={pending}>
          Save profile
        </Button>
        {state?.error && <p className="text-xs text-red-400">{state.error}</p>}
      </div>
    </form>
  );
}

/* ----------------------------------------------------------------- writing */

function WritingForm({
  value,
  onChange,
  onSave,
}: {
  value: WritingDefaults;
  onChange: (next: WritingDefaults) => void;
  onSave: () => void;
}) {
  return (
    <div className="mt-5 space-y-5">
      <Row label="Project type" help="Books and ebooks get chapter structure; articles get sections.">
        <Select
          aria-label="Default project type"
          value={value.type}
          onChange={(e) => onChange({ ...value, type: e.target.value as ProjectType })}
          className="w-48"
        >
          {PROJECT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
      </Row>

      <Row label="Genre" help="Optional. Used to seed outline prompts and export metadata.">
        <Input
          aria-label="Default genre"
          value={value.genre}
          onChange={(e) => onChange({ ...value, genre: e.target.value })}
          placeholder="Literary fiction, memoir, long-form tech…"
          maxLength={60}
          className="w-full max-w-sm"
        />
      </Row>

      <Row label="Target word count" help="A starting goal for the project's progress meter.">
        <Input
          type="number"
          min={0}
          max={1000000}
          step={1000}
          aria-label="Default target word count"
          value={value.targetWords}
          onChange={(e) => onChange({ ...value, targetWords: Number(e.target.value) || 0 })}
          className="w-40 font-mono"
        />
      </Row>

      <div className="pl-0 md:pl-[13.5rem]">
        <Button type="button" variant="secondary" size="sm" onClick={onSave}>
          Save writing defaults
        </Button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- deletion */

function DeleteAccountDialog({ email, emailConfigured }: { email: string | null; emailConfigured: boolean }) {
  const [open, setOpen] = React.useState(false);
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(requestAccountDeletion, null);
  const [confirmText, setConfirmText] = React.useState("");

  React.useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      setOpen(false);
      setConfirmText("");
    }
    if (state?.error) toast.error(state.error);
  }, [state]);

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Trash2 /> Request deletion
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Request account deletion"
        description="This files a request. Your account and projects stay intact until support confirms by email."
        footer={
          <>
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="delete-account-form" variant="danger" size="sm" loading={pending}>
              File request
            </Button>
          </>
        }
      >
        <form id="delete-account-form" action={formAction} className="space-y-4">
          <div className="rounded-md border border-border bg-ink-850/60 px-3 py-2 text-xs leading-relaxed text-muted-strong">
            <p>Nothing is deleted right now. We&apos;ll email {email ?? "your address"}{emailConfigured ? "" : " (email delivery is currently off, so note this yourself)"} and keep your work for 14 days.</p>
          </div>
          <Field
            label={`Type ${DELETE_CONFIRMATION} to confirm`}
            hint="Case-insensitive. This only flags the request."
          >
            <Input
              name="confirmation"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={DELETE_CONFIRMATION}
              autoComplete="off"
              aria-label={`Type ${DELETE_CONFIRMATION} to confirm`}
            />
          </Field>
          <Field label="Reason (optional)" hint="Helps us understand what to fix.">
            <Textarea
              name="reason"
              rows={3}
              maxLength={500}
              placeholder="Moved to another tool, finished the book, something else…"
            />
          </Field>
        </form>
      </Dialog>
    </>
  );
}

function CancelDeletionButton() {
  const [pending, start] = React.useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      loading={pending}
      onClick={() =>
        start(async () => {
          const result = await cancelAccountDeletion();
          if (result.ok) toast.success("Deletion request withdrawn.");
          else toast.error(result.error ?? "Could not withdraw the request.");
        })
      }
    >
      Withdraw request
    </Button>
  );
}

/* ------------------------------------------------------------------- atoms */

function SectionHeading({
  title,
  help,
  trailing,
}: {
  title: string;
  help: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1">
        <h2 className="font-serif text-lg font-semibold tracking-tight">{title}</h2>
        <p className="max-w-xl text-xs leading-relaxed text-muted">{help}</p>
      </div>
      {trailing}
    </div>
  );
}

function Row({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2 md:grid-cols-[12rem_minmax(0,1fr)] md:items-start md:gap-6">
      <div className="space-y-0.5 md:pt-1">
        <Label className="normal-case tracking-normal text-[13px] text-foreground">{label}</Label>
        {help && <p className="text-[11px] leading-relaxed text-muted">{help}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function ThemeCard({
  label,
  icon,
  active,
  swatch,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  swatch: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex w-28 flex-col gap-2 rounded-lg border p-2 text-left transition",
        active ? "border-accent/60 bg-accent/5" : "border-border hover:border-border-strong hover:bg-ink-850/60",
      )}
    >
      <span className={cn("flex h-10 items-center justify-center rounded-md border border-border", swatch)}>
        <span className="text-ink-200">{icon}</span>
      </span>
      <span className="flex items-center justify-between text-xs">
        <span className={active ? "text-foreground" : "text-muted-strong"}>{label}</span>
        {active && <Check className="size-3 text-accent" />}
      </span>
    </button>
  );
}

function ToggleRow({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2.5 text-sm text-muted-strong"
    >
      <span
        className={cn("relative h-5 w-9 rounded-full transition", checked ? "bg-accent" : "bg-ink-700")}
      >
        <span
          className={cn(
            "absolute top-0.5 size-4 rounded-full bg-white transition-all",
            checked ? "left-[18px]" : "left-0.5",
          )}
        />
      </span>
      {label}
    </button>
  );
}
