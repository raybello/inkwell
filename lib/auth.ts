import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export const getSessionUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (data) return data as Profile;
  return {
    id: user.id,
    email: user.email ?? null,
    display_name: (user.user_metadata?.display_name as string) ?? user.email?.split("@")[0] ?? "Writer",
    avatar_url: (user.user_metadata?.avatar_url as string) ?? null,
    plan: "free",
    is_admin: false,
    settings: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
});

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");
  return user;
}
