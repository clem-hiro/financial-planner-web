import { isMonthlyBudgetLineApplicable, normalizeCategory } from "./budget";

/** Budget line rows (DB shape) for lock logic. */
export type BudgetLineForExpenseLock = {
  cadence: string;
  category: string;
  start_year_month?: string | null;
  end_year_month?: string | null;
};

export type ExpenseForLock = {
  id: string;
  category: string;
  spend_period?: string | null;
};

/**
 * Normalized category keys that have an active monthly budget line in `yearMonth`.
 */
export function activeMonthlyBudgetCategoryKeys(
  lines: BudgetLineForExpenseLock[],
  yearMonth: string
): Set<string> {
  const keys = new Set<string>();
  for (const line of lines) {
    if (line.cadence !== "monthly") continue;
    if (
      !isMonthlyBudgetLineApplicable(
        yearMonth,
        line.start_year_month ?? null,
        line.end_year_month ?? null
      )
    ) {
      continue;
    }
    keys.add(normalizeCategory(line.category));
  }
  return keys;
}

/**
 * Monthly expenses in the month that match a budget-tracked category key.
 */
export function monthlyExpensesForBudgetCategory<T extends ExpenseForLock>(
  expenses: T[],
  budgetCategoryKey: string
): T[] {
  return expenses.filter(
    (e) =>
      (e.spend_period ?? "monthly") === "monthly" &&
      normalizeCategory(e.category) === budgetCategoryKey
  );
}

export function yearMonthFromISODate(spentAt: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(spentAt)) return null;
  return spentAt.slice(0, 7);
}
