import { describe, expect, it } from "vitest";
import {
  cashFlowSetupGaps,
  shouldShowCashFlowSetupGuidance,
} from "@/domain/finance/cash-flow-setup-guidance";
import type { ProfileRow } from "@/data/supabase/types";

function profile(overrides: Partial<ProfileRow> = {}): ProfileRow {
  return {
    id: "u1",
    monthly_income: "5000",
    base_currency: "SGD",
    lifestyle_profile: "young_professional",
    budgeting_strategy: "balanced",
    ...overrides,
  } as ProfileRow;
}

describe("cashFlowSetupGaps", () => {
  const base = {
    profile: profile(),
    monthlyIncome: 5000,
    activeMonthlyBudgetLineCount: 3,
    pathVariant: "planning" as const,
    month: "2026-05",
    calendarYear: 2026,
  };

  it("returns empty when income and monthly plan exist", () => {
    expect(cashFlowSetupGaps(base)).toEqual([]);
    expect(shouldShowCashFlowSetupGuidance(base)).toBe(false);
  });

  it("flags missing income with planning anchor", () => {
    const gaps = cashFlowSetupGaps({
      ...base,
      profile: profile({
        monthly_income: null,
        lifestyle_profile: null,
        budgeting_strategy: null,
      }),
      monthlyIncome: null,
      activeMonthlyBudgetLineCount: 0,
    });
    expect(gaps.map((g) => g.id)).toEqual(["income", "budget_lines", "budget_lens"]);
    expect(gaps[0]!.ctaHref).toBe("#planning-cashflow-profile");
  });

  it("flags missing budget lines only when income is set", () => {
    const gaps = cashFlowSetupGaps({
      ...base,
      activeMonthlyBudgetLineCount: 0,
    });
    expect(gaps.map((g) => g.id)).toEqual(["budget_lines"]);
  });

  it("uses setup profile path for income on setup variant", () => {
    const gaps = cashFlowSetupGaps({
      ...base,
      profile: profile({ monthly_income: null }),
      monthlyIncome: null,
      pathVariant: "setup",
    });
    expect(gaps[0]!.ctaHref).toContain("tab=profile");
  });
});
