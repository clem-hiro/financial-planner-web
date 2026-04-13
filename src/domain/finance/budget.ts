/**
 * Category matching contract: trim + lowercase. Use everywhere budgets meet expenses.
 */
export function normalizeCategory(s: string): string {
  return s.trim().toLowerCase();
}

export type SpendPeriod = "monthly" | "annual";

/** `YYYY-MM` lexicographic order matches chronological order. */
export function isValidYearMonth(s: string): boolean {
  return /^\d{4}-\d{2}$/.test(s);
}

/**
 * Whether a monthly budget line applies in `viewingYearMonth` (inclusive start/end bounds).
 */
export function isMonthlyBudgetLineApplicable(
  viewingYearMonth: string,
  startYearMonth: string | null | undefined,
  endYearMonth: string | null | undefined
): boolean {
  if (startYearMonth != null && startYearMonth !== "") {
    if (viewingYearMonth < startYearMonth) return false;
  }
  if (endYearMonth != null && endYearMonth !== "") {
    if (viewingYearMonth > endYearMonth) return false;
  }
  return true;
}

/** Budget line as used in domain (amounts are major currency units). */
export type BudgetLineForDomain = {
  id?: string;
  category: string;
  cadence: SpendPeriod;
  amount: number;
  calendarYear: number | null;
  /** Monthly lines only: first applicable month (inclusive). */
  startYearMonth?: string | null;
  /** Monthly lines only: last applicable month (inclusive), e.g. loan payoff month. */
  endYearMonth?: string | null;
};

/** Expense row fields needed for variance (already filtered by month or year in data layer). */
export type ExpenseForBudget = {
  category: string;
  amount: number;
  spendPeriod: SpendPeriod;
};

export type BudgetLineVariance = {
  /** Original category string from the budget line (for display). */
  categoryLabel: string;
  categoryKey: string;
  budget: number;
  spent: number;
  remaining: number;
  over: boolean;
};

export type BudgetVsActualTotals = {
  budget: number;
  spent: number;
  remaining: number;
};

export type BudgetVsActualResult = {
  lines: BudgetLineVariance[];
  totals: BudgetVsActualTotals;
};

/** Aggregate across monthly budget lines: spent vs total planned (budgeted categories only). */
export function monthlyBudgetAggregateOverspend(
  totals: BudgetVsActualTotals
): { onTrack: boolean; overBy: number } {
  const overBy = Math.max(0, totals.spent - totals.budget);
  return { onTrack: overBy === 0, overBy };
}

export type MonthlyBudgetVsActualOptions = {
  viewingYearMonth: string;
  /** Effective budget for that line in this month (replaces base `amount` when set). */
  amountOverrideByLineId?: Record<string, number>;
};

function sumSpentByCategory(
  expenses: ExpenseForBudget[],
  spendPeriod: SpendPeriod
): Map<string, number> {
  const map = new Map<string, number>();
  for (const e of expenses) {
    if (e.spendPeriod !== spendPeriod) continue;
    const key = normalizeCategory(e.category);
    map.set(key, (map.get(key) ?? 0) + e.amount);
  }
  return map;
}

/**
 * Monthly cadence budget lines vs expenses in the selected month (pass only monthly spend_period expenses).
 * Lines outside [startYearMonth, endYearMonth] are omitted. Optional per-line amount overrides for this month.
 */
export function monthlyBudgetVsActual(
  budgetLines: BudgetLineForDomain[],
  expensesInMonth: ExpenseForBudget[],
  options: MonthlyBudgetVsActualOptions
): BudgetVsActualResult {
  const { viewingYearMonth, amountOverrideByLineId } = options;
  const spentByCat = sumSpentByCategory(expensesInMonth, "monthly");

  const applicable = budgetLines.filter(
    (l) =>
      l.cadence === "monthly" &&
      isMonthlyBudgetLineApplicable(
        viewingYearMonth,
        l.startYearMonth,
        l.endYearMonth
      )
  );

  const variances: BudgetLineVariance[] = applicable.map((line) => {
    const key = normalizeCategory(line.category);
    const spent = spentByCat.get(key) ?? 0;
    const budget =
      line.id != null &&
      amountOverrideByLineId != null &&
      amountOverrideByLineId[line.id] !== undefined
        ? amountOverrideByLineId[line.id]!
        : line.amount;
    const remaining = budget - spent;
    return {
      categoryLabel: line.category.trim() || line.category,
      categoryKey: key,
      budget,
      spent,
      remaining,
      over: spent > budget,
    };
  });

  const totals = variances.reduce(
    (acc, v) => ({
      budget: acc.budget + v.budget,
      spent: acc.spent + v.spent,
      remaining: acc.remaining + v.remaining,
    }),
    { budget: 0, spent: 0, remaining: 0 }
  );

  return { lines: variances, totals };
}

/**
 * Annual cadence lines for a given calendar year vs annual expenses in that year.
 */
export function annualBudgetVsActual(
  budgetLines: BudgetLineForDomain[],
  expensesInYear: ExpenseForBudget[],
  calendarYear: number
): BudgetVsActualResult {
  const lines = budgetLines.filter(
    (l) => l.cadence === "annual" && l.calendarYear === calendarYear
  );
  const spentByCat = sumSpentByCategory(expensesInYear, "annual");

  const variances: BudgetLineVariance[] = lines.map((line) => {
    const key = normalizeCategory(line.category);
    const spent = spentByCat.get(key) ?? 0;
    const budget = line.amount;
    const remaining = budget - spent;
    return {
      categoryLabel: line.category.trim() || line.category,
      categoryKey: key,
      budget,
      spent,
      remaining,
      over: spent > budget,
    };
  });

  const totals = variances.reduce(
    (acc, v) => ({
      budget: acc.budget + v.budget,
      spent: acc.spent + v.spent,
      remaining: acc.remaining + v.remaining,
    }),
    { budget: 0, spent: 0, remaining: 0 }
  );

  return { lines: variances, totals };
}

/** Top N categories over budget (spent > budget), sorted by overspend amount descending. */
export function topOverBudgetCategories(
  result: BudgetVsActualResult,
  limit: number
): BudgetLineVariance[] {
  return result.lines
    .filter((l) => l.over)
    .sort((a, b) => b.spent - b.budget - (a.spent - a.budget))
    .slice(0, limit);
}
