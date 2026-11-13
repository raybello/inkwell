"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth";
import { isPlanId, getPlan, type BillingInterval, type PlanId } from "@/lib/plans";
import {
  createBillingPortalSession,
  createCheckoutSession,
  isStripeConfigured,
  StripeError,
} from "@/lib/stripe";

export type BillingResult = { ok: boolean; error?: string; notice?: string };

function siteOrigin(origin: string | null): string {
  return (origin ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

async function currentSubscription() {
  const user = await getSessionUser();
  if (!user) return { user: null, subscription: null as null | Record<string, unknown> };
  const supabase = await createClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  return { user, subscription: (data as Record<string, unknown> | null) ?? null };
}

function revalidateBilling() {
  revalidatePath("/app/settings/billing");
  revalidatePath("/app/settings");
  revalidatePath("/app", "layout");
}

/**
 * Demo-mode plan change. Deliberately refuses when Stripe is configured — a
 * real key means real money, and this action must never be a free upgrade path.
 * The UI labels the confirmation "Demo mode: no payment is collected".
 */
export async function changePlanDevPreview(plan: PlanId): Promise<BillingResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  if (!isPlanId(plan)) return { ok: false, error: "Unknown plan." };

  if (isStripeConfigured()) {
    return {
      ok: false,
      error: "Stripe is configured for this workspace. Use checkout so the change is paid for and recorded by Stripe.",
    };
  }

  const supabase = await createClient();
  const periodEnd =
    plan === "free" ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { error: subError } = await supabase.from("subscriptions").upsert(
    {
      user_id: user.id,
      plan,
      status: plan === "free" ? "canceled" : "active",
      current_period_end: periodEnd,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (subError) return { ok: false, error: subError.message };

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ plan, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (profileError) return { ok: false, error: profileError.message };

  revalidateBilling();

  return {
    ok: true,
    notice:
      plan === "free"
        ? "Demo mode: plan set to Free. No payment was taken and no refund was issued."
        : `Demo mode: plan set to ${getPlan(plan).name}. No payment was collected and no invoice was created.`,
  };
}

/** Real checkout. Only reachable when STRIPE_SECRET_KEY is present. */
export async function startCheckoutAction(
  plan: PlanId,
  interval: BillingInterval = "month",
): Promise<BillingResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  if (!isPlanId(plan) || plan === "free") return { ok: false, error: "Choose a paid plan to check out." };
  if (interval !== "month" && interval !== "year") return { ok: false, error: "Unknown billing interval." };
  if (!isStripeConfigured()) {
    return { ok: false, error: "Card payments are not configured in this environment." };
  }

  const { subscription } = await currentSubscription();
  const origin = siteOrigin((await headers()).get("origin"));

  let checkoutUrl: string | null = null;
  try {
    const session = await createCheckoutSession({
      userId: user.id,
      email: user.email ?? null,
      plan,
      interval,
      customerId: (subscription?.stripe_customer_id as string | null) ?? null,
      successUrl: `${origin}/app/settings/billing?checkout=success`,
      cancelUrl: `${origin}/app/settings/billing?checkout=cancelled`,
    });
    checkoutUrl = session.url;
  } catch (error) {
    const message = error instanceof StripeError ? error.message : "Could not start checkout.";
    return { ok: false, error: message };
  }

  if (!checkoutUrl) return { ok: false, error: "Stripe did not return a checkout URL." };
  redirect(checkoutUrl);
}

/** Stripe-hosted billing portal: invoices, payment method, cancellation. */
export async function openBillingPortalAction(): Promise<BillingResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, error: "You must be signed in." };
  if (!isStripeConfigured()) {
    return { ok: false, error: "The billing portal needs STRIPE_SECRET_KEY." };
  }

  const { subscription } = await currentSubscription();
  const customerId = (subscription?.stripe_customer_id as string | null) ?? null;
  if (!customerId) {
    return { ok: false, error: "No Stripe customer on file yet. Start a subscription first." };
  }

  const origin = siteOrigin((await headers()).get("origin"));

  let portalUrl: string | null = null;
  try {
    const portal = await createBillingPortalSession({
      customerId,
      returnUrl: `${origin}/app/settings/billing`,
    });
    portalUrl = portal.url;
  } catch (error) {
    const message = error instanceof StripeError ? error.message : "Could not open the billing portal.";
    return { ok: false, error: message };
  }

  if (!portalUrl) return { ok: false, error: "Stripe did not return a portal URL." };
  redirect(portalUrl);
}
