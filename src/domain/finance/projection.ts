import type {
  Money,
  ProjectFutureValueParams,
  TimeToGoalParams,
  TimeToGoalResult,
} from "./types";

const MAX_PROJECTION_MONTHS = 12 * 150;

/**
 * Future value with lump sum + end-of-month contributions.
 * When annualReturn is 0, FV = PV + PMT * n.
 */
export function projectFutureValue(params: ProjectFutureValueParams): Money {
  const { currentValue, monthlyContribution, annualReturn, months } = params;
  if (months <= 0) return currentValue;
  const n = months;
  const r = annualReturn / 12;
  if (r === 0) {
    return currentValue + monthlyContribution * n;
  }
  const growth = (1 + r) ** n;
  return currentValue * growth + monthlyContribution * ((growth - 1) / r);
}

/**
 * Binary search for smallest month count such that FV >= target.
 * Returns { months: 0 } if already at/above target.
 * Returns null if target cannot be reached within MAX_PROJECTION_MONTHS.
 */
export function calculateTimeToGoal(
  params: TimeToGoalParams
): TimeToGoalResult | null {
  const { currentValue, monthlyContribution, annualReturn, targetAmount } =
    params;

  if (targetAmount <= currentValue) {
    return { months: 0 };
  }

  const fvAtMax = projectFutureValue({
    currentValue,
    monthlyContribution,
    annualReturn,
    months: MAX_PROJECTION_MONTHS,
  });
  if (fvAtMax < targetAmount) {
    return null;
  }

  let low = 0;
  let high = MAX_PROJECTION_MONTHS;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const fv = projectFutureValue({
      currentValue,
      monthlyContribution,
      annualReturn,
      months: mid,
    });
    if (fv >= targetAmount) {
      high = mid;
    } else {
      low = mid + 1;
    }
  }

  return { months: low };
}
