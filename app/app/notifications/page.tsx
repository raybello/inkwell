import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { NotificationList } from "@/components/collab/notification-list";
import type { Notification } from "@/lib/types";

export const metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await getSessionUser();
  const supabase = await createClient();

  const { data } = user
    ? await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("read", { ascending: true })
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: [] as Notification[] };

  const notifications = (data ?? []) as Notification[];

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 md:px-10">
      <Link
        href="/app"
        className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-muted transition hover:text-muted-strong"
      >
        <ArrowLeft className="size-3" /> Library
      </Link>
      <div className="mt-3">
        <h1 className="font-serif text-3xl font-semibold tracking-[-0.01em]">Notifications</h1>
        <p className="mt-1 text-sm text-muted">Comment threads, invitations and changes to the projects you share.</p>
      </div>

      <div className="mt-8">
        <NotificationList notifications={notifications} />
      </div>
    </div>
  );
}
