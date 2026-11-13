"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { sendEmail, isEmailConfigured } from "@/lib/email";
import type { ProjectType } from "@/lib/types";

export type SettingsState = { error?: string; success?: string } | null;

export type ThemePreference = "light" | "dark";

export interface AppearanceSettings {
  theme: ThemePreference;
  /** Base editor font size in px. */
  fontSize: number;
  /** Open the editor in distraction-free mode by default. */
  focusMode: boolean;
  /** Writing target shown in the editor's progress meter. 0 disables it. */
  dailyWordGoal: number;
}

export interface WritingDefaults {
  type: ProjectType;
  genre: string;
  targetWords: number;
}

export interface SettingsPatch {
  appearance?: Partial<AppearanceSettings>;
  writing?: Partial<WritingDefaults>;
}

export type SettingsResult = { ok: boolean; error?: string; emailSent?: boolean };

const FONT_SIZES = [16, 18, 20, 22] as const;
const PROJECT_TYPES: ProjectType[] = ["book", "ebook", "article", "blog", "custom"];

function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ profile */

export async function updateProfile(_prev: SettingsState, fd: FormData): Promise<SettingsState> {
  const user = await getSessionUser();
  if (!user) return { error: "You must be signed in." };

  const displayName = str(fd, "display_name");
  const avatarUrl = str(fd, "avatar_url");

  if (displayName.length < 2) return { error: "A display name needs at least two characters." };
  if (displayName.length > 60) return { error: "Keep the display name under 60 characters." };
  if (avatarUrl && !isHttpUrl(avatarUrl)) return { error: "The avatar must be a full http(s) image URL." };
  if (avatarUrl.length > 2048) return { error: "That avatar URL is too long." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName, avatar_url: avatarUrl || null, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) return { error: error.message };

  // Keep auth metadata in step so OAuth sign-ins don't overwrite the profile.
  await supabase.auth.updateUser({
    data: { display_name: displayName, avatar_url: avatarUrl || null },
  });

  revalidatePath("/app/settings");
  revalidatePath("/app", "layout");
  return { success: "Profile saved." };
}

/* --------------------------------------------------------------- settings */

