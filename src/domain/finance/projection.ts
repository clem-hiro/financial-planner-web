import type {
  Money,
  ProjectFutureValueParams,
  TimeToGoalParams,
  TimeToGoalResult,
} from "./types";

const MAX_PROJECTION_MONTHS = 12 * 150;

function futureValueEndOfMonthWindow(
  currentValue: Money,
  monthlyContribution: Money,
  annualReturn: number,
  months: number
): Money {
  const n = Math.max(0, Math.floor(months));
  if (n <= 0) return currentValue;
  const r = annualReturn / 12;
  if (r === 0) {
    return currentValue + monthlyContribution * n;
  }
  const growth = (1 + r) ** n;
  return currentValue * growth + monthlyContribution * ((growth - 1) / r);
}

/**
 * Future value with lump sum + end-of-month contributions for an initial window,
 * then growth only (same rate) for any remaining months.
 * When annualReturn is 0, FV = PV + PMT * n over the contribution window, then add 0.
 */
export function projectFutureValue(params: ProjectFutureValueParams): Money {
  const { currentValue, monthlyContribution, annualReturn, months } = params;
  const n = Math.max(0, Math.floor(months));
  if (n <= 0) return currentValue;

  let contributionWindow = n;
  if (
    params.contributionMonthsLimit != null &&
    Number.isFinite(params.contributionMonthsLimit)
  ) {
    contributionWindow = Math.max(
      0,
      Math.min(n, Math.floor(params.contributionMonthsLimit))
    );
  }

  if (contributionWindow >= n) {
    return futureValueEndOfMonthWindow(
      currentValue,
      monthlyContribution,
      annualReturn,
      n
    );
  }

  const mid = futureValueEndOfMonthWindow(
    currentValue,
    monthlyContribution,
    annualReturn,
    contributionWindow
  );
  return futureValueEndOfMonthWindow(mid, 0, annualReturn, n - contributionWindow);
}

/**
 * Binary search for smallest month count such that FV >= target.
 * Returns { months: 0 } if already at/above target.
 * Returns null if target cannot be reached within MAX_PROJECTION_MONTHS.
 */
export function calculateTimeToGoal(
  params: TimeToGoalParams
): TimeToGoalResult | null {
  const {
    currentValue,
    monthlyContribution,
    annualReturn,
    targetAmount,
    contributionMonthsLimit,
  } = params;

  if (targetAmount <= currentValue) {
    return { months: 0 };
  }

  const fvAtMax = projectFutureValue({
    currentValue,
    monthlyContribution,
    annualReturn,
    months: MAX_PROJECTION_MONTHS,
    contributionMonthsLimit,
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
      contributionMonthsLimit,
    });
    if (fv >= targetAmount) {
      high = mid;
    } else {
      low = mid + 1;
    }
  }

  return { months: low };
}
