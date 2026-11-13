import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isActiveStatus,
  planForStatus,
  retrieveSubscription,
  verifyStripeSignature,
  type StripeSubscription,
} from "@/lib/stripe";
import { isPlanId, PLANS, type PlanId } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface StripeEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

interface CheckoutSessionObject {
  id: string;
  mode?: string;
  customer?: string | null;
  subscription?: string | null;
  client_reference_id?: string | null;
  metadata?: Record<string, string> | null;
}

function planFromMetadata(value: unknown, fallback: PlanId = "free"): PlanId {
  return isPlanId(value) ? value : fallback;
}

function isoFromUnix(seconds: unknown): string | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) return null;
  return new Date(seconds * 1000).toISOString();
}

/** Stripe may send an id or an expanded object; we only ever store the id. */
function idOf(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === "string" ? id : null;
  }
  return null;
}

/**
 * Derive the plan from the price the customer is actually paying for. This
 * wins over metadata so a plan changed inside the Stripe portal still lands on
 * the right tier.
 */
function planFromPrice(subscription: StripeSubscription): PlanId | null {
  const price = subscription.items?.data?.[0]?.price;
  const cents = price?.unit_amount;
  if (typeof cents !== "number") return null;
  const dollars = cents / 100;
  const annual = price?.recurring?.interval === "year";
  return (
    (Object.keys(PLANS) as PlanId[]).find((id) =>
      annual ? PLANS[id].annualTotal === dollars : PLANS[id].monthly === dollars,
    ) ?? null
  );
}

async function writeSubscription(input: {
  userId: string;
  plan: PlanId;
  status: string;
  customerId?: string | null;
  subscriptionId?: string | null;
  periodEnd?: string | null;
}) {
  const admin = createAdminClient();
  const { error: subError } = await admin.from("subscriptions").upsert(
    {
      user_id: input.userId,
      plan: input.plan,
      status: input.status,
      ...(input.customerId !== undefined ? { stripe_customer_id: input.customerId } : {}),
      ...(input.subscriptionId !== undefined ? { stripe_subscription_id: input.subscriptionId } : {}),
      current_period_end: input.periodEnd ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (subError) throw new Error(`subscriptions upsert failed: ${subError.message}`);

  const { error: profileError } = await admin
    .from("profiles")
    .update({ plan: input.plan, updated_at: new Date().toISOString() })
    .eq("id", input.userId);
  if (profileError) throw new Error(`profiles update failed: ${profileError.message}`);
}

async function resolveUserId(subscription: StripeSubscription): Promise<string | null> {
  const fromMetadata = subscription.metadata?.user_id;
  if (fromMetadata) return fromMetadata;

  const admin = createAdminClient();
  const { data } = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle();
  return (data?.user_id as string | undefined) ?? null;
}

async function handleCheckoutCompleted(object: CheckoutSessionObject) {
  if (object.mode && object.mode !== "subscription") return "ignored:not_subscription";

  const userId = object.metadata?.user_id ?? object.client_reference_id ?? null;
  if (!userId) throw new Error("checkout.session.completed without a user reference");

  let plan = planFromMetadata(object.metadata?.plan);
  const subscriptionId = idOf(object.subscription);

  let periodEnd: string | null = null;
  let status = "active";
  if (subscriptionId) {
    // Best-effort: the session does not carry the period end, the subscription does.
    try {
      const subscription = await retrieveSubscription(subscriptionId);
      periodEnd = isoFromUnix(subscription.current_period_end);
      status = subscription.status;
      plan = planFromPrice(subscription) ?? plan;
    } catch (error) {
      console.warn(
        `[stripe] could not read subscription ${subscriptionId}: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
    }
  }

  await writeSubscription({
    userId,
    plan: isActiveStatus(status) ? planForStatus(status, plan) : "free",
    status,
    customerId: idOf(object.customer) ?? undefined,
    subscriptionId: subscriptionId ?? undefined,
    periodEnd,
  });

  return `plan:${plan}`;
}

async function handleSubscriptionChanged(subscription: StripeSubscription) {
  const userId = await resolveUserId(subscription);
  if (!userId) throw new Error(`no local user for subscription ${subscription.id}`);

  const requestedPlan =
    planFromPrice(subscription) ?? planFromMetadata(subscription.metadata?.plan, "free");
  const plan = isActiveStatus(subscription.status)
    ? planForStatus(subscription.status, requestedPlan)
    : "free";

  await writeSubscription({
    userId,
    plan,
    status: subscription.status,
    customerId: idOf(subscription.customer) ?? undefined,
    subscriptionId: subscription.id,
    periodEnd: isoFromUnix(subscription.current_period_end),
  });

  return `status:${subscription.status} plan:${plan}`;
}

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[stripe] webhook received but STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json(
      { error: "webhook_not_configured", detail: "Set STRIPE_WEBHOOK_SECRET to accept Stripe events." },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  const verification = verifyStripeSignature({ payload: rawBody, header: signature, secret });
  if (!verification.valid) {
    console.warn(`[stripe] rejected webhook: ${verification.reason}`);
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  try {
    let outcome = "ignored";
    switch (event.type) {
      case "checkout.session.completed":
        outcome = await handleCheckoutCompleted(event.data.object as unknown as CheckoutSessionObject);
        break;
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as unknown as StripeSubscription;
        outcome = await handleSubscriptionChanged(subscription);
        break;
      }
      default:
        return NextResponse.json({ received: true, ignored: event.type });
    }

    console.info(`[stripe] ${event.type} (${event.id}) → ${outcome}`);
    return NextResponse.json({ received: true, outcome });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(`[stripe] ${event.type} failed: ${message}`);
    // 500 makes Stripe retry — correct for transient DB failures.
    return NextResponse.json({ error: "handler_failed", detail: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(
    { ok: false, detail: "Stripe webhooks are delivered with POST only." },
    { status: 405 },
  );
}
