import Link from "next/link";
import {
  appTabPillActiveClass,
  appTabPillClass,
  appTabPillInactiveClass,
  appTabRailClass,
} from "@/ui/app-tab-styles";

export function SpendingRouteNav({
  active,
  month,
  budgetCalendarYear,
  category,
}: {
  active: "expenses" | "budget";
  month: string;
  budgetCalendarYear: number;
  category?: string;
}) {
  const catQs =
    category && category.trim() !== ""
      ? `&category=${encodeURIComponent(category.trim())}`
      : "";
  const expensesHref = `/expenses?month=${encodeURIComponent(month)}${catQs}`;
  const budgetHref = `/budget?month=${encodeURIComponent(month)}&year=${budgetCalendarYear}`;

  return (
    <nav aria-label="Spending views" className="sm:mx-0">
      <div className="-mx-1 overflow-x-auto px-1 pb-0.5 scroll-smooth sm:mx-0 sm:overflow-visible sm:px-0 sm:pb-0">
        <div className={appTabRailClass}>
          <Link
            href={expensesHref}
            className={`${appTabPillClass} ${
              active === "expenses" ? appTabPillActiveClass : appTabPillInactiveClass
            }`}
            aria-current={active === "expenses" ? "page" : undefined}
          >
            Expenses
          </Link>
          <Link
            href={budgetHref}
            className={`${appTabPillClass} ${
              active === "budget" ? appTabPillActiveClass : appTabPillInactiveClass
            }`}
            aria-current={active === "budget" ? "page" : undefined}
          >
            Budget
          </Link>
        </div>
      </div>
    </nav>
  );
}
