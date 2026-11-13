/**
 * Canonical plan definitions for Inkwell Studio.
 *
 * This file is the single source of truth for pricing, limits and the feature
 * matrix. The billing UI, settings surfaces and server actions all read from
 * here — do not hard-code limits anywhere else.
 */

export type PlanId = "free" | "pro" | "studio";
export type BillingInterval = "month" | "year";

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  /** Whole US dollars per month when billed monthly. */
  monthly: number;
  /** Whole US dollars for a full year when billed annually (2 months free). */
  annualTotal: number;
  /** Effective monthly price on the annual plan, before display rounding. */
  annualMonthly: number;
  /** Number of owned projects, or null for unlimited. */
  projects: number | null;
  /** Words across all projects, or null for unlimited. */
  words: number | null;
  /** Collaborators per project. 0 means collaboration is not available. */
  collaborators: number;
  /** Public API requests per calendar month, or 0 when the API is not included. */
  apiRequests: number;
  webhooks: boolean;
  /** Shown on the comparison table; kept separate from numbers so copy stays editable. */
  notes: string[];
}

function plan(input: Omit<Plan, "annualTotal" | "annualMonthly">): Plan {
  return {
    ...input,
    annualTotal: input.monthly * 10,
    annualMonthly: (input.monthly * 10) / 12,
  };
}

export const PLANS: Record<PlanId, Plan> = {
  free: plan({
    id: "free",
    name: "Free",
    tagline: "Five projects, every tool, no time limit.",
    monthly: 0,
    projects: 5,
    words: 25_000,
    collaborators: 0,
    apiRequests: 0,
    webhooks: false,
    notes: ["Up to 5 projects", "Every export format", "No time limit"],
  }),
  pro: plan({
    id: "pro",
    name: "Pro",
    tagline: "For writers with more than one book in them.",
    monthly: 12,
    projects: 10,
    words: null,
    collaborators: 1,
    apiRequests: 10_000,
    webhooks: false,
    notes: ["Up to 10 projects", "Unlimited words", "One collaborator per project", "API access"],
  }),
  studio: plan({
    id: "studio",
    name: "Studio",
    tagline: "For small presses and writing partnerships.",
    monthly: 29,
    projects: null,
    words: null,
    collaborators: 5,
    apiRequests: 100_000,
    webhooks: true,
    notes: ["Unlimited projects", "Five collaborators per project", "Outbound webhooks", "Highest API quota"],
  }),
};

export const PLAN_ORDER: PlanId[] = ["free", "pro", "studio"];

export function isPlanId(value: unknown): value is PlanId {
  return value === "free" || value === "pro" || value === "studio";
}

/** Always returns a plan — unknown values fall back to Free rather than throwing. */
export function getPlan(value: string | null | undefined): Plan {
  return PLANS[isPlanId(value) ? value : "free"];
}

export function planName(value: string | null | undefined): string {
  return getPlan(value).name;
}

export interface PlanLimits {
  plan: PlanId;
  projects: number | null;
  words: number | null;
  collaborators: number;
  apiRequests: number;
  webhooks: boolean;
  hasApi: boolean;
  hasCollaboration: boolean;
}

/**
 * Normalised limits for a plan id. `null` means unlimited.
 * Unknown strings (legacy rows, bad data) degrade to the free plan.
 */
export function planLimits(value: string | null | undefined): PlanLimits {
  const p = getPlan(value);
  return {
    plan: p.id,
    projects: p.projects,
    words: p.words,
    collaborators: p.collaborators,
    apiRequests: p.apiRequests,
    webhooks: p.webhooks,
    hasApi: p.apiRequests > 0,
    hasCollaboration: p.collaborators > 0,
  };
}

/** True when `used` is within `limit`; unlimited limits always pass. */
export function withinLimit(used: number, limit: number | null | undefined): boolean {
  return limit == null || used <= limit;
}

/** 0–100, clamped. Returns 0 for unlimited so the bar never looks "full". */
export function usagePercent(used: number, limit: number | null | undefined): number {
  if (limit == null || limit <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((used / limit) * 100)));
}

export function formatLimit(limit: number | null | undefined): string {
  return limit == null ? "Unlimited" : limit.toLocaleString("en-US");
}

export function formatProjectsLimit(limit: number | null | undefined): string {
  if (limit == null) return "Unlimited projects";
  return `${limit.toLocaleString("en-US")} ${limit === 1 ? "project" : "projects"}`;
}

export function formatApiLimit(requests: number): string {
  if (requests <= 0) return "Not included";
  return `${requests.toLocaleString("en-US")} req / mo`;
}

/** Effective monthly price to display for a cadence. */
export function monthlyPrice(p: Plan, interval: BillingInterval): number {
  if (interval === "month") return p.monthly;
  return p.annualMonthly;
}

/** "$12" / "$24.17" / "$0" — exact, so annual totals always reconcile. */
export function formatPrice(amount: number): string {
  return Number.isInteger(amount)
    ? `$${amount.toLocaleString("en-US")}`
    : `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export interface FeatureRow {
  key: string;
  label: string;
  /** Rendered per plan. */
  values: Record<PlanId, string>;
  hint?: string;
}

export const FEATURE_MATRIX: FeatureRow[] = [
  {
    key: "projects",
    label: "Projects",
    values: { free: "5", pro: "10", studio: "Unlimited" },
    hint: "Each project holds chapters, notes, storyboard and canvases.",
  },
  {
    key: "words",
    label: "Words written",
    values: { free: "25,000", pro: "Unlimited", studio: "Unlimited" },
    hint: "Counted across every chapter you own.",
  },
  {
    key: "collaborators",
    label: "Collaborators",
    values: { free: "—", pro: "1 per project", studio: "5 per project" },
    hint: "Editors and reviewers you invite to a project.",
  },
  {
    key: "api",
    label: "Public API",
    values: { free: "—", pro: "10,000 req / mo", studio: "100,000 req / mo" },
    hint: "Agent API access with your own API keys.",
  },
  {
    key: "webhooks",
    label: "Outbound webhooks",
    values: { free: "—", pro: "—", studio: "Included" },
    hint: "Push chapter, asset and export events to your own services.",
  },
  {
    key: "exports",
    label: "Export formats",
    values: { free: "All formats", pro: "All formats", studio: "All formats" },
  },
];

/** Next plan up the ladder, or null at the ceiling. */
export function nextPlan(value: string | null | undefined): Plan | null {
  const i = PLAN_ORDER.indexOf(getPlan(value).id);
  return i >= 0 && i < PLAN_ORDER.length - 1 ? PLANS[PLAN_ORDER[i + 1]] : null;
}

/** -1 downgrade, 0 same, 1 upgrade. */
export function comparePlans(a: string | null | undefined, b: string | null | undefined): number {
  return PLAN_ORDER.indexOf(getPlan(a).id) - PLAN_ORDER.indexOf(getPlan(b).id);
}
