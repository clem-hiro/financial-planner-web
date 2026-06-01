/** Calendar month delta from `from` (inclusive month) to `to` (exclusive if `to` is before `from` day). */
export function calendarMonthsBetween(from: Date, to: Date): number {
  const months =
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) {
    return Math.max(0, months - 1);
  }
  return Math.max(0, months);
}

export function parseIsoDateOnly(value: string | null | undefined): Date | null {
  if (value == null || String(value).trim() === "") return null;
  const d = new Date(`${String(value).trim()}T12:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export type ContributionScheduleFromDates = {
  /** Months from asOf before the first modeled contribution. */
  contributionStartMonth: number;
  /** Exclusive end month index for contributions (month indices 0..limit-1 contribute). */
  contributionMonthsLimit: number;
};

/**
 * Derive projection contribution window from optional calendar start/end.
 * `current_value` is assumed to reflect premiums paid before `asOf`.
 */
export function contributionScheduleFromDates(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  asOf: Date = new Date()
): ContributionScheduleFromDates | null {
  const end = parseIsoDateOnly(endDate);
  if (!end) return null;

  const start = parseIsoDateOnly(startDate);
  const effectiveStart =
    start != null && start.getTime() > asOf.getTime() ? start : asOf;

  if (end.getTime() < effectiveStart.getTime()) {
    return { contributionStartMonth: 0, contributionMonthsLimit: 0 };
  }

  const startOffset =
    start != null && start.getTime() > asOf.getTime()
      ? calendarMonthsBetween(asOf, start)
      : 0;

  const monthsThroughEnd = calendarMonthsBetween(effectiveStart, end) + 1;
  return {
    contributionStartMonth: startOffset,
    contributionMonthsLimit: startOffset + Math.max(0, monthsThroughEnd),
  };
}
