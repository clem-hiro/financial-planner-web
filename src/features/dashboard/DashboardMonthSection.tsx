import Link from "next/link";
import type { DashboardPayload } from "@/data/dashboard";
import { yearFromYearMonth } from "@/lib/dates";
import { planningCashFlowBudgetPath } from "@/lib/setup-urls";
import { ProjectionMiniChart } from "@/features/dashboard/ProjectionMiniChart";
import { MethodologyOpenLink } from "@/features/help/MethodologyOpenLink";
import { SpendGuidancePanel } from "@/features/spend/SpendGuidancePanel";
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
      {payload.spendRecommendations.length > 0 && (
        <div>
          <div className="mb-1 flex flex-wrap items-center justify-end gap-2">
            <MethodologyOpenLink topicId="spend-guidance" className={`text-xs ${appInlineLinkClass}`}>
              How this works
            </MethodologyOpenLink>
          </div>
          <SpendGuidancePanel
            month={payload.month}
            lines={payload.spendRecommendations}
          />
        </div>
      )}

      <PageSection
        title="Insights"
        description={
          <span className="flex flex-wrap items-center gap-x-2 text-xs text-zinc-600">
            <span>From this month.</span>
            <MethodologyOpenLink topicId="savings-rate" className={`text-xs ${appInlineLinkClass}`}>
              Context
            </MethodologyOpenLink>
          </span>
        }
      >
        <ul className="list-inside list-disc space-y-1 text-sm text-zinc-700">
          {payload.insights.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </PageSection>

      {payload.goalBudgetHints.length > 0 && (
        <PageSection
          title="Goals & cash flow"
          description={
            <span className="flex flex-wrap items-center gap-x-2 text-xs text-zinc-600">
              <span>
                Take-home minus spend basis (logged when any expense in the month,
                else planned monthly budget), then minus each goal&apos;s planned monthly
                amount (from Setup → Goals—not from your expense list).
              </span>
              <MethodologyOpenLink topicId="goal-surplus" className={`text-xs ${appInlineLinkClass}`}>
                How calculated
              </MethodologyOpenLink>
            </span>
          }
          actions={
            <Link href="/planning/future" className={`text-xs ${appInlineLinkClass}`}>
              Edit goals
            </Link>
          }
        >
          {payload.takeHomeMinusExpenses == null ? (
            <p className="text-sm text-zinc-600">
              Set monthly take-home on your profile to show balances after spend basis
              and planned goals.
            </p>
          ) : (
            <div className="space-y-3 text-sm">
              <p
                className={
                  payload.takeHomeMinusExpenses >= 0
                    ? "text-zinc-700"
                    : "font-medium text-amber-900"
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
                        ? "font-medium text-zinc-900"
                        : "font-medium text-amber-900"
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
                    <span className="font-normal text-zinc-600">
                      — your true balance for the month (can be negative).
                    </span>
                  </p>
                )}
            </div>
          )}
          <ul className="mt-4 space-y-2 text-sm text-zinc-700">
            {payload.goalBudgetHints.map((h) => (
              <li
                key={h.goalId}
                className="border-b border-zinc-100 pb-2 last:border-0"
              >
                <span className="font-medium text-zinc-900">{h.title}</span>
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
        description={
          <span className="flex flex-wrap items-center gap-x-2 text-xs text-zinc-600">
            <span>Budget lines vs monthly-tagged expenses.</span>
            <MethodologyOpenLink topicId="monthly-budget-check" className={`text-xs ${appInlineLinkClass}`}>
              How calculated
            </MethodologyOpenLink>
          </span>
        }
        actions={
          <Link
            href={planningCashFlowBudgetPath(
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
                ? "text-sm text-emerald-800"
                : "text-sm font-medium text-red-800"
            }
          >
            {payload.monthlyBudgetAggregate.onTrack
              ? `On plan for ${payload.month}: budgeted categories are within the planned total (remaining ${formatCurrency(
                  payload.monthlyBudgetTotals.remaining,
                  payload.baseCurrency
                )}).`
              : `Over planned total by ${formatCurrency(
                  payload.monthlyBudgetAggregate.overBy,
                  payload.baseCurrency
                )} for budgeted categories in ${payload.month} (${formatCurrency(
                  payload.monthlyBudgetTotals.spent,
                  payload.baseCurrency
                )} spent vs ${formatCurrency(
                  payload.monthlyBudgetTotals.budget,
                  payload.baseCurrency
                )} planned).`}
          </p>
        )}
        {payload.monthlyBudgetOver.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600">
            {payload.monthlyBudgetTotals.budget > 0 ||
            payload.monthlyBudgetTotals.spent > 0
              ? "No single category is over its own budget cap (top overs would appear here)."
              : "No monthly budget activity yet—add lines under Setup → Budget."}
          </p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            <li className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Top categories over their own cap
            </li>
            {payload.monthlyBudgetOver.map((row) => (
              <li
                key={row.categoryLabel}
                className="flex flex-wrap justify-between gap-2 border-b border-zinc-100 pb-2 last:border-0"
              >
                <span className="font-medium capitalize text-zinc-800">
                  {row.categoryLabel}
                </span>
                <span className="text-red-700">
                  {formatCurrency(row.overBy, payload.baseCurrency)} over (
                  {formatCurrency(row.spent, payload.baseCurrency)} /{" "}
                  {formatCurrency(row.budget, payload.baseCurrency)})
                </span>
              </li>
            ))}
          </ul>
        )}
      </PageSection>

      <PageSection
        title="Investments (36 mo preview)"
        description={
          <span className="flex flex-wrap items-center gap-x-2 text-xs text-zinc-600">
            <span>
              Merged investment accounts: each account&apos;s monthly contribution
              and return only, compounded. Cash / debt balances are not grown on
              this chart.
            </span>
            <MethodologyOpenLink
              topicId="investment-projection-36m"
              className={`text-xs ${appInlineLinkClass}`}
            >
              Assumptions
            </MethodologyOpenLink>
          </span>
        }
      >
        <ProjectionMiniChart
          data={payload.projectionPreview}
          currency={payload.baseCurrency}
        />
      </PageSection>
    </div>
  );
}
