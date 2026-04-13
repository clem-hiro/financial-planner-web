import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeCategory } from "@/domain/finance/budget";
import type { BudgetLineForExpenseLock } from "@/domain/finance/expense-budget-lock";
import {
  activeMonthlyBudgetCategoryKeys,
  monthlyExpensesForBudgetCategory,
  yearMonthFromISODate,
} from "@/domain/finance/expense-budget-lock";
import { listBudgetLines } from "@/data/repositories/budget-lines";
import { listExpensesForMonth } from "@/data/repositories/expenses";

type ProposedExpense = {
  spent_at: string;
  category: string;
  spend_period: "monthly" | "annual";
};

/**
 * True if inserting/updating to `proposed` would create a second monthly expense
 * for the same budget category in the same calendar month (tracked categories only).
 */
export async function hasBudgetCategoryMonthlyConflict(
  supabase: SupabaseClient,
  userId: string,
  proposed: ProposedExpense,
  excludeExpenseId?: string
): Promise<boolean> {
  if (proposed.spend_period !== "monthly") return false;

  const yearMonth = yearMonthFromISODate(proposed.spent_at);
  if (!yearMonth) return false;

  const [lines, monthExpenses] = await Promise.all([
    listBudgetLines(supabase, userId),
    listExpensesForMonth(supabase, userId, yearMonth),
  ]);

  const budgetKeys = activeMonthlyBudgetCategoryKeys(
    lines as BudgetLineForExpenseLock[],
    yearMonth
  );
  const key = normalizeCategory(proposed.category);
  if (!budgetKeys.has(key)) return false;

  const matches = monthlyExpensesForBudgetCategory(monthExpenses, key).filter(
    (e) => e.id !== excludeExpenseId
  );
  return matches.length > 0;
}
