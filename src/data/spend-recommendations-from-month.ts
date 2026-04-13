import type { BudgetLineRow, ExpenseRow, ProfileRow } from "@/data/supabase/types";
import {
  monthlyBudgetAggregateOverspend,
  monthlyBudgetVsActual,
  topOverBudgetCategories,
} from "@/domain/finance/budget";
import { buildSpendRecommendationsForMonth } from "@/domain/finance/spend-recommendations";
import { calculateSavingsRate } from "@/domain/finance/savings-rate";
import {
  budgetLineRowToDomain,
  expenseRowToBudgetExpense,
  profileMonthlyIncome,
  sumExpenseAmounts,
} from "@/data/mappers";

/**
 * Builds spend guidance for a calendar month from raw rows (budget + expenses + profile).
 */
export function spendRecommendationsForUserMonth(params: {
  expenses: ExpenseRow[];
  budgetLineRows: BudgetLineRow[];
  overrideByLineId: Record<string, number>;
  yearMonth: string;
  profile: ProfileRow | null;
  /** Sum of planned monthly goal contributions; aligns with dashboard savings rate. */
  monthlyPlannedGoalContributions?: number;
}): string[] {
  const monthlyTakeHome = profileMonthlyIncome(params.profile);
  const monthlyExpensesTotal = sumExpenseAmounts(params.expenses);
  const goalTotal = Math.max(0, params.monthlyPlannedGoalContributions ?? 0);
  const savingsRate =
    monthlyTakeHome != null && monthlyTakeHome > 0
      ? calculateSavingsRate({
          monthlyIncome: monthlyTakeHome,
          monthlyExpenses: monthlyExpensesTotal,
          monthlyPlannedGoalContributions: goalTotal,
        })
      : null;

  const domainLines = params.budgetLineRows.map(budgetLineRowToDomain);
  const budgetExpenses = params.expenses.map(expenseRowToBudgetExpense);
  const monthly = monthlyBudgetVsActual(domainLines, budgetExpenses, {
    viewingYearMonth: params.yearMonth,
    amountOverrideByLineId: params.overrideByLineId,
  });
  const budgetAggregate = monthlyBudgetAggregateOverspend(monthly.totals);
  const topOver = topOverBudgetCategories(monthly, 3).map((v) => ({
    categoryLabel: v.categoryLabel,
    overBy: v.spent - v.budget,
  }));

  return buildSpendRecommendationsForMonth({
    monthlyTakeHome,
    monthlyExpensesTotal,
    savingsRate,
    monthlyPlannedGoalContributions: goalTotal,
    budgetAggregate,
    topOverBudget: topOver,
  });
}
