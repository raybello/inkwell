import { describe, expect, it } from "vitest";
import {
  PLANS,
  comparePlans,
  formatPrice,
  getPlan,
  isPlanId,
  monthlyPrice,
  nextPlan,
  planLimits,
  usagePercent,
  withinLimit,
} from "@/lib/plans";

describe("plan math", () => {
  it("annual total is 10x monthly (2 months free) and matches billing derivation", () => {
    for (const p of Object.values(PLANS)) {
      expect(p.annualTotal).toBe(p.monthly * 10);
      expect(p.annualMonthly).toBeCloseTo((p.monthly * 10) / 12, 10);
    }
  });

  it("isPlanId / getPlan degrade unknown values to free", () => {
    expect(isPlanId("pro")).toBe(true);
    expect(isPlanId("platinum")).toBe(false);
    expect(getPlan("platinum").id).toBe("free");
    expect(getPlan(null).id).toBe("free");
  });

  it("withinLimit treats null as unlimited", () => {
    expect(withinLimit(10, null)).toBe(true);
    expect(withinLimit(10, 10)).toBe(true);
    expect(withinLimit(11, 10)).toBe(false);
    expect(withinLimit(0, undefined)).toBe(true);
  });

  it("usagePercent clamps 0-100 and returns 0 for unlimited", () => {
    expect(usagePercent(50, 100)).toBe(50);
    expect(usagePercent(150, 100)).toBe(100);
    expect(usagePercent(-5, 100)).toBe(0);
    expect(usagePercent(9_999, null)).toBe(0);
    expect(usagePercent(5, 0)).toBe(0);
  });

  it("planLimits exposes derived booleans consistently", () => {
    const free = planLimits("free");
    expect(free.hasApi).toBe(false);
    expect(free.hasCollaboration).toBe(false);
    const pro = planLimits("pro");
    expect(pro.hasApi).toBe(true);
    expect(pro.hasCollaboration).toBe(true);
    expect(planLimits("studio").projects).toBeNull();
  });

  it("nextPlan walks the ladder and stops at the ceiling", () => {
    expect(nextPlan("free")!.id).toBe("pro");
    expect(nextPlan("pro")!.id).toBe("studio");
    expect(nextPlan("studio")).toBeNull();
    expect(nextPlan("garbage")!.id).toBe("pro"); // garbage -> free -> pro
  });

  it("comparePlans orders the ladder", () => {
    expect(comparePlans("free", "pro")).toBe(-1);
    expect(comparePlans("studio", "free")).toBe(1);
    expect(comparePlans("pro", "pro")).toBe(0);
  });

  it("formatPrice is exact for annual monthly prices", () => {
    expect(formatPrice(12)).toBe("$12");
    expect(formatPrice(0)).toBe("$0");
    expect(formatPrice(10)).toBe("$10");
    expect(formatPrice(monthlyPrice(PLANS.pro, "year"))).toBe("$10"); // 120/12
    expect(formatPrice(monthlyPrice(PLANS.studio, "year"))).toBe("$24.17");
  });
});
