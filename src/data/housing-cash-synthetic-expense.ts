import type { HousingLoanRow } from "@/data/supabase/types";
import type { ExpenseForBudget } from "@/domain/finance/budget";
import { sumHousingCashInstalmentsForMonth } from "@/domain/finance/housing-loan-payments";

export type SyntheticHousingCashExpense = {
  expense: ExpenseForBudget;
  totalCash: number;
  loanCount: number;
};

/**
 * Synthetic monthly housing cash burden from saved loan amortization schedules.
 * CPF OA portions are excluded (they flow through CPF projection only).
 */
export function buildSyntheticHousingCashExpense(
  loans: HousingLoanRow[],
  yearMonth: string
): SyntheticHousingCashExpense | null {
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) return null;
  if (loans.length === 0) return null;

  const totalCash = sumHousingCashInstalmentsForMonth(loans, yearMonth);
  if (totalCash <= 0) return null;

  const activeCount = loans.filter((loan) => {
    const due = sumHousingCashInstalmentsForMonth([loan], yearMonth);
    return due > 0;
  }).length;

  return {
    expense: {
      category: "Housing loan (cash portion)",
      amount: totalCash,
      spendPeriod: "monthly",
    },
    totalCash,
    loanCount: activeCount,
  };
}
