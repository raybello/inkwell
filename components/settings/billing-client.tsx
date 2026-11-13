"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  Check,
  CreditCard,
  ExternalLink,
  Info,
  Lock,
  Minus,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/misc";
import { Dialog } from "@/components/ui/dialog";
import {
  FEATURE_MATRIX,
  PLANS,
  PLAN_ORDER,
  comparePlans,
  formatPrice,
  monthlyPrice,
  planLimits,
  usagePercent,
  type BillingInterval,
  type Plan,
  type PlanId,
} from "@/lib/plans";
import { changePlanDevPreview, openBillingPortalAction, startCheckoutAction } from "@/lib/actions/billing";

export interface BillingClientProps {
  plan: PlanId;
  status: string;
  /** Pre-formatted on the server so hydration never disagrees. */
  renewsOn: string | null;
  stripeConfigured: boolean;
  hasStripeCustomer: boolean;
  projectsUsed: number;
  wordsUsed: number;
  checkoutStatus: "success" | "cancelled" | null;
}

export function BillingClient({
  plan,
  status,
  renewsOn,
  stripeConfigured,
  hasStripeCustomer,
  projectsUsed,
  wordsUsed,
  checkoutStatus,
}: BillingClientProps) {
  const current = PLANS[plan];
  const limits = planLimits(plan);
  const [interval, setInterval] = React.useState<BillingInterval>("month");
  const [pending, startTransition] = React.useTransition();
  const [targetPlan, setTargetPlan] = React.useState<PlanId | null>(null);
  const [pendingPlan, setPendingPlan] = React.useState<PlanId | null>(null);

  const statusLabel = status === "active" ? "Active" : status === "canceled" ? "Cancelled" : status.replace(/_/g, " ");

  function choose(next: PlanId) {
    if (next === plan) return;

    if (!stripeConfigured) {
      setTargetPlan(next);
      return;
    }

    // Real billing: free means "cancel", which only the Stripe portal can do.
    if (next === "free") {
      if (!hasStripeCustomer) {
        toast.error("No billing customer on file. Contact support to cancel.");
        return;
      }
      setPendingPlan(next);
      startTransition(async () => {
        const result = await openBillingPortalAction();
        if (!result.ok) toast.error(result.error ?? "Could not open the billing portal.");
        setPendingPlan(null);
      });
      return;
    }

    setPendingPlan(next);
    startTransition(async () => {
      const result = await startCheckoutAction(next, interval);
      if (!result.ok) {
        toast.error(result.error ?? "Could not start checkout.");
        setPendingPlan(null);
      }
    });
  }

  function confirmDemo() {
    if (!targetPlan) return;
    const next = targetPlan;
    setPendingPlan(next);
    startTransition(async () => {
      const result = await changePlanDevPreview(next);
      setPendingPlan(null);
      setTargetPlan(null);
      if (result.ok) toast.success(result.notice ?? "Plan updated in demo mode.");
      else toast.error(result.error ?? "Could not change the plan.");
    });
  }

  function openPortal() {
    startTransition(async () => {
      const result = await openBillingPortalAction();
      if (!result.ok) toast.error(result.error ?? "Could not open the billing portal.");
    });
  }

  return (
    <div className="space-y-6">
      {checkoutStatus === "success" && (
        <Banner tone="sage" icon={<BadgeCheck className="size-4" />} title="Checkout complete">
          Stripe accepted the payment. Your plan updates as soon as the webhook is confirmed — usually a few
          seconds. Refresh if it still shows the old plan.
        </Banner>
      )}
      {checkoutStatus === "cancelled" && (
        <Banner tone="neutral" icon={<Info className="size-4" />} title="Checkout cancelled">
          Nothing was charged and your plan is unchanged.
        </Banner>
      )}

      {!stripeConfigured && (
        <Banner tone="amber" icon={<Info className="size-4" />} title="Demo mode: no payment is collected">
          Stripe isn&apos;t connected in this environment. Plan buttons update your subscription record only — no
          card is charged, no invoice is created, and no money moves.{" "}
          <span className="text-muted">Add STRIPE_SECRET_KEY to take real payments.</span>
        </Banner>
      )}

      {/* ------------------------------------------------------ current plan */}
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted">Current plan</p>
              <div className="flex items-baseline gap-2">
                <h2 className="font-serif text-2xl font-semibold">{current.name}</h2>
                {plan !== "free" && (
                  <Badge tone={status === "active" ? "sage" : "amber"}>{statusLabel}</Badge>
                )}
              </div>
              <p className="text-sm text-muted">{current.tagline}</p>
            </div>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md border border-accent/25 bg-accent/10 text-accent">
              <CreditCard className="size-4" aria-hidden />
            </span>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border">
            <div className="bg-ink-900 px-3 py-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted">Price</p>
              <p className="mt-1 font-serif text-lg">
                {current.monthly === 0 ? "Free" : `${formatPrice(current.monthly)} / mo`}
              </p>
              <p className="text-[11px] text-muted">
                {current.monthly === 0 ? "No card required" : "Cancel any time"}
              </p>
            </div>
            <div className="bg-ink-900 px-3 py-3">
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted">
                {status === "canceled" ? "Access ends" : "Renews"}
              </p>
              <p className="mt-1 flex items-center gap-1.5 font-serif text-lg">
                <CalendarClock className="size-3.5 text-muted" aria-hidden />
                {plan === "free" ? "Never" : renewsOn ?? "No subscription"}
              </p>
              <p className="text-[11px] text-muted">
                {plan === "free"
                  ? "Free plan has no renewal"
                  : status === "canceled"
                    ? "Then back to Free"
                    : "Billed automatically"}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {stripeConfigured && hasStripeCustomer ? (
              <Button type="button" variant="secondary" size="sm" onClick={openPortal} disabled={pending}>
                Manage billing
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => document.getElementById("plans")?.scrollIntoView({ behavior: "smooth" })}
              >
                {plan === "free" ? "See plans" : "Change plan"}
              </Button>
            )}
            <a
              href="/app/settings/api"
              className="inline-flex items-center gap-1 text-[12px] text-muted transition hover:text-accent"
            >
              API keys <ExternalLink className="size-3" aria-hidden />
            </a>
          </div>
        </div>

        {/* --------------------------------------------------------- usage */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-serif text-lg font-semibold">Usage</h2>
            <span className="text-[10px] uppercase tracking-[0.16em] text-muted">This account</span>
          </div>

          <div className="mt-4 space-y-4">
            <UsageRow
              label="Projects"
              used={projectsUsed}
              limit={limits.projects}
              unit={limits.projects === 1 ? "project" : "projects"}
            />
            <UsageRow label="Words written" used={wordsUsed} limit={limits.words} unit="words" />
          </div>

          <p className="mt-4 border-t border-border pt-3 text-[11px] leading-relaxed text-muted">
            {limits.projects == null
              ? "Unlimited projects on your plan."
              : projectsUsed >= limits.projects
                ? "You've reached your project limit. Archive a finished project or move up a plan."
                : `${formatNumber(Math.max(0, limits.projects - projectsUsed))} project slot${
                    limits.projects - projectsUsed === 1 ? "" : "s"
                  } left.`}{" "}
            Word counts come from saved chapters across projects you own.
          </p>
        </div>
      </section>

      {/* ----------------------------------------------------------- plans */}
      <section id="plans" className="scroll-mt-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-serif text-2xl font-semibold tracking-[-0.01em]">Plans</h2>
            <p className="mt-1 max-w-xl text-sm text-muted">
              Change whenever you like. Downgrades keep your work — projects over the new limit become read-only
              until you archive them.
            </p>
          </div>

          <div
            className="flex items-center gap-0.5 rounded-lg border border-border bg-ink-900/60 p-0.5"
            role="group"
            aria-label="Billing interval"
          >
            {(["month", "year"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={interval === value}
                onClick={() => setInterval(value)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-[13px] transition",
                  interval === value ? "bg-ink-750 text-foreground shadow-sm" : "text-muted hover:text-muted-strong",
                )}
              >
                {value === "month" ? "Monthly" : "Annual"}
                {value === "year" && (
                  <span className="ml-1.5 text-[10px] uppercase tracking-[0.1em] text-sage">2 months free</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Desktop comparison table */}
        <div className="mt-5 hidden overflow-hidden rounded-xl border border-border md:block">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Inkwell plan comparison</caption>
            <thead>
              <tr className="border-b border-border bg-ink-900/40">
                <th scope="col" className="w-[30%] px-4 py-4 text-left align-bottom">
                  <span className="text-[10px] uppercase tracking-[0.16em] text-muted">What&apos;s included</span>
                </th>
                {PLAN_ORDER.map((id) => {
                  const p = PLANS[id];
                  const isCurrent = id === plan;
                  return (
                    <th key={id} scope="col" className="px-4 py-4 text-left align-bottom">
                      <div className="flex items-center gap-2">
                        <span className="font-serif text-base font-semibold">{p.name}</span>
                        {isCurrent && <Badge tone="accent">Current</Badge>}
                      </div>
                      <p className="mt-1 font-serif text-2xl">
                        {p.monthly === 0 ? "$0" : formatPrice(monthlyPrice(p, interval))}
                        <span className="ml-1 font-sans text-[11px] font-normal text-muted">
                          {p.monthly === 0 ? "forever" : "/ mo"}
                        </span>
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted">
                        {p.monthly === 0
                          ? "No card required"
                          : interval === "year"
                            ? `${formatPrice(p.annualTotal)} billed yearly`
                            : "Billed monthly"}
                      </p>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {FEATURE_MATRIX.map((row, index) => (
                <tr key={row.key} className={cn("border-b border-border", index % 2 === 1 && "bg-ink-900/20")}>
                  <th scope="row" className="px-4 py-3 text-left align-top">
                    <span className="text-[13px] font-medium text-foreground">{row.label}</span>
                    {row.hint && <span className="mt-0.5 block text-[11px] font-normal text-muted">{row.hint}</span>}
                  </th>
                  {PLAN_ORDER.map((id) => {
                    const value = row.values[id];
                    return (
                      <td key={id} className="px-4 py-3 align-top text-[13px]">
                        {value === "—" ? (
                          <Minus className="size-3.5 text-muted/60" aria-label="Not included" />
                        ) : (
                          <span className={id === plan ? "text-foreground" : "text-muted-strong"}>{value}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <td className="px-4 py-4" />
                {PLAN_ORDER.map((id) => {
                  const p = PLANS[id];
                  return (
                    <td key={id} className="px-4 py-4">
                      <PlanButton
                        p={p}
                        current={plan}
                        pending={pending && pendingPlan === id}
                        disabled={pending}
                        interval={interval}
                        onChoose={choose}
                        full
                      />
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="mt-5 space-y-3 md:hidden">
          {PLAN_ORDER.map((id) => {
            const p = PLANS[id];
            const isCurrent = id === plan;
            return (
              <div
                key={id}
                className={cn(
                  "rounded-xl border bg-card p-4",
                  isCurrent ? "border-accent/50" : "border-border",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-serif text-lg font-semibold">{p.name}</h3>
                      {isCurrent && <Badge tone="accent">Current</Badge>}
                    </div>
                    <p className="mt-0.5 text-xs text-muted">{p.tagline}</p>
                  </div>
                  <p className="shrink-0 font-serif text-xl">
                    {p.monthly === 0 ? "$0" : formatPrice(monthlyPrice(p, interval))}
                    <span className="ml-0.5 font-sans text-[10px] font-normal text-muted">
                      {p.monthly === 0 ? "" : "/mo"}
                    </span>
                  </p>
                </div>

                <ul className="mt-3 space-y-1.5 border-t border-border pt-3">
                  {FEATURE_MATRIX.map((row) => (
                    <li key={row.key} className="flex items-start justify-between gap-3 text-[12px]">
                      <span className="text-muted">{row.label}</span>
                      <span className="text-right text-muted-strong">
                        {row.values[id] === "—" ? <Minus className="ml-auto size-3" aria-label="Not included" /> : row.values[id]}
                      </span>
                    </li>
                  ))}
                </ul>

                <div className="mt-3">
                  <PlanButton
                    p={p}
                    current={plan}
                    pending={pending && pendingPlan === id}
                    disabled={pending}
                    interval={interval}
                    onChoose={choose}
                    full
                  />
                </div>
                <p className="mt-2 text-center text-[10px] text-muted">
                  {p.monthly === 0
                    ? "No card required"
                    : interval === "year"
                      ? `${formatPrice(p.annualTotal)} billed yearly`
                      : "Billed monthly"}
                </p>
              </div>
            );
          })}
        </div>

        <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted">
          <span className="inline-flex items-center gap-1">
            <Lock className="size-3" aria-hidden /> Prices in USD
          </span>
          <span className="inline-flex items-center gap-1">
            <ShieldCheck className="size-3" aria-hidden /> Payments handled by Stripe
          </span>
          <span>Cancel any time — access runs to the end of the paid period.</span>
        </p>
      </section>

      {/* -------------------------------------------------- honest fine print */}
      <section className="rounded-xl border border-border bg-ink-900/40 p-4">
        <h2 className="flex items-center gap-2 font-serif text-base">
          <Sparkles className="size-4 text-accent" aria-hidden /> Changing plans
        </h2>
        <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted">
          <li>
            <span className="text-muted-strong">Upgrades</span> take effect immediately. Stripe prorates the
            difference against the time left on your current period.
          </li>
          <li>
            <span className="text-muted-strong">Downgrades</span> never delete work. Projects beyond the new limit
            stay readable but stop accepting edits until you archive one.
          </li>
          <li>
            <span className="text-muted-strong">No hidden fees.</span> Taxes are calculated at checkout; there are
            no setup or overage charges.
          </li>
        </ul>
      </section>

      <Dialog
        open={targetPlan !== null}
        onOpenChange={(open) => !open && setTargetPlan(null)}
        title="Demo mode: no payment is collected"
        description="Stripe is not connected in this environment. Confirming updates your plan record only."
        width="max-w-md"
        footer={
          <>
            <Button type="button" variant="ghost" size="sm" onClick={() => setTargetPlan(null)}>
              Keep {current.name}
            </Button>
            <Button type="button" variant="primary" size="sm" loading={pending} onClick={confirmDemo}>
              Set {targetPlan ? PLANS[targetPlan].name : ""} plan (demo)
            </Button>
          </>
        }
      >
        {targetPlan && (
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-md border border-border bg-ink-850/60 px-3 py-2">
              <span className="text-muted">Plan</span>
              <span>
                {current.name} → <strong>{PLANS[targetPlan].name}</strong>
              </span>
            </div>
            <div className="flex items-center justify-between rounded-md border border-border bg-ink-850/60 px-3 py-2">
              <span className="text-muted">Amount charged</span>
              <span className="font-mono">$0.00</span>
            </div>
            <p className="text-xs leading-relaxed text-muted">
              {PLANS[targetPlan].monthly === 0
                ? "This drops the account to Free. In a real deployment cancellation would run to the end of the paid period."
                : `In production this would open Stripe Checkout for ${formatPrice(
                    monthlyPrice(PLANS[targetPlan], interval),
                  )} / month${
                    interval === "year" ? `, billed as ${formatPrice(PLANS[targetPlan].annualTotal)} yearly` : ""
                  }.`}
            </p>
          </div>
        )}
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------- atoms */

function PlanButton({
  p,
  current,
  pending,
  disabled,
  interval,
  onChoose,
  full,
}: {
  p: Plan;
  current: PlanId;
  pending: boolean;
  disabled: boolean;
  interval: BillingInterval;
  onChoose: (id: PlanId) => void;
  full?: boolean;
}) {
  const diff = comparePlans(p.id, current);
  const isCurrent = diff === 0;
  const label = isCurrent
    ? "Current plan"
    : diff > 0
      ? `Upgrade to ${p.name}`
      : p.id === "free"
        ? "Cancel plan"
        : `Downgrade to ${p.name}`;
  const priceLabel = p.monthly === 0 ? "" : ` — ${formatPrice(monthlyPrice(p, interval))}/mo`;

  return (
    <Button
      type="button"
      size="sm"
      variant={isCurrent ? "outline" : diff > 0 ? "primary" : "secondary"}
      className={cn(full && "w-full")}
      disabled={isCurrent || disabled}
      loading={pending}
      onClick={() => onChoose(p.id)}
      aria-label={isCurrent ? `${p.name} is your current plan` : `${label}${priceLabel}`}
    >
      {isCurrent ? (
        <>
          <Check /> Current plan
        </>
      ) : (
        <>
          {label} <ArrowRight className="size-3.5" />
        </>
      )}
    </Button>
  );
}

function UsageRow({
  label,
  used,
  limit,
  unit,
}: {
  label: string;
  used: number;
  limit: number | null;
  unit: string;
}) {
  const percent = usagePercent(used, limit);
  const atLimit = limit != null && used >= limit;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] text-muted-strong">{label}</span>
        <span className={cn("font-mono text-[11px]", atLimit ? "text-amber-300" : "text-muted")}>
          {formatNumber(used)}
          <span className="text-muted/60"> / {limit == null ? "∞" : formatNumber(limit)}</span>
        </span>
      </div>
      <Progress value={percent} className={cn("mt-1.5", atLimit && "bg-amber-900/40")} />
      <p className="mt-1 text-[10px] text-muted">
        {limit == null ? `Unlimited ${unit}` : atLimit ? `${label} limit reached` : `${percent}% of plan`}
      </p>
    </div>
  );
}

function Banner({
  tone,
  icon,
  title,
  children,
}: {
  tone: "amber" | "sage" | "neutral";
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 rounded-xl border px-4 py-3",
        tone === "amber" && "border-amber-700/40 bg-amber-800/10",
        tone === "sage" && "border-sage/30 bg-sage/10",
        tone === "neutral" && "border-border-strong bg-ink-850/60",
      )}
    >
      <span
        className={cn(
          "mt-0.5 shrink-0",
          tone === "amber" ? "text-amber-300" : tone === "sage" ? "text-sage" : "text-muted-strong",
        )}
        aria-hidden
      >
        {icon}
      </span>
      <div className="min-w-0 space-y-0.5">
        <p className="text-[13px] font-medium text-foreground">{title}</p>
        <div className="text-xs leading-relaxed text-muted-strong">{children}</div>
      </div>
    </div>
  );
}