export async function updateSettings(patch: SettingsPatch): Promise<SettingsResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const supabase = await createClient();
  const { data: current, error: readError } = await supabase
    .from("profiles")
    .select("settings")
    .eq("id", user.id)
    .maybeSingle();

  if (readError) return { ok: false, error: readError.message };

  const existing = (current?.settings ?? {}) as Record<string, unknown>;
  const existingAppearance =
    existing.appearance && typeof existing.appearance === "object"
      ? (existing.appearance as Record<string, unknown>)
      : {};
  const existingWriting =
    existing.writing && typeof existing.writing === "object"
      ? (existing.writing as Record<string, unknown>)
      : {};

  const mergedAppearance = { ...existingAppearance };
  const mergedWriting = { ...existingWriting };

  if (patch.appearance) {
    const a = patch.appearance;
    if (a.theme !== undefined) {
      if (a.theme !== "light" && a.theme !== "dark") return { ok: false, error: "Unknown theme." };
      mergedAppearance.theme = a.theme;
    }
    if (a.fontSize !== undefined) {
      if (!FONT_SIZES.includes(a.fontSize as (typeof FONT_SIZES)[number])) {
        return { ok: false, error: "Unsupported editor font size." };
      }
      mergedAppearance.fontSize = a.fontSize;
    }
    if (a.focusMode !== undefined) mergedAppearance.focusMode = Boolean(a.focusMode);
    if (a.dailyWordGoal !== undefined) {
      mergedAppearance.dailyWordGoal = clampInt(a.dailyWordGoal, 0, 100_000, 0);
    }
  }

  if (patch.writing) {
    const w = patch.writing;
    if (w.type !== undefined) {
      if (!PROJECT_TYPES.includes(w.type)) return { ok: false, error: "Unknown project type." };
      mergedWriting.type = w.type;
    }
    if (w.genre !== undefined) {
      const genre = String(w.genre).trim().slice(0, 60);
      mergedWriting.genre = genre;
    }
    if (w.targetWords !== undefined) {
      mergedWriting.targetWords = clampInt(w.targetWords, 0, 1_000_000, 0);
    }
  }

  const settings = {
    ...existing,
    ...(patch.appearance ? { appearance: mergedAppearance } : {}),
    ...(patch.writing ? { writing: mergedWriting } : {}),
  };

  const { error } = await supabase
    .from("profiles")
    .update({ settings, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/app/settings");
  revalidatePath("/app/settings/billing");
  return { ok: true };
}

/* --------------------------------------------------------- account deletion */

/** Typed confirmation phrase. Mirrored (not imported) in the settings client. */
const DELETE_CONFIRMATION = "DELETE";

/**
 * Records a deletion *request*. It does not delete the auth user, the profile
 * or any project — a human (or a background job) has to act on it. The flag
 * lives in `profiles.settings.account` because the schema has no dedicated
 * request table.
 */
export async function requestAccountDeletion(_prev: SettingsState, fd: FormData): Promise<SettingsState> {
  const user = await getSessionUser();
  if (!user) return { error: "You must be signed in." };

  const confirmation = str(fd, "confirmation");
  const reason = str(fd, "reason").slice(0, 500);

  if (confirmation.toUpperCase() !== DELETE_CONFIRMATION) {
    return { error: `Type ${DELETE_CONFIRMATION} to confirm the request.` };
  }

  const supabase = await createClient();
  const { data: current, error: readError } = await supabase
    .from("profiles")
    .select("settings")
    .eq("id", user.id)
    .maybeSingle();

  if (readError) return { error: readError.message };

  const settings = (current?.settings ?? {}) as Record<string, unknown>;
  const existingAccount =
    settings.account && typeof settings.account === "object"
      ? (settings.account as Record<string, unknown>)
      : {};

  if (typeof existingAccount.deletionRequestedAt === "string") {
    return { error: "A deletion request is already pending. Withdraw it first to file another." };
  }

  const account = {
    ...existingAccount,
    deletionRequestedAt: new Date().toISOString(),
    deletionReason: reason || null,
  };

  const { error } = await supabase
    .from("profiles")
    .update({ settings: { ...settings, account }, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) return { error: error.message };

  // Fire-and-forget receipt. Silent no-op when email isn't configured.
  let emailSent = false;
  if (user.email) {
    const result = await sendEmail({
      to: user.email,
      subject: "Your Inkwell account deletion request",
      html: `<p>We received a request to delete the Inkwell account for <strong>${user.email}</strong>.</p>
             <p>Nothing has been deleted yet. Reply to this email within 14 days if you change your mind; after that we'll remove your account and its projects.</p>`,
      text: `We received a request to delete the Inkwell account for ${user.email}. Nothing has been deleted yet. Reply within 14 days to cancel.`,
    });
    emailSent = result.sent;
  }

  revalidatePath("/app/settings");

  return {
    success: emailSent
      ? "Deletion requested. Nothing has been deleted — check your inbox for confirmation."
      : `Deletion requested. Nothing has been deleted yet.${
          isEmailConfigured() ? "" : " Email delivery isn't configured, so no confirmation email was sent."
        }`,
  };
}

/** Withdraw a pending request (the flag is the only state we keep). */
export async function cancelAccountDeletion(): Promise<SettingsResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "You must be signed in." };

  const supabase = await createClient();
  const { data: current, error: readError } = await supabase
    .from("profiles")
    .select("settings")
    .eq("id", user.id)
    .maybeSingle();

  if (readError) return { ok: false, error: readError.message };

  const settings = (current?.settings ?? {}) as Record<string, unknown>;
  const account =
    settings.account && typeof settings.account === "object"
      ? { ...(settings.account as Record<string, unknown>) }
      : {};
  delete account.deletionRequestedAt;
  delete account.deletionReason;

  const { error } = await supabase
    .from("profiles")
    .update({ settings: { ...settings, account }, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/app/settings");
  return { ok: true };
}
