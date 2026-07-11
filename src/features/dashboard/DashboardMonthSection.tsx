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
  return (
    <div className="space-y-6">
      {payload.goalBudgetHints.length > 0 && (
        <PageSection
          title="Goals & cash flow"
          description={
            <span className="text-xs text-zinc-600 dark:text-slate-300">
              Take-home minus spend basis (logged when any expense in the month,
              else planned monthly budget), then minus each goal&apos;s planned monthly
              amount (from Setup → Goals—not from your expense list).
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
              Set monthly take-home on your profile to show balances after spend basis
              and planned goals.
            </p>
          ) : (
            <div className="space-y-3 text-sm">
              <p
                className={
                  payload.takeHomeMinusExpenses >= 0
                    ? "text-zinc-700 dark:text-slate-200"
                    : "font-medium text-amber-900 dark:text-amber-200"
                }
              >
                {payload.takeHomeMinusExpenses >= 0
                  ? `After spend basis for ${payload.month}: ${formatCurrency(
                      payload.takeHomeMinusExpenses,
                      payload.baseCurrency
                    )} left of take-home (goals not subtracted yet).`
                  : `Spend basis exceeded take-home by ${formatCurrency(
                      -payload.takeHomeMinusExpenses,
                      payload.baseCurrency
                    )} for ${payload.month}.`}
              </p>
              {payload.totalPlannedGoalContributionsMonthly > 0 &&
                payload.discretionaryAfterGoals != null && (
                  <p
                    className={
                      payload.discretionaryAfterGoals >= 0
                        ? "font-medium text-zinc-900 dark:text-slate-50"
                        : "font-medium text-amber-900 dark:text-amber-200"
                    }
                  >
                    After planned goal contributions (
                    {formatCurrency(
                      payload.totalPlannedGoalContributionsMonthly,
                      payload.baseCurrency
                    )}
                    /mo total):{" "}
                    {formatCurrency(
                      payload.discretionaryAfterGoals,
                      payload.baseCurrency
                    )}{" "}
                    <span className="font-normal text-zinc-600 dark:text-slate-300">
                      — your true balance for the month (can be negative).
                    </span>
                  </p>
                )}
            </div>
          )}
          <ul className="mt-4 space-y-2 text-sm text-zinc-700 dark:text-slate-200">
            {payload.goalBudgetHints.map((h) => (
              <li
                key={h.goalId}
                className="border-b border-zinc-100 pb-2 last:border-0 dark:border-slate-700/80"
              >
                <span className="font-medium text-zinc-900 dark:text-slate-50">{h.title}</span>
                {": planned "}
                {formatCurrency(h.plannedMonthly, payload.baseCurrency)}
                /mo on Setup → Goals (progress and ETA).
              </li>
            ))}
          </ul>
        </PageSection>
      )}

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
        {(payload.monthlyBudgetTotals.budget > 0 ||
          payload.monthlyBudgetTotals.spent > 0) && (
          <p
            className={
              payload.monthlyBudgetAggregate.onTrack
                ? "text-sm text-emerald-800 dark:text-emerald-200"
                : "text-sm font-medium text-red-800 dark:text-rose-200"
            }
          >
            {payload.monthlyBudgetAggregate.onTrack
              ? `On plan for ${payload.month} · ${formatCurrency(
                  payload.monthlyBudgetTotals.remaining,
                  payload.baseCurrency
                )} left`
              : `Over by ${formatCurrency(
                  payload.monthlyBudgetAggregate.overBy,
                  payload.baseCurrency
                )} for ${payload.month} (${formatCurrency(
                  payload.monthlyBudgetTotals.spent,
                  payload.baseCurrency
                )} spent vs ${formatCurrency(
                  payload.monthlyBudgetTotals.budget,
                  payload.baseCurrency
                )} planned)`}
          </p>
        )}
        {payload.monthlyBudgetOver.length === 0 ? (
          payload.monthlyBudgetTotals.budget > 0 ||
          payload.monthlyBudgetTotals.spent > 0 ? null : (
            <p className="text-sm text-zinc-600 dark:text-slate-300">
              No monthly budget activity yet — add lines under Setup → Budget.
            </p>
          )
        ) : (
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
        )}
      </PageSection>
    </div>
  );
}
