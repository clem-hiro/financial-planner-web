import { describe, expect, it } from "vitest";
import {
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
  it("derives unallocated after budget and after other commitments", () => {
    const a = computeBudgetCashFlowAllocation({
      takeHome: 5600,
      plannedBudgetTotal: 4000,
      plannedGoalContributions: 500,
      plannedInvestmentContributions: 300,
    });
    expect(a.unallocatedAfterBudget).toBe(1600);
    expect(a.unallocatedAfterCommitments).toBe(800);
  });

  it("returns null unallocated when take-home is unset", () => {
    const a = computeBudgetCashFlowAllocation({
      takeHome: null,
      plannedBudgetTotal: 4000,
      plannedGoalContributions: 0,
      plannedInvestmentContributions: 0,
    });
    expect(a.unallocatedAfterBudget).toBeNull();
    expect(a.unallocatedAfterCommitments).toBeNull();
  });
});
