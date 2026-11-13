/**
 * Minimal Stripe client built on `fetch`.
 *
 * The official `stripe` package is intentionally not a dependency, so this file
 * speaks the REST API directly and verifies webhook signatures by hand.
 * Everything degrades to a clear error when `STRIPE_SECRET_KEY` is absent.
 */

import { createHmac, timingSafeEqual } from "crypto";
import { PLANS, type BillingInterval, type PlanId } from "@/lib/plans";

const STRIPE_API = "https://api.stripe.com/v1";

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export class StripeError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "StripeError";
    this.status = status;
  }
}

function secretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new StripeError("Stripe is not configured.", 400);
  return key;
}

/**
 * POST to Stripe with `application/x-www-form-urlencoded` params.
 * Stripe's API is form-encoded, not JSON — URLSearchParams handles nesting like
 * `line_items[0][price_data][currency]` exactly as Stripe expects.
 */
async function stripePost<T>(path: string, params: Record<string, string | number | boolean | undefined>): Promise<T> {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    body.set(key, String(value));
  }

  let res: Response;
  try {
    res = await fetch(`${STRIPE_API}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey()}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Stripe-Version": "2024-06-20",
      },
      body: body.toString(),
      cache: "no-store",
    });
  } catch {
    throw new StripeError("Could not reach Stripe. Check your network and try again.", 502);
  }

  const json = (await res.json().catch(() => null)) as
    | (T & { error?: { message?: string } })
    | null;

  if (!res.ok || !json) {
    throw new StripeError(json?.error?.message ?? `Stripe request failed (HTTP ${res.status}).`, res.status);
  }
  return json;
}

/** Simple GET for objects we need to read back (subscription period end, etc.). */
export async function stripeGet<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${STRIPE_API}${path}`, {
      headers: { Authorization: `Bearer ${secretKey()}`, "Stripe-Version": "2024-06-20" },
      cache: "no-store",
    });
  } catch {
    throw new StripeError("Could not reach Stripe.", 502);
  }
  const json = (await res.json().catch(() => null)) as (T & { error?: { message?: string } }) | null;
  if (!res.ok || !json) {
    throw new StripeError(json?.error?.message ?? `Stripe request failed (HTTP ${res.status}).`, res.status);
  }
  return json;
}

/* ------------------------------------------------------------------ types */

export interface StripeCheckoutSession {
  id: string;
  url: string | null;
  customer: string | null;
  subscription: string | null;
  client_reference_id: string | null;
  metadata: Record<string, string> | null;
  payment_status?: string;
  mode?: string;
}

export interface StripeSubscription {
  id: string;
  status: string;
  customer: string;
  current_period_end: number | null;
  cancel_at_period_end?: boolean;
  metadata: Record<string, string> | null;
  items?: { data?: { price?: { id?: string; nickname?: string | null; unit_amount?: number | null; recurring?: { interval?: string } | null } }[] };
}

export interface StripeBillingPortalSession {
  id: string;
  url: string;
}

/* ---------------------------------------------------------------- checkout */

/** Optional dashboard-created prices; falls back to inline price_data. */
function configuredPriceId(plan: PlanId, interval: BillingInterval): string | undefined {
  const key = `STRIPE_PRICE_${plan.toUpperCase()}_${interval === "year" ? "ANNUAL" : "MONTHLY"}`;
  const value = process.env[key]?.trim();
  return value || undefined;
}

export interface CreateCheckoutInput {
  userId: string;
  email: string | null;
  plan: PlanId;
  interval: BillingInterval;
  successUrl: string;
  cancelUrl: string;
  /** Reuse the customer created by an earlier subscription, when we have one. */
  customerId?: string | null;
}

