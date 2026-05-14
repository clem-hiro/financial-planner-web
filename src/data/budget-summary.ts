import type { SupabaseClient } from "@supabase/supabase-js";
import {
  annualBudgetVsActual,
  isMonthlyBudgetLineApplicable,
  monthlyBudgetVsActual,
  normalizeCategory,
  type BudgetVsActualResult,
} from "@/domain/finance/budget";
import type { BudgetLineRow, ExpenseRow } from "@/data/supabase/types";
import {
  budgetLineRowToDomain,
  expenseRowToBudgetExpense,
} from "@/data/mappers";
import {
  listBudgetLineOverridesForMonth,
  overridesToLineIdMap,
} from "@/data/repositories/budget-line-overrides";
import { listBudgetLines } from "@/data/repositories/budget-lines";
import {
  listExpensesForMonth,
  listExpensesForYear,
} from "@/data/repositories/expenses";
import { getIncomeTaxConfig } from "@/data/repositories/income-tax-configs";
import { getProfileById } from "@/data/repositories/profiles";
import { buildSyntheticTaxExpense } from "@/data/income-tax-synthetic-expense";

export type BudgetPageModel = {
  yearMonth: string;
  calendarYear: number;
  monthly: BudgetVsActualResult;
  annual: BudgetVsActualResult;
  lineRows: BudgetLineRow[];
  /** Effective budget overrides for `yearMonth`, keyed by budget line id. */
  overridesThisMonth: Record<string, number>;
  /** Monthly spend_period expenses in `yearMonth` with no matching active monthly budget line. */
  unbudgetedMonthlyExpenses: ExpenseRow[];
  /** All expense rows in `yearMonth` (for edit/lock UI on budget page). */
  monthExpenses: ExpenseRow[];
};

export async function getBudgetPageModel(
  supabase: SupabaseClient,
  userId: string,
  yearMonth: string,
  calendarYear: number
): Promise<BudgetPageModel> {
  const [
    lines,
    monthExpenses,
    yearExpenses,
    overrideRows,
    incomeTaxConfig,
    profile,
  ] = await Promise.all([
    listBudgetLines(supabase, userId),
    listExpensesForMonth(supabase, userId, yearMonth),
    listExpensesForYear(supabase, userId, calendarYear),
    listBudgetLineOverridesForMonth(supabase, userId, yearMonth),
    getIncomeTaxConfig(supabase, userId),
    getProfileById(supabase, userId),
  ]);

  const amountOverrideByLineId = overridesToLineIdMap(overrideRows);
  const domainLines = lines.map(budgetLineRowToDomain);
  const baseMonthlyExp = monthExpenses.map(expenseRowToBudgetExpense);
  const baseAnnualExp = yearExpenses.map(expenseRowToBudgetExpense);

  // Synthetic tax line flows into whichever cadence matches `payment_method`;
  // never bleeds into `unbudgetedMonthlyExpenses` (which only filters real rows).
  const syntheticTax = buildSyntheticTaxExpense(
    incomeTaxConfig,
    profile,
    yearMonth
  );
  const monthlyExp =
    syntheticTax && syntheticTax.expense.spendPeriod === "monthly"
      ? [syntheticTax.expense, ...baseMonthlyExp]
      : baseMonthlyExp;
  const annualExp =
    syntheticTax && syntheticTax.expense.spendPeriod === "annual"
      ? [syntheticTax.expense, ...baseAnnualExp]
      : baseAnnualExp;

  const activeMonthlyCategoryKeys = new Set<string>();
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
    activeMonthlyCategoryKeys.add(normalizeCategory(line.category));
  }
  const unbudgetedMonthlyExpenses = monthExpenses.filter((e) => {
    if ((e.spend_period ?? "monthly") !== "monthly") return false;
    return !activeMonthlyCategoryKeys.has(normalizeCategory(e.category));
  });

  return {
    yearMonth,
    calendarYear,
    monthly: monthlyBudgetVsActual(domainLines, monthlyExp, {
      viewingYearMonth: yearMonth,
      amountOverrideByLineId,
    }),
    annual: annualBudgetVsActual(domainLines, annualExp, calendarYear),
    lineRows: lines,
    overridesThisMonth: amountOverrideByLineId,
    unbudgetedMonthlyExpenses,
    monthExpenses: monthExpenses,
  };
}
