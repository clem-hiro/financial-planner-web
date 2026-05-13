import { num } from "@/data/mappers";
import type { InvestmentRow } from "@/data/supabase/types";
import { contributionMonthsLimitFromInvestmentRow } from "./investment-contribution";
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
    return (
      sum +
      projectFutureValue({
        currentValue: num(row.current_value),
        monthlyContribution: num(row.monthly_contribution),
        annualReturn: num(row.expected_annual_return),
        months,
        contributionMonthsLimit: lim,
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

  const fvAtMax = futureValueInvestmentPortfolioAtMonth(
    rows,
    MAX_PROJECTION_MONTHS,
    monthsToRetirementFromNow
  );
  if (fvAtMax < targetAmount) {
    return null;
  }

  let low = 0;
  let high = MAX_PROJECTION_MONTHS;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const fv = futureValueInvestmentPortfolioAtMonth(
      rows,
      mid,
      monthsToRetirementFromNow
    );
    if (fv >= targetAmount) {
      high = mid;
    } else {
      low = mid + 1;
    }
  }

  return { months: low };
}