export async function createCheckoutSession(input: CreateCheckoutInput): Promise<StripeCheckoutSession> {
  const plan = PLANS[input.plan];
  if (plan.monthly === 0) throw new StripeError("The free plan does not need checkout.", 400);

  const unitAmount = input.interval === "year" ? plan.annualTotal * 100 : plan.monthly * 100;
  const priceId = configuredPriceId(input.plan, input.interval);

  const params: Record<string, string | number | boolean | undefined> = {
    mode: "subscription",
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    client_reference_id: input.userId,
    "metadata[user_id]": input.userId,
    "metadata[plan]": input.plan,
    "metadata[interval]": input.interval,
    "subscription_data[metadata][user_id]": input.userId,
    "subscription_data[metadata][plan]": input.plan,
    "subscription_data[metadata][interval]": input.interval,
    allow_promotion_codes: true,
    "line_items[0][quantity]": 1,
  };

  if (input.customerId) {
    params.customer = input.customerId;
  } else if (input.email) {
    params.customer_email = input.email;
  }

  if (priceId) {
    params["line_items[0][price]"] = priceId;
  } else {
    params["line_items[0][price_data][currency]"] = "usd";
    params["line_items[0][price_data][unit_amount]"] = unitAmount;
    params["line_items[0][price_data][recurring][interval]"] = input.interval === "year" ? "year" : "month";
    params["line_items[0][price_data][product_data][name]"] = `Inkwell Studio ${plan.name}`;
    params["line_items[0][price_data][product_data][description]"] =
      input.interval === "year" ? `${plan.name} plan, billed yearly (2 months free)` : `${plan.name} plan, billed monthly`;
  }

  return stripePost<StripeCheckoutSession>("/checkout/sessions", params);
}

export async function createBillingPortalSession(input: {
  customerId: string;
  returnUrl: string;
}): Promise<StripeBillingPortalSession> {
  return stripePost<StripeBillingPortalSession>("/billing_portal/sessions", {
    customer: input.customerId,
    return_url: input.returnUrl,
  });
}

export async function retrieveSubscription(id: string): Promise<StripeSubscription> {
  return stripeGet<StripeSubscription>(`/subscriptions/${encodeURIComponent(id)}`);
}

/* ------------------------------------------------------------- webhook sig */

export interface VerifySignatureInput {
  payload: string;
  header: string | null;
  secret: string;
  /** Reject events older than this many seconds (replay protection). */
  toleranceSeconds?: number;
  now?: number;
}

export type SignatureResult = { valid: true } | { valid: false; reason: string };

interface ParsedSignatureHeader {
  timestamp: number | null;
  signatures: string[];
}

function parseSignatureHeader(header: string): ParsedSignatureHeader {
  const out: ParsedSignatureHeader = { timestamp: null, signatures: [] };
  for (const part of header.split(",")) {
    const [rawKey, rawValue] = part.split("=", 2);
    const key = rawKey?.trim();
    const value = rawValue?.trim();
    if (!key || !value) continue;
    if (key === "t") {
      const ts = Number(value);
      out.timestamp = Number.isFinite(ts) ? ts : null;
    } else if (key === "v1") {
      out.signatures.push(value);
    }
  }
  return out;
}

/**
 * Verify a `Stripe-Signature` header: HMAC-SHA256 of `${timestamp}.${rawBody}`
 * keyed with the webhook secret, compared in constant time, with a clock
 * tolerance so old captured payloads cannot be replayed.
 */
export function verifyStripeSignature({
  payload,
  header,
  secret,
  toleranceSeconds = 300,
  now = Math.floor(Date.now() / 1000),
}: VerifySignatureInput): SignatureResult {
  if (!secret) return { valid: false, reason: "missing_secret" };
  if (!header) return { valid: false, reason: "missing_header" };

  const parsed = parseSignatureHeader(header);
  if (parsed.timestamp === null) return { valid: false, reason: "missing_timestamp" };
  if (parsed.signatures.length === 0) return { valid: false, reason: "missing_signature" };

  if (Math.abs(now - parsed.timestamp) > toleranceSeconds) {
    return { valid: false, reason: "timestamp_out_of_tolerance" };
  }

  const expected = createHmac("sha256", secret)
    .update(`${parsed.timestamp}.${payload}`, "utf8")
    .digest();

  for (const candidate of parsed.signatures) {
    let provided: Buffer;
    try {
      provided = Buffer.from(candidate, "hex");
    } catch {
      continue;
    }
    if (provided.length !== expected.length) continue;
    if (timingSafeEqual(provided, expected)) return { valid: true };
  }

  return { valid: false, reason: "signature_mismatch" };
}

/**
 * Map a Stripe subscription status to the plan we should grant.
 * Canceled / unpaid subscriptions drop the workspace back to Free; past_due
 * keeps access during Stripe's retry window.
 */
export function planForStatus(status: string, fallbackPlan: string): PlanId {
  const s = status.toLowerCase();
  if (s === "canceled" || s === "incomplete_expired" || s === "unpaid") return "free";
  return fallbackPlan === "pro" || fallbackPlan === "studio" ? fallbackPlan : "free";
}

export function isActiveStatus(status: string): boolean {
  return ["active", "trialing", "past_due"].includes(status.toLowerCase());
}
