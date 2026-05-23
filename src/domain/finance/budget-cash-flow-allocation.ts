import { num } from "@/data/mappers";
import type { InvestmentRow } from "@/data/supabase/types";
import { formatYearMonth } from "@/lib/dates";
import { parseIsoDateOnly } from "./investment-contribution-dates";

/** Compare two `YYYY-MM` strings (negative if a < b). */
export function yearMonthCompare(a: string, b: string): number {
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  if (ay !== by) return ay - by;
  return am - bm;
}

export function isInvestmentContributionActiveInYearMonth(
  row: Pick<
    InvestmentRow,
    "monthly_contribution" | "contribution_start_date" | "contribution_end_date"
  >,
  yearMonth: string
): boolean {
  if (num(row.monthly_contribution) <= 0) return false;

  const start = row.contribution_start_date;
  if (start?.trim()) {
    const d = parseIsoDateOnly(start);
    if (d && yearMonthCompare(yearMonth, formatYearMonth(d)) < 0) {
      return false;
    }
  }

  const end = row.contribution_end_date;
  if (end?.trim()) {
    const d = parseIsoDateOnly(end);
    if (d && yearMonthCompare(yearMonth, formatYearMonth(d)) > 0) {
      return false;
    }
  }

  return true;
}

/** Sum of positive `monthly_contribution` on investments active in `yearMonth`. */
export function sumPlannedMonthlyInvestmentContributions(
  rows: InvestmentRow[],
  yearMonth: string
): number {
  return rows.reduce((sum, row) => {
    if (!isInvestmentContributionActiveInYearMonth(row, yearMonth)) {
      return sum;
    }
    return sum + Math.max(0, num(row.monthly_contribution));
  }, 0);
}

export type BudgetCashFlowAllocation = {
  takeHome: number | null;
  plannedBudgetTotal: number;
  /** `takeHome − plannedBudgetTotal`; null when take-home is unset. */
  unallocatedAfterBudget: number | null;
  plannedGoalContributions: number;
  plannedInvestmentContributions: number;
  /**
   * `takeHome − plannedBudget − goal contributions − investment contributions`;
   * null when take-home is unset.
   */
  unallocatedAfterCommitments: number | null;
};

export function computeBudgetCashFlowAllocation(params: {
  takeHome: number | null;
  plannedBudgetTotal: number;
  plannedGoalContributions: number;
  plannedInvestmentContributions: number;
}): BudgetCashFlowAllocation {
  const {
    takeHome,
    plannedBudgetTotal,
    plannedGoalContributions,
    plannedInvestmentContributions,
  } = params;
  const goals = Math.max(0, plannedGoalContributions);
  const investments = Math.max(0, plannedInvestmentContributions);

  return {
    takeHome,
    plannedBudgetTotal,
    unallocatedAfterBudget:
      takeHome != null ? takeHome - plannedBudgetTotal : null,
    plannedGoalContributions: goals,
    plannedInvestmentContributions: investments,
    unallocatedAfterCommitments:
      takeHome != null
        ? takeHome - plannedBudgetTotal - goals - investments
        : null,
  };
}
