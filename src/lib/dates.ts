/** Add whole calendar months to a local date (mutation-safe). */
export function addCalendarMonths(base: Date, months: number): Date {
  const d = new Date(base.getTime());
  d.setMonth(d.getMonth() + months);
  return d;
}

/** `YYYY-MM` for the given date (local). */
export function formatYearMonth(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function parseYearMonth(ym: string): boolean {
  return /^\d{4}-\d{2}$/.test(ym);
}

/** Calendar year from `YYYY-MM` (caller should ensure `parseYearMonth`). */
export function yearFromYearMonth(ym: string): number {
  return Number(ym.slice(0, 4));
}

/** Shift `YYYY-MM` by `delta` months (local calendar). */
export function addMonthsToYearMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return formatYearMonth(d);
}

/** Local calendar today as `YYYY-MM-DD`. */
export function todayISODateLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Last calendar day of `YYYY-MM` as `YYYY-MM-DD` (local). */
export function lastDayOfYearMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return `${ym}-${String(lastDay).padStart(2, "0")}`;
}

/**
 * Default `spent_at` when logging expenses for budget month `yearMonth`:
 * today if that month is the current month, otherwise last day of that month.
 */
export function defaultExpenseDateForBudgetMonth(yearMonth: string): string {
  const currentYm = formatYearMonth(new Date());
  if (yearMonth === currentYm) {
    return todayISODateLocal();
  }
  return lastDayOfYearMonth(yearMonth);
}
