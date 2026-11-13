"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import type { Notification } from "@/lib/types";

export async function listNotifications(limit = 100): Promise<{
  ok: boolean;
  error?: string;
  notifications: Notification[];
  unread: number;
}> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sign in first.", notifications: [], unread: 0 };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("read", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return { ok: false, error: error.message, notifications: [], unread: 0 };
  const notifications = (data ?? []) as Notification[];
  return { ok: true, notifications, unread: notifications.filter((n) => !n.read).length };
}

export async function listUnreadCount(): Promise<number> {
  const user = await getSessionUser();
  if (!user) return 0;
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("read", false);
  return count ?? 0;
}

export async function markRead(id: string): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sign in first." };

  const supabase = await createClient();
  const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id).eq("user_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/app/notifications");
  return { ok: true };
}

export async function markAllRead(): Promise<{ ok: boolean; error?: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "Sign in first." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", user.id)
    .eq("read", false);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/app/notifications");
  return { ok: true };
}
