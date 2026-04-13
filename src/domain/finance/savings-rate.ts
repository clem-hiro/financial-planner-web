import type { SavingsRateInput } from "./types";

/**
 * Returns fraction of income saved (0–1+). Null if income is missing or non-positive.
 */
export function calculateSavingsRate(input: SavingsRateInput): number | null {
  const { monthlyIncome, monthlyExpenses } = input;
  if (monthlyIncome <= 0) return null;
  const rate = (monthlyIncome - monthlyExpenses) / monthlyIncome;
  return rate;
}
