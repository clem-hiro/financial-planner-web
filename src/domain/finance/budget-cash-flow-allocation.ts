import { num } from "@/data/mappers";
import type { BudgetLineRow, InvestmentRow } from "@/data/supabase/types";
import { formatYearMonth } from "@/lib/dates";
import {
  normalizeCategory,
  type BudgetLineVariance,
  type BudgetVsActualResult,
} from "./budget";
import { parseIsoDateOnly } from "./investment-contribution-dates";

export const SETUP_INVESTMENTS_BUDGET_CATEGORY = "Investments";
export const SETUP_INVESTMENTS_BUDGET_LINE_ID =
  "__setup_investments_budget_line__";

export function isInvestmentBudgetCategory(category: string): boolean {
  return normalizeCategory(category) ===
    normalizeCategory(SETUP_INVESTMENTS_BUDGET_CATEGORY);
}

export function isSetupInvestmentsBudgetLine(lineId: string): boolean {
  return lineId === SETUP_INVESTMENTS_BUDGET_LINE_ID;
}

export function buildSetupInvestmentsBudgetLine(params: {
  userId: string;
  amount: number;
}): BudgetLineRow | null {
  const amount = Math.max(0, params.amount);
  if (amount <= 0) return null;
  return {
    id: SETUP_INVESTMENTS_BUDGET_LINE_ID,
    user_id: params.userId,
    category: SETUP_INVESTMENTS_BUDGET_CATEGORY,
    cadence: "monthly",
    amount: String(amount),
    calendar_year: null,
    start_year_month: null,
    end_year_month: null,
    created_at: "",
    updated_at: "",
    source_liability_id: null,
  };
}

export function applySetupInvestmentsToMonthlyBudgetResult(
  result: BudgetVsActualResult,
  plannedInvestmentContributions: number
): BudgetVsActualResult {
  const investmentRows = result.lines.filter((line) =>
    isInvestmentBudgetCategory(line.categoryLabel)
  );
  const investmentSpent = investmentRows[0]?.spent ?? 0;
  const nextLines: BudgetLineVariance[] = result.lines.filter(
    (line) => !isInvestmentBudgetCategory(line.categoryLabel)
  );
  const investmentBudget = Math.max(0, plannedInvestmentContributions);

  if (investmentBudget > 0) {
    nextLines.push({
      categoryLabel: SETUP_INVESTMENTS_BUDGET_CATEGORY,
      categoryKey: normalizeCategory(SETUP_INVESTMENTS_BUDGET_CATEGORY),
      budget: investmentBudget,
      spent: investmentSpent,
      remaining: investmentBudget - investmentSpent,
      over: investmentSpent > investmentBudget,
    });
  }

  const totals = nextLines.reduce(
    (acc, line) => ({
      budget: acc.budget + line.budget,
      spent: acc.spent + line.spent,
      remaining: acc.remaining + line.remaining,
    }),
    { budget: 0, spent: 0, remaining: 0 }
  );

  return { lines: nextLines, totals };
}

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
  /** Active savings-bucket lines, including the setup-derived Investments line. */
  plannedFutureYouBudgetTotal: number;
  /**
   * `takeHome − plannedBudgetTotal + plannedFutureYouBudgetTotal`;
   * null when take-home is unset.
   */
  freeCashFlow: number | null;
  plannedGoalContributions: number;
  plannedInvestmentContributions: number;
  /**
   * Free cash flow after goal contributions that are not represented as budget lines;
   * null when take-home is unset.
   */
  unallocatedAfterCommitments: number | null;
};

export function computeBudgetCashFlowAllocation(params: {
  takeHome: number | null;
  plannedBudgetTotal: number;
  plannedFutureYouBudgetTotal?: number;
  plannedGoalContributions: number;
  plannedInvestmentContributions: number;
}): BudgetCashFlowAllocation {
  const {
    takeHome,
    plannedBudgetTotal,
    plannedFutureYouBudgetTotal = 0,
    plannedGoalContributions,
    plannedInvestmentContributions,
  } = params;
  const goals = Math.max(0, plannedGoalContributions);
  const investments = Math.max(0, plannedInvestmentContributions);
  const futureYou = Math.max(0, plannedFutureYouBudgetTotal);
  const unallocated =
    takeHome != null ? takeHome - plannedBudgetTotal : null;
  const freeCashFlow =
    unallocated != null ? unallocated + futureYou : null;

  return {
    takeHome,
    plannedBudgetTotal,
    unallocatedAfterBudget: unallocated,
    plannedFutureYouBudgetTotal: futureYou,
    freeCashFlow,
    plannedGoalContributions: goals,
    plannedInvestmentContributions: investments,
    unallocatedAfterCommitments:
      freeCashFlow != null ? freeCashFlow - goals : null,
  };
}
