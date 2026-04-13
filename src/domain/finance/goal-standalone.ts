import { calculateTimeToGoal } from "./projection";

export type StandaloneGoalEstimate =
  | { kind: "met" }
  | { kind: "months"; months: number }
  | { kind: "unreachable" };

/**
 * Progress toward target in [0, 1]. Invalid or non-positive target yields 0.
 */
export function goalProgressRatio(
  currentAmount: number,
  targetAmount: number
): number {
  if (!Number.isFinite(currentAmount) || !Number.isFinite(targetAmount)) {
    return 0;
  }
  if (targetAmount <= 0) return 0;
  return Math.min(1, Math.max(0, currentAmount / targetAmount));
}

/**
 * Time-to-goal from goal-specific balance, contribution, and return (same
 * semantics as investments: decimal annual return, e.g. 0.07 = 7%).
 */
export function estimateTimeToGoalStandalone(
  currentAmount: number,
  monthlyContribution: number,
  expectedAnnualReturn: number,
  targetAmount: number
): StandaloneGoalEstimate {
  if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
    return { kind: "unreachable" };
  }
  if (!Number.isFinite(currentAmount) || currentAmount >= targetAmount) {
    return { kind: "met" };
  }
  const mc = Number.isFinite(monthlyContribution)
    ? Math.max(0, monthlyContribution)
    : 0;
  const r = Number.isFinite(expectedAnnualReturn)
    ? Math.max(0, expectedAnnualReturn)
    : 0;

  const result = calculateTimeToGoal({
    currentValue: currentAmount,
    monthlyContribution: mc,
    annualReturn: r,
    targetAmount,
  });
  if (!result) return { kind: "unreachable" };
  if (result.months === 0) return { kind: "met" };
  return { kind: "months", months: result.months };
}
