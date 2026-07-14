import Link from "next/link";
import type { DashboardPayload } from "@/data/dashboard";
import { yearFromYearMonth } from "@/lib/dates";
import { setupBudgetPath } from "@/lib/setup-urls";
import { appInlineLinkClass } from "@/ui/app-link-styles";
import { PageSection } from "@/ui/PageSection";
import { formatCurrency } from "@/ui/lib/format";

export function DashboardMonthSection({
  payload,
}: {
  payload: DashboardPayload;
}) {
  const hasGoalHints = payload.goalBudgetHints.length > 0;
  const hasBudgetActivity =
    payload.monthlyBudgetTotals.budget > 0 ||
    payload.monthlyBudgetTotals.spent > 0;
  const hasOverCap = payload.monthlyBudgetOver.length > 0;
  /** Quiet when Overview already covers “expenses” and the month is on plan. */
  const showBudgetCheck = hasOverCap || !hasBudgetActivity;

  if (!hasGoalHints && !showBudgetCheck) {
    return (
      <p className="text-sm text-zinc-600 dark:text-slate-300">
        This month looks on plan for budget categories. Income and expenses are
        in Overview; open{" "}
        <Link href="/expenses" className={appInlineLinkClass}>
          Activity
        </Link>{" "}
        or{" "}
        <Link
          href={setupBudgetPath(payload.month, yearFromYearMonth(payload.month))}
          className={appInlineLinkClass}
        >
          Setup → Budget
        </Link>{" "}
        for detail.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {hasGoalHints && (
        <PageSection
          title="Goals this month"
          description={
            <span className="text-xs text-zinc-600 dark:text-slate-300">
              Planned monthly amounts from Setup → Goals (not from your expense
              list). Overview already shows income − expenses; this is what is
              left after those goal contributions.
            </span>
          }
          actions={
            <Link href="/setup?tab=goals" className={`text-xs ${appInlineLinkClass}`}>
              Edit goals
            </Link>
          }
        >
          {payload.takeHomeMinusExpenses == null ? (
            <p className="text-sm text-zinc-600 dark:text-slate-300">
              Set monthly take-home on your profile to see balance after planned
              goals.
            </p>
          ) : payload.totalPlannedGoalContributionsMonthly > 0 &&
            payload.discretionaryAfterGoals != null ? (
            <p
              className={
                payload.discretionaryAfterGoals >= 0
                  ? "text-sm font-medium text-zinc-900 dark:text-slate-50"
                  : "text-sm font-medium text-amber-900 dark:text-amber-200"
              }
            >
              After planned goal contributions (
              {formatCurrency(
                payload.totalPlannedGoalContributionsMonthly,
                payload.baseCurrency
              )}
              /mo):{" "}
              {formatCurrency(
                payload.discretionaryAfterGoals,
                payload.baseCurrency
              )}
              <span className="font-normal text-zinc-600 dark:text-slate-300">
                {" "}
                left (can be negative).
              </span>
            </p>
          ) : (
            <p className="text-sm text-zinc-600 dark:text-slate-300">
              No monthly goal contribution amounts yet — add them under Setup →
              Goals.
            </p>
          )}
          <ul className="mt-4 space-y-2 text-sm text-zinc-700 dark:text-slate-200">
            {payload.goalBudgetHints.map((h) => (
              <li
                key={h.goalId}
                className="border-b border-zinc-100 pb-2 last:border-0 dark:border-slate-700/80"
              >
                <span className="font-medium text-zinc-900 dark:text-slate-50">
                  {h.title}
                </span>
                {": planned "}
                {formatCurrency(h.plannedMonthly, payload.baseCurrency)}
                /mo
              </li>
            ))}
          </ul>
        </PageSection>
      )}

      {showBudgetCheck && (
        <PageSection
          title="Budget check"
          actions={
            <Link
              href={setupBudgetPath(
                payload.month,
                yearFromYearMonth(payload.month)
              )}
              className={`text-xs ${appInlineLinkClass}`}
            >
              Manage budgets
            </Link>
          }
        >
          {!hasBudgetActivity ? (
            <p className="text-sm text-zinc-600 dark:text-slate-300">
              No monthly budget activity yet — add lines under Setup → Budget.
            </p>
          ) : (
            <>
              <p className="text-sm font-medium text-red-800 dark:text-rose-200">
                Over by{" "}
                {formatCurrency(
                  payload.monthlyBudgetAggregate.overBy,
                  payload.baseCurrency
                )}{" "}
                for {payload.month}
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                <li className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-slate-400">
                  Over cap
                </li>
                {payload.monthlyBudgetOver.map((row) => (
                  <li
                    key={row.categoryLabel}
                    className="flex flex-wrap justify-between gap-2 border-b border-zinc-100 pb-2 last:border-0 dark:border-slate-700/80"
                  >
                    <span className="font-medium capitalize text-zinc-800 dark:text-slate-100">
                      {row.categoryLabel}
                    </span>
                    <span className="text-red-700 dark:text-rose-200">
                      {formatCurrency(row.overBy, payload.baseCurrency)} over (
                      {formatCurrency(row.spent, payload.baseCurrency)} /{" "}
                      {formatCurrency(row.budget, payload.baseCurrency)})
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </PageSection>
      )}
    </div>
  );
}
