import { num } from "@/data/mappers";
import type { InvestmentRow } from "@/data/supabase/types";
import {
  annualWithdrawalFromInvestmentRow,
  contributionMonthsLimitFromInvestmentRow,
  contributionStartMonthFromInvestmentRow,
  withdrawalStartMonthFromInvestmentRow,
} from "./investment-contribution";
import { projectFutureValue } from "./projection";

const MAX_PROJECTION_MONTHS = 12 * 150;

/** Sum of per-account future values at `months`, respecting contribution phase caps. */
export function futureValueInvestmentPortfolioAtMonth(
  rows: InvestmentRow[],
  months: number,
  monthsToRetirementFromNow: number | null
): number {
  if (!rows.length) return 0;
  return rows.reduce((sum, row) => {
    const lim = contributionMonthsLimitFromInvestmentRow(
      row,
      monthsToRetirementFromNow
    );
    const contributionStartMonth = contributionStartMonthFromInvestmentRow(row);
    const withdrawalStartMonth = withdrawalStartMonthFromInvestmentRow(
      row,
      monthsToRetirementFromNow
    );
    return (
      sum +
      projectFutureValue({
        currentValue: num(row.current_value),
        monthlyContribution: num(row.monthly_contribution),
        annualReturn: num(row.expected_annual_return),
        months,
        contributionMonthsLimit: lim,
        contributionStartMonth,
        contributionGrowthAnnual: num(row.contribution_growth_annual),
        annualWithdrawal: annualWithdrawalFromInvestmentRow(row),
        withdrawalStartMonth,
      })
    );
  }, 0);
}

/**
 * Smallest month count such that summed portfolio FV ≥ target.
 * Monotonic in months when rates and contributions are non‑negative.
 */
export function calculateTimeToGoalInvestmentPortfolio(
  rows: InvestmentRow[],
  targetAmount: number,
  monthsToRetirementFromNow: number | null
): { months: number } | null {
  const currentValue = futureValueInvestmentPortfolioAtMonth(rows, 0, monthsToRetirementFromNow);
  if (targetAmount <= currentValue) {
    return { months: 0 };
  }

  for (let months = 1; months <= MAX_PROJECTION_MONTHS; months++) {
    const fv = futureValueInvestmentPortfolioAtMonth(
      rows,
      months,
      monthsToRetirementFromNow
    );
    if (fv >= targetAmount) return { months };
  }

  return null;
}
