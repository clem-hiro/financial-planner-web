import type { BudgetVsActualResult } from "@/domain/finance/budget";

export type IrregularExpenseCadence =
  | "annual"
  | "semi_annual"
  | "quarterly"
  | "monthly_set_aside";

export type IrregularExpenseReserve = {
  categoryLabel: string;
  categoryKey: string;
  annualBudget: number;
  spent: number;
  remaining: number;
  over: boolean;
  monthlySetAside: number;
  remainingMonthsInYear: number;
  reserveNeededPerRemainingMonth: number;
  progressRatio: number;
};

export function irregularCadenceOccurrences(
  cadence: IrregularExpenseCadence
): number {
  switch (cadence) {
    case "quarterly":
      return 4;
    case "semi_annual":
      return 2;
    case "monthly_set_aside":
    case "annual":
      return 1;
  }
}

export function annualAmountFromIrregularInput({
  amount,
  cadence,
}: {
  amount: number;
  cadence: IrregularExpenseCadence;
}): number {
  const safeAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  if (cadence === "monthly_set_aside") return safeAmount * 12;
  return safeAmount * irregularCadenceOccurrences(cadence);
}

export function buildIrregularExpenseReserves({
  annual,
  viewingMonth,
}: {
  annual: BudgetVsActualResult;
  viewingMonth: string;
}): IrregularExpenseReserve[] {
  const monthNumber = Number(viewingMonth.slice(5, 7));
  const remainingMonthsInYear = Math.max(1, 12 - monthNumber + 1);

  return annual.lines.map((line) => {
    const remaining = Math.max(0, line.budget - line.spent);
    return {
      categoryLabel: line.categoryLabel,
      categoryKey: line.categoryKey,
      annualBudget: line.budget,
      spent: line.spent,
      remaining,
      over: line.over,
      monthlySetAside: line.budget / 12,
      remainingMonthsInYear,
      reserveNeededPerRemainingMonth: remaining / remainingMonthsInYear,
      progressRatio: line.budget > 0 ? Math.min(1, line.spent / line.budget) : 0,
    };
  });
}
