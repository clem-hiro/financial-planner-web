import { describe, expect, it } from "vitest";
import {
  generateGuidedMonthlyBudgetLines,
  strategyNeedsWantsSavings,
  sumBucketAmounts,
} from "./budget-guided-setup";

describe("strategyNeedsWantsSavings", () => {
  it("sums to 1 for each strategy", () => {
    for (const s of [
      "balanced",
      "aggressive_saver",
      "flexible_lifestyle",
      "custom",
    ] as const) {
      const v = strategyNeedsWantsSavings(s);
      expect(v.needs + v.wants + v.savings).toBeCloseTo(1, 5);
    }
  });
});

describe("generateGuidedMonthlyBudgetLines", () => {
  it("allocates full income across eight starter categories", () => {
    const income = 6000;
    const lines = generateGuidedMonthlyBudgetLines({
      monthlyIncome: income,
      lifestyle: "young_professional",
      strategy: "balanced",
      foodSpendBand: "range_300_600",
    });
    const total = lines.reduce((a, l) => a + l.amount, 0);
    expect(total).toBeCloseTo(income, 0);
    expect(lines.map((l) => l.category).sort()).toContain("food");
  });

  it("respects aggressive saver savings tilt", () => {
    const lines = generateGuidedMonthlyBudgetLines({
      monthlyIncome: 10_000,
      lifestyle: "young_professional",
      strategy: "aggressive_saver",
      foodSpendBand: "unknown",
    });
    const buckets = sumBucketAmounts(lines);
    expect(buckets.savings).toBeGreaterThan(buckets.wants);
  });
});
