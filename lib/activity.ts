import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function logActivity(input: {
  projectId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  summary?: string;
}) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from("activities").insert({
      project_id: input.projectId,
      actor_id: user?.id ?? null,
      action: input.action,
      target_type: input.targetType ?? null,
      target_id: input.targetId ?? null,
      summary: input.summary ?? null,
    });
  } catch {
    // activity logging must never break the primary action
  }
}

export async function notify(input: {
  userId: string;
  projectId?: string;
  kind?: string;
  title: string;
  body?: string;
  link?: string;
}) {
  try {
    // Service role: notifications are written *for other users*, which the
    // notifications_own RLS policy deliberately forbids for a session client.
    const supabase = createAdminClient();
    await supabase.from("notifications").insert({
      user_id: input.userId,
      project_id: input.projectId ?? null,
      kind: input.kind ?? "info",
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
    });
  } catch {
    // ignore
  }
}
