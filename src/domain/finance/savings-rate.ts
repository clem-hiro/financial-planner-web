import type { SavingsRateInput } from "./types";

/**
 * Returns fraction of take-home left after expenses and optional planned goal
 * contributions: (income − expenses − goals) / income. Null if income is missing or non-positive.
 */
export function calculateSavingsRate(input: SavingsRateInput): number | null {
  const { monthlyIncome, monthlyExpenses, monthlyPlannedGoalContributions = 0 } =
    input;
  if (monthlyIncome <= 0) return null;
  const goals = Math.max(0, monthlyPlannedGoalContributions);
  const rate = (monthlyIncome - monthlyExpenses - goals) / monthlyIncome;
  return rate;
}
