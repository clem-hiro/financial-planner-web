import {
  formatYearMonth,
  parseYearMonth,
  yearFromYearMonth,
} from "@/lib/dates";

/** Query string for the budget editor under Financial setup. */
export function setupBudgetSearch(month: string, calendarYear: number): string {
  return `tab=budget&month=${encodeURIComponent(month)}&year=${String(calendarYear)}`;
}

export function setupBudgetPath(month: string, calendarYear: number): string {
  return `/setup?${setupBudgetSearch(month, calendarYear)}`;
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
