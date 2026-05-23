import { projectFutureValue } from "./projection";

export type GoalDeadlineAnalysis =
  | { kind: "no_deadline" }
  | { kind: "met" }
  | { kind: "on_track"; monthsRemaining: number }
  | {
      kind: "short";
      monthsRemaining: number;
      /** Minimum end-of-month contribution needed each period to hit target on time. */
      requiredMonthly: number;
      /** How much to add to the current monthly contribution (same currency units). */
      increaseBy: number;
    }
  | {
      kind: "past_deadline";
      remaining: number;
    }
  | {
      kind: "no_contribution_periods";
      /** Deadline is in the future but no end-of-month deposit falls on/before it. */
    }
  | {
      kind: "cannot_catch_up";
      /** Positive months but target cannot be reached even with unbounded contributions (numerical edge). */
    };

function isValidYmd(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** Local calendar YYYY-MM-DD for `d`. */
function formatLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Last moment (local) of the calendar day for YYYY-MM-DD. */
function endOfLocalDayFromYmd(ymd: string): Date {
  const [y, mo, d] = ymd.split("-").map(Number);
  return new Date(y, mo - 1, d, 23, 59, 59, 999);
}

function endOfCalendarMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

/** First end-of-month (local) on or after `d` (date-only semantics). */
function nextEndOfMonthOnOrAfter(d: Date): Date {
  return endOfCalendarMonth(d);
}

/** Last end-of-month on or before `d` (local). */
function lastEndOfMonthOnOrBefore(d: Date): Date {
  const eom = endOfCalendarMonth(d);
  if (d.getTime() >= eom.getTime()) return eom;
  return new Date(d.getFullYear(), d.getMonth(), 0);
}

/**
 * Number of end-of-month contribution periods from the first EOM on/after `from`
 * through the last EOM on/before `targetDeadline` (inclusive).
 */
/**
 * Latest calendar date (`YYYY-MM-DD`) that allows exactly `periods` end-of-month
 * contributions from `from` (inverse of `countEndOfMonthContributionPeriods`).
 */
export function targetDateYmdForContributionPeriods(
  from: Date,
  periods: number
): string | null {
  if (periods <= 0) return null;
  const firstPay = nextEndOfMonthOnOrAfter(from);
  let lastPay = new Date(firstPay);
  for (let i = 1; i < periods; i++) {
    lastPay = new Date(lastPay.getFullYear(), lastPay.getMonth() + 2, 0);
  }
  return formatLocalYmd(lastPay);
}

export function countEndOfMonthContributionPeriods(
  from: Date,
  targetDeadline: Date
): number {
  const lastPay = lastEndOfMonthOnOrBefore(targetDeadline);
  const firstPay = nextEndOfMonthOnOrAfter(from);
  if (firstPay.getTime() > lastPay.getTime()) return 0;
  let n = 0;
  let cur = new Date(firstPay);
  while (cur.getTime() <= lastPay.getTime()) {
    n++;
    cur = new Date(cur.getFullYear(), cur.getMonth() + 2, 0);
  }
  return n;
}

/**
 * Minimum constant end-of-month contribution for `months` periods to reach `targetAmount`
 * from `currentValue`, with `annualReturn` (decimal per year). Matches `projectFutureValue`.
 */
export function requiredMonthlyForMonths(
  currentValue: number,
  targetAmount: number,
  annualReturn: number,
  months: number
): number | null {
  if (months <= 0) return null;
  if (!Number.isFinite(currentValue) || !Number.isFinite(targetAmount)) return null;
  if (targetAmount <= currentValue) return 0;

  const fv = targetAmount;
  const pv = currentValue;
  const r = annualReturn / 12;
  if (r === 0) {
    return (fv - pv) / months;
  }
  const growth = (1 + r) ** months;
  const denom = (growth - 1) / r;
  if (!Number.isFinite(denom) || denom <= 0) return null;
  const pmt = (fv - pv * growth) / denom;
  if (!Number.isFinite(pmt)) return null;
  return Math.max(0, pmt);
}

function roundMoneyUp(x: number): number {
  return Math.ceil(x * 100) / 100;
}

export type GoalDeadlineAnalysisParams = {
  /** Typically `new Date()` where the app runs (local fields used). */
  today: Date;
  targetDateYmd: string | null;
  currentAmount: number;
  monthlyContribution: number;
  expectedAnnualReturn: number;
  targetAmount: number;
};

/**
 * If a target date is set, compares projected balance (EOM contributions, same as goals
 * projection) to the target and estimates how much monthly contribution is needed to close the gap.
 */
export function analyzeGoalDeadlineGap(
  params: GoalDeadlineAnalysisParams
): GoalDeadlineAnalysis {
  const {
    today,
    targetDateYmd,
    currentAmount,
    monthlyContribution,
    expectedAnnualReturn,
    targetAmount,
  } = params;

  if (!targetDateYmd || !isValidYmd(targetDateYmd)) {
    return { kind: "no_deadline" };
  }

  if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
    return { kind: "no_deadline" };
  }

  if (!Number.isFinite(currentAmount) || currentAmount >= targetAmount) {
    return { kind: "met" };
  }

  const todayYmd = formatLocalYmd(today);
  if (todayYmd > targetDateYmd) {
    return {
      kind: "past_deadline",
      remaining: Math.max(0, targetAmount - currentAmount),
    };
  }

  const deadline = endOfLocalDayFromYmd(targetDateYmd);
  const n = countEndOfMonthContributionPeriods(today, deadline);
  if (n === 0) {
    return { kind: "no_contribution_periods" };
  }

  const pmt = Number.isFinite(monthlyContribution)
    ? Math.max(0, monthlyContribution)
    : 0;
  const ret = Number.isFinite(expectedAnnualReturn)
    ? Math.max(0, expectedAnnualReturn)
    : 0;

  const projected = projectFutureValue({
    currentValue: currentAmount,
    monthlyContribution: pmt,
    annualReturn: ret,
    months: n,
  });

  const eps = 0.005;
  if (projected + eps >= targetAmount) {
    return { kind: "on_track", monthsRemaining: n };
  }

  const requiredRaw = requiredMonthlyForMonths(
    currentAmount,
    targetAmount,
    ret,
    n
  );
  if (requiredRaw === null) {
    return { kind: "cannot_catch_up" };
  }

  const requiredMonthly = roundMoneyUp(requiredRaw);
  const increaseBy = roundMoneyUp(Math.max(0, requiredMonthly - pmt));

  if (increaseBy <= eps) {
    return { kind: "on_track", monthsRemaining: n };
  }

  return {
    kind: "short",
    monthsRemaining: n,
    requiredMonthly,
    increaseBy,
  };
}
