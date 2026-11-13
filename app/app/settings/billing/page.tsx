import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isStripeConfigured } from "@/lib/stripe";
import { isPlanId, type PlanId } from "@/lib/plans";
import { formatDate } from "@/lib/utils";
import { BillingClient } from "@/components/settings/billing-client";

export const metadata: Metadata = { title: "Plans & billing" };

export const dynamic = "force-dynamic";

interface SubscriptionRow {
  plan: string | null;
  status: string | null;
  current_period_end: string | null;
  stripe_customer_id: string | null;
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const [profile, supabase] = await Promise.all([getProfile(), createClient()]);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userId = user?.id ?? profile?.id ?? "";

  const [{ data: subscriptionRow }, { data: projectRows }] = await Promise.all([
    supabase
      .from("subscriptions")
      .select("plan, status, current_period_end, stripe_customer_id")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase.from("projects").select("id").eq("owner_id", userId),
  ]);

  const subscription = (subscriptionRow as SubscriptionRow | null) ?? null;
  const projectIds = (projectRows ?? []).map((p) => p.id as string);

  let wordsUsed = 0;
  if (projectIds.length > 0) {
    const { data: chapters } = await supabase
      .from("chapters")
      .select("word_count")
      .in("project_id", projectIds);
    wordsUsed = (chapters ?? []).reduce((sum, c) => sum + ((c.word_count as number | null) ?? 0), 0);
  }

  const plan: PlanId = isPlanId(subscription?.plan) ? subscription.plan : isPlanId(profile?.plan) ? profile.plan : "free";
  const rawCheckout = params.checkout;
  const checkoutStatus =
    rawCheckout === "success" ? "success" : rawCheckout === "cancelled" ? "cancelled" : null;

  return (
    <div className="mx-auto max-w-5xl px-5 pb-10 pt-14 md:px-10 md:py-10">
      <header className="mb-6 max-w-2xl">
        <Link
          href="/app/settings"
          className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-muted transition hover:text-accent"
        >
          <ArrowLeft className="size-3" aria-hidden /> Settings
        </Link>
        <h1 className="mt-2 font-serif text-3xl font-semibold tracking-[-0.02em] md:text-4xl">
          Plans &amp; billing
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Plans scale with how much you write. Change plan any time — projects, chapters and exports stay where
          they are.
        </p>
      </header>

      <BillingClient
        plan={plan}
        status={subscription?.status ?? "active"}
        renewsOn={
          subscription?.current_period_end ? formatDate(subscription.current_period_end) : null
        }
        stripeConfigured={isStripeConfigured()}
        hasStripeCustomer={Boolean(subscription?.stripe_customer_id)}
        projectsUsed={projectIds.length}
        wordsUsed={wordsUsed}
        checkoutStatus={checkoutStatus}
      />
    </div>
  );
}
