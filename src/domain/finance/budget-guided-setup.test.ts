import { describe, expect, it } from "vitest";
import {
  generateGuidedMonthlyBudgetLines,
  isPreservedOnGuidedBudgetReplace,
  listOnboardingLifestylePresets,
  resolveActiveRecommendationSignals,
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

describe("isPreservedOnGuidedBudgetReplace", () => {
  it("preserves debt and income tax categories", () => {
    expect(isPreservedOnGuidedBudgetReplace("housing")).toBe(false);
    expect(
      isPreservedOnGuidedBudgetReplace("debt repayments — car loan")
    ).toBe(true);
    expect(isPreservedOnGuidedBudgetReplace("Income tax (GIRO)")).toBe(true);
  });
});

describe("listOnboardingLifestylePresets", () => {
  it("returns six generic presets by default", () => {
    expect(listOnboardingLifestylePresets(null)).toHaveLength(6);
    expect(listOnboardingLifestylePresets("young_professional")[0]?.label).toBe(
      "Balanced starter"
    );
  });

  it("prepends a legacy saved preset when outside the onboarding subset", () => {
    const opts = listOnboardingLifestylePresets("business_owner");
    expect(opts).toHaveLength(7);
    expect(opts[0]?.id).toBe("business_owner");
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

describe("resolveActiveRecommendationSignals", () => {
  it("lists income, lifestyle, and style when income is set", () => {
    expect(
      resolveActiveRecommendationSignals({
        monthlyIncome: 5000,
        foodSpendBand: "unknown",
      })
    ).toEqual([
      "income",
      "lifestyle_profile",
      "money_management_style",
    ]);
  });

  it("includes food spend only for a concrete band", () => {
    expect(
      resolveActiveRecommendationSignals({
        monthlyIncome: 5000,
        foodSpendBand: "range_300_600",
      })
    ).toContain("food_spend");
  });
});
