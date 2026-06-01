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

function hasVariableCashflows(params: ProjectFutureValueParams): boolean {
  return (
    (params.contributionGrowthAnnual != null &&
      Number.isFinite(params.contributionGrowthAnnual) &&
      params.contributionGrowthAnnual !== 0) ||
    (params.monthlyWithdrawal != null &&
      Number.isFinite(params.monthlyWithdrawal) &&
      params.monthlyWithdrawal > 0)
  );
}

function monthlyContributionForMonth(
  baseContribution: Money,
  contributionGrowthAnnual: number,
  monthIndex: number
): Money {
  const yearsElapsed = Math.floor(Math.max(0, monthIndex) / 12);
  return baseContribution * (1 + contributionGrowthAnnual) ** yearsElapsed;
}

function projectFutureValueIterative(params: ProjectFutureValueParams): Money {
  const n = Math.max(0, Math.floor(params.months));
  if (n <= 0) return params.currentValue;

  const r = params.annualReturn / 12;
  const contributionGrowthAnnual = Math.max(
    -0.99,
    Math.min(1, params.contributionGrowthAnnual ?? 0)
  );
  const contributionMonthsLimit =
    params.contributionMonthsLimit != null &&
    Number.isFinite(params.contributionMonthsLimit)
      ? Math.max(0, Math.floor(params.contributionMonthsLimit))
      : n;
  const contributionStartMonth =
    params.contributionStartMonth != null &&
    Number.isFinite(params.contributionStartMonth)
      ? Math.max(0, Math.floor(params.contributionStartMonth))
      : 0;
  const monthlyWithdrawal = Math.max(0, params.monthlyWithdrawal ?? 0);
  const withdrawalStartMonth =
    params.withdrawalStartMonth != null &&
    Number.isFinite(params.withdrawalStartMonth)
      ? Math.max(0, Math.floor(params.withdrawalStartMonth))
      : Number.POSITIVE_INFINITY;

  let value = params.currentValue;
  for (let monthIndex = 0; monthIndex < n; monthIndex++) {
    value *= 1 + r;
    if (
      monthIndex >= contributionStartMonth &&
      monthIndex < contributionMonthsLimit
    ) {
      value += monthlyContributionForMonth(
        params.monthlyContribution,
        contributionGrowthAnnual,
        monthIndex
      );
    }
    if (monthIndex >= withdrawalStartMonth) {
      value -= monthlyWithdrawal;
    }
    value = Math.max(0, value);
  }
  return value;
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

  if (hasVariableCashflows(params)) {
    return projectFutureValueIterative(params);
  }

  const contributionStartMonth =
    params.contributionStartMonth != null &&
    Number.isFinite(params.contributionStartMonth)
      ? Math.max(0, Math.floor(params.contributionStartMonth))
      : 0;

  let contributionEndMonth = n;
  if (
    params.contributionMonthsLimit != null &&
    Number.isFinite(params.contributionMonthsLimit)
  ) {
    contributionEndMonth = Math.max(
      0,
      Math.min(n, Math.floor(params.contributionMonthsLimit))
    );
  }

  const contributionMonths = Math.max(
    0,
    contributionEndMonth - contributionStartMonth
  );

  if (contributionStartMonth === 0 && contributionEndMonth >= n) {
    return futureValueEndOfMonthWindow(
      currentValue,
      monthlyContribution,
      annualReturn,
      n
    );
  }

  let value = currentValue;
  if (contributionStartMonth > 0) {
    value = futureValueEndOfMonthWindow(
      value,
      0,
      annualReturn,
      Math.min(contributionStartMonth, n)
    );
  }
  const afterStart = Math.max(0, n - contributionStartMonth);
  if (contributionMonths > 0 && afterStart > 0) {
    const contribSpan = Math.min(contributionMonths, afterStart);
    value = futureValueEndOfMonthWindow(
      value,
      monthlyContribution,
      annualReturn,
      contribSpan
    );
    const tail = afterStart - contribSpan;
    if (tail > 0) {
      value = futureValueEndOfMonthWindow(value, 0, annualReturn, tail);
    }
  } else if (afterStart > 0) {
    value = futureValueEndOfMonthWindow(value, 0, annualReturn, afterStart);
  }
  return value;
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

  if (hasVariableCashflows({ ...params, months: MAX_PROJECTION_MONTHS })) {
    for (let months = 1; months <= MAX_PROJECTION_MONTHS; months++) {
      const fv = projectFutureValue({ ...params, months });
      if (fv >= targetAmount) return { months };
    }
    return null;
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
