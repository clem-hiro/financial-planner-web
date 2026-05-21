import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  analyzeGoalPriorityTradeoff,
  type GoalPriorityTradeoffAnalysis,
  sortGoalsByPriority,
} from "@/domain/finance/goal-priority-tradeoff";
import { monthlyBudgetVsActual } from "@/domain/finance";
import {
  budgetLineRowToDomain,
  expenseRowToBudgetExpense,
  num,
  profileSalaryTakeHomeMonthly,
  sumExpenseAmounts,
} from "@/data/mappers";
import {
  listBudgetLineOverridesForMonth,
  overridesToLineIdMap,
} from "@/data/repositories/budget-line-overrides";
import { listBudgetLines } from "@/data/repositories/budget-lines";
import { listExpensesForMonth } from "@/data/repositories/expenses";
import { listFinancialGoals } from "@/data/repositories/goals";
import { getProfileById } from "@/data/repositories/profiles";
import { buildSyntheticTaxExpense } from "@/data/income-tax-synthetic-expense";
import { buildSyntheticHousingCashExpense } from "@/data/housing-cash-synthetic-expense";
import { getIncomeTaxConfig } from "@/data/repositories/income-tax-configs";
import { listHousingLoans } from "@/data/repositories/housing-loans";
import { formatYearMonth } from "@/lib/dates";

export type GoalTradeoffContext = {
  yearMonth: string;
  analysis: GoalPriorityTradeoffAnalysis;
};

/** Current-month surplus basis for goal priority trade-off (mirrors dashboard spend rules). */
export async function loadGoalTradeoffContext(
  supabase: SupabaseClient,
  userId: string
): Promise<GoalTradeoffContext | null> {
  const yearMonth = formatYearMonth(new Date());
  const [profile, goals, expenses, budgetLineRows, overrideRows, housingLoans, incomeTaxConfig] =
    await Promise.all([
      getProfileById(supabase, userId),
      listFinancialGoals(supabase, userId),
      listExpensesForMonth(supabase, userId, yearMonth),
      listBudgetLines(supabase, userId),
      listBudgetLineOverridesForMonth(supabase, userId, yearMonth),
      listHousingLoans(supabase, userId),
      getIncomeTaxConfig(supabase, userId),
    ]);

  if (goals.length === 0) return null;

  const syntheticTax = buildSyntheticTaxExpense(
    incomeTaxConfig,
    profile,
    yearMonth
  );
  const syntheticHousing = buildSyntheticHousingCashExpense(
    housingLoans,
    yearMonth
  );
  const budgetExpenses = [
    ...(syntheticTax ? [syntheticTax.expense] : []),
    ...(syntheticHousing ? [syntheticHousing.expense] : []),
    ...expenses.map(expenseRowToBudgetExpense),
  ];
  const domainBudgetLines = budgetLineRows.map(budgetLineRowToDomain);
  const amountOverrideByLineId = overridesToLineIdMap(overrideRows);
  const monthlyBudget = monthlyBudgetVsActual(domainBudgetLines, budgetExpenses, {
    viewingYearMonth: yearMonth,
    amountOverrideByLineId,
  });
  const monthlyExpensesLoggedTotal = sumExpenseAmounts(expenses);
  const monthlyPlannedMonthlyBudgetTotal = monthlyBudget.totals.budget;
  const monthlyExpensesTotal =
    monthlyExpensesLoggedTotal > 0
      ? monthlyExpensesLoggedTotal
      : monthlyPlannedMonthlyBudgetTotal;

  const takeHomeMonthly = profileSalaryTakeHomeMonthly(profile, yearMonth);
  const sorted = sortGoalsByPriority(goals);

  const analysis = analyzeGoalPriorityTradeoff({
    takeHomeMonthly,
    monthlyExpensesTotal,
    goals: sorted.map((g) => ({
      id: g.id,
      title: g.title,
      display_order: g.display_order,
      monthly_contribution: num(g.monthly_contribution),
    })),
  });

  return { yearMonth, analysis };
}
