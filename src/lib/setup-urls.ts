import {
  formatYearMonth,
  parseYearMonth,
  yearFromYearMonth,
} from "@/lib/dates";

/** Query string for the budget editor under Financial setup (classic tab URL). */
export function setupBudgetSearch(month: string, calendarYear: number): string {
  return `tab=budget&month=${encodeURIComponent(month)}&year=${String(calendarYear)}`;
}

/** Classic Financial setup → Budget tab (keeps the tab rail on `/setup`). */
export function setupBudgetPath(month: string, calendarYear: number): string {
  return `/setup?${setupBudgetSearch(month, calendarYear)}`;
}

/** Planning workspace → Cash Flow (same budget UI, modular shell). */
export function planningCashFlowBudgetPath(
  month: string,
  calendarYear: number
): string {
  return `/planning/cash-flow?month=${encodeURIComponent(month)}&year=${String(calendarYear)}`;
}

/**
 * Serializable budget URL mode for Server → Client boundaries.
 * Use `budgetMonthHref(variant, …)` in both RSC and client components instead of passing path functions as props.
 */
export type BudgetPathVariant = "setup" | "planning";

export function budgetMonthHref(
  variant: BudgetPathVariant,
  month: string,
  calendarYear: number
): string {
  return variant === "planning"
    ? planningCashFlowBudgetPath(month, calendarYear)
    : setupBudgetPath(month, calendarYear);
}

/** Resolves the setup URL for a tab, including default month/year for Budget. */
export function setupTabPath(
  tabId: string,
  search: { month?: string; year?: string }
): string {
  if (tabId === "budget") {
    const month =
      search.month && parseYearMonth(search.month)
        ? search.month
        : formatYearMonth(new Date());
    const yearParsed = search.year != null ? Number(search.year) : NaN;
    const calendarYear =
      Number.isFinite(yearParsed) && yearParsed >= 2000 && yearParsed <= 2100
        ? yearParsed
        : yearFromYearMonth(month);
    return setupBudgetPath(month, calendarYear);
  }
  return `/setup?tab=${encodeURIComponent(tabId)}`;
}
