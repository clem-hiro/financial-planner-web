import { describe, expect, it } from "vitest";
import {
  applySetupInvestmentsToMonthlyBudgetResult,
  buildSetupInvestmentsBudgetLine,
  computeBudgetCashFlowAllocation,
  isInvestmentContributionActiveInYearMonth,
  sumPlannedMonthlyInvestmentContributions,
} from "./budget-cash-flow-allocation";
import type { InvestmentRow } from "@/data/supabase/types";

function inv(
  partial: Partial<InvestmentRow> & Pick<InvestmentRow, "monthly_contribution">
): InvestmentRow {
  return {
    id: "1",
    user_id: "u",
    name: "Test",
    current_value: "0",
    expected_annual_return: "0.05",
    contribution_type: null,
    contribution_duration_years: null,
    contribution_growth_annual: "0",
    withdrawal_monthly: "0",
    withdrawal_start_years: null,
    plan_nature: null,
    created_at: "",
    updated_at: "",
    ...partial,
  } as InvestmentRow;
}

describe("isInvestmentContributionActiveInYearMonth", () => {
  it("respects contribution start and end calendar months", () => {
    const row = inv({
      monthly_contribution: "200",
      contribution_start_date: "2026-06-01",
      contribution_end_date: "2026-08-31",
    });
    expect(isInvestmentContributionActiveInYearMonth(row, "2026-05")).toBe(
      false
    );
    expect(isInvestmentContributionActiveInYearMonth(row, "2026-06")).toBe(
      true
    );
    expect(isInvestmentContributionActiveInYearMonth(row, "2026-09")).toBe(
      false
    );
  });

  it("counts open-ended contributions when amount is positive", () => {
    const row = inv({ monthly_contribution: "100" });
    expect(isInvestmentContributionActiveInYearMonth(row, "2030-01")).toBe(
      true
    );
  });
});

describe("sumPlannedMonthlyInvestmentContributions", () => {
  it("sums only active rows for the month", () => {
    const total = sumPlannedMonthlyInvestmentContributions(
      [
        inv({ monthly_contribution: "300" }),
        inv({
          monthly_contribution: "200",
          contribution_end_date: "2026-03-31",
        }),
      ],
      "2026-05"
    );
    expect(total).toBe(300);
  });
});

describe("computeBudgetCashFlowAllocation", () => {
  it("derives free cash flow from future-you lines and unallocated cash", () => {
    const a = computeBudgetCashFlowAllocation({
      takeHome: 5600,
      plannedBudgetTotal: 4726,
      plannedFutureYouBudgetTotal: 660,
      plannedGoalContributions: 500,
      plannedInvestmentContributions: 10,
    });
    expect(a.unallocatedAfterBudget).toBe(874);
    expect(a.freeCashFlow).toBe(1534);
    expect(a.unallocatedAfterCommitments).toBe(1034);
  });

  it("returns null unallocated when take-home is unset", () => {
    const a = computeBudgetCashFlowAllocation({
      takeHome: null,
      plannedBudgetTotal: 4000,
      plannedGoalContributions: 0,
      plannedInvestmentContributions: 0,
    });
    expect(a.unallocatedAfterBudget).toBeNull();
    expect(a.freeCashFlow).toBeNull();
    expect(a.unallocatedAfterCommitments).toBeNull();
  });
});

describe("setup investments budget line", () => {
  it("only creates a synthetic budget line when setup investments are active", () => {
    expect(
      buildSetupInvestmentsBudgetLine({ userId: "u", amount: 0 })
    ).toBeNull();

    const line = buildSetupInvestmentsBudgetLine({ userId: "u", amount: 500 });
    expect(line).toMatchObject({
      user_id: "u",
      category: "Investments",
      cadence: "monthly",
      amount: "500",
    });
  });

  it("replaces manual Investments budget rows with setup contribution totals", () => {
    const adjusted = applySetupInvestmentsToMonthlyBudgetResult(
      {
        lines: [
          {
            categoryLabel: "Dining",
            categoryKey: "dining",
            budget: 300,
            spent: 50,
            remaining: 250,
            over: false,
          },
          {
            categoryLabel: "Investments",
            categoryKey: "investments",
            budget: 10,
            spent: 0,
            remaining: 10,
            over: false,
          },
          {
            categoryLabel: "Savings",
            categoryKey: "savings",
            budget: 650,
            spent: 0,
            remaining: 650,
            over: false,
          },
        ],
        totals: { budget: 960, spent: 50, remaining: 910 },
      },
      500
    );

    expect(adjusted.lines.map((line) => line.categoryLabel)).toEqual([
      "Dining",
      "Savings",
      "Investments",
    ]);
    expect(
      adjusted.lines.find((line) => line.categoryLabel === "Investments")
        ?.budget
    ).toBe(500);
    expect(adjusted.totals).toEqual({
      budget: 1450,
      spent: 50,
      remaining: 1400,
    });
  });

  it("removes manual Investments rows when setup has no active contribution", () => {
    const adjusted = applySetupInvestmentsToMonthlyBudgetResult(
      {
        lines: [
          {
            categoryLabel: "Investments",
            categoryKey: "investments",
            budget: 10,
            spent: 0,
            remaining: 10,
            over: false,
          },
        ],
        totals: { budget: 10, spent: 0, remaining: 10 },
      },
      0
    );

    expect(adjusted.lines).toEqual([]);
    expect(adjusted.totals).toEqual({ budget: 0, spent: 0, remaining: 0 });
  });
});
