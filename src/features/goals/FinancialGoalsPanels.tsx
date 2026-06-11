import Link from "next/link";
import { loadGoalTradeoffContext } from "@/data/goal-tradeoff-context";
import { num } from "@/data/mappers";
import { createSupabaseServerClient } from "@/data/supabase/server";
import {
  analyzeGoalFeasibility,
  estimateTimeToGoalStandalone,
  goalProgressRatio,
  sortGoalsByPriority,
} from "@/domain/finance";
import type { FinancialGoalRow, InvestmentRow } from "@/data/supabase/types";
import { GoalEditForm } from "@/features/goals/GoalEditForm";
import { GoalFeasibilityNotice } from "@/features/goals/GoalFeasibilityNotice";
import { GoalForm } from "@/features/goals/GoalForm";
import { GoalPriorityTradeoffPanel } from "@/features/goals/GoalPriorityTradeoffPanel";
import { GoalReorderButtons } from "@/features/goals/GoalReorderButtons";
import { RetirementTargetsForm } from "@/features/goals/RetirementTargetsForm";
import { MethodologyOpenLink } from "@/features/help/MethodologyOpenLink";
import { formatMonthsApprox } from "@/ui/lib/duration";
import { appInlineLinkClass } from "@/ui/app-link-styles";
import { PageSection } from "@/ui/PageSection";
import { formatCurrency, formatPercent } from "@/ui/lib/format";

type Estimate =
  | { kind: "met" }
  | { kind: "months"; months: number }
  | { kind: "unreachable" };

type Props = {
  goals: FinancialGoalRow[];
  investments: InvestmentRow[];
  currency: string;
  /** When set, loads priority trade-off vs current-month surplus. */
  userId?: string;
  initialTargetRetirementAge?: number | null;
  initialRetirementMonthlySpendGoal?: number | null;
  initialExpenseGrowthPercent?: number | null;
  initialRetirementDividendYieldPercent?: number | null;
  initialRetirementWithdrawalRatePercent?: number | null;
};

export async function FinancialGoalsPanels({
  goals,
  investments,
  currency,
  userId,
  initialTargetRetirementAge = null,
  initialRetirementMonthlySpendGoal = null,
  initialExpenseGrowthPercent = null,
  initialRetirementDividendYieldPercent = null,
  initialRetirementWithdrawalRatePercent = null,
}: Props) {
  const orderedGoals = sortGoalsByPriority(goals);
  const investmentOptions = investments.map((i) => ({
    id: i.id,
    name: i.name,
  }));

  const tradeoffCtx = userId
    ? await loadGoalTradeoffContext(
        await createSupabaseServerClient(),
        userId
      )
    : null;

  const hasCashContext = tradeoffCtx?.analysis.surplusBeforeGoals != null;
  const affordableByGoalId = new Map(
    tradeoffCtx?.analysis.lines.map((l) => [l.goalId, l.fundedMonthly]) ?? []
  );

  const today = new Date();

  const rows = orderedGoals.map((g, index) => {
    const current = num(g.current_amount);
    const target = num(g.target_amount);
    const pmt = num(g.monthly_contribution);
    const ret = num(g.expected_annual_return);
    const estimate: Estimate = estimateTimeToGoalStandalone(
      current,
      pmt,
      ret,
      target
    );
    const progress = goalProgressRatio(current, target);
    const remaining = Math.max(0, target - current);
    const feasibility = analyzeGoalFeasibility({
      today,
      targetDateYmd: g.target_date,
      currentAmount: current,
      targetAmount: target,
      plannedMonthly: pmt,
      expectedAnnualReturn: ret,
      affordableMonthly: hasCashContext
        ? (affordableByGoalId.get(g.id) ?? 0)
        : null,
    });
    return {
      g,
      estimate,
      progress,
      remaining,
      feasibility,
      priorityRank: index + 1,
      canMoveUp: index > 0,
      canMoveDown: index < orderedGoals.length - 1,
    };
  });

  return (
    <div className="space-y-8">
      <RetirementTargetsForm
        initialTargetRetirementAge={initialTargetRetirementAge}
        initialRetirementMonthlySpendGoal={initialRetirementMonthlySpendGoal}
        initialExpenseGrowthPercent={initialExpenseGrowthPercent}
        initialDividendYieldPercent={initialRetirementDividendYieldPercent}
        initialWithdrawalRatePercent={initialRetirementWithdrawalRatePercent}
        currencyCode={currency}
      />

      <div className="rounded-xl border border-zinc-200/90 bg-zinc-50/50 px-4 py-3 dark:border-slate-700/80 dark:bg-slate-900 sm:px-5">
        <p className="text-sm text-zinc-600 dark:text-slate-300">
          Savings targets with their own balances and monthly plans. Time-to-goal
          uses these numbers (not your investment account balances). Other balances
          live in this page&apos;s{" "}
            <Link
              href="/planning/wealth#wealth-investments"
              className={appInlineLinkClass}
            >
              Investments
            </Link>
            ,{" "}
            <Link
              href="/planning/wealth#wealth-cash-debts"
              className={appInlineLinkClass}
            >
              Cash and debts
            </Link>
            , and{" "}
            <Link
              href="/planning/wealth#wealth-housing"
              className={appInlineLinkClass}
            >
              Housing
            </Link>{" "}
            in the Wealth workspace.
        </p>
        <p className="mt-2 flex flex-wrap gap-x-3 text-xs text-zinc-600 dark:text-slate-300">
          <MethodologyOpenLink topicId="goals-eta" className={appInlineLinkClass}>
            How goal progress & timing work →
          </MethodologyOpenLink>
          <MethodologyOpenLink topicId="net-worth" className={appInlineLinkClass}>
            How net worth uses Setup →
          </MethodologyOpenLink>
        </p>
      </div>

      {userId ? (
        <GoalPriorityTradeoffPanel
          userId={userId}
          currency={currency}
          tradeoffCtx={tradeoffCtx}
        />
      ) : null}

      <PageSection
        title="Add a goal"
        description="Optionally link a goal to an investment account for your own tracking; projections still use account data from Balances."
      >
        <GoalForm investments={investmentOptions} />
      </PageSection>

      <PageSection
        title="Your goals"
        description={
          <span className="text-xs text-zinc-600 dark:text-slate-300">
            Higher priority goals are funded first in the trade-off view above.
            Use ↑ / ↓ to reorder.{" "}
            <MethodologyOpenLink topicId="goals-eta" className={appInlineLinkClass}>
              How estimates work →
            </MethodologyOpenLink>
          </span>
        }
      >
        {rows.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500 dark:text-slate-400">
            Add a goal with how much you&apos;ve already saved and what you add
            each month.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {rows.map(
              ({
                g,
                estimate,
                progress,
                remaining,
                feasibility,
                priorityRank,
                canMoveUp,
                canMoveDown,
              }) => (
              <li
                key={g.id}
                className="border-b border-zinc-100 pb-4 last:border-0 last:pb-0 dark:border-slate-700/80"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium text-zinc-900 dark:text-slate-50">
                    <span className="mr-2 text-xs font-normal text-zinc-500 dark:text-slate-400">
                      Priority {priorityRank}
                    </span>
                    {g.title}
                  </p>
                  <GoalReorderButtons
                    goalId={g.id}
                    canMoveUp={canMoveUp}
                    canMoveDown={canMoveDown}
                  />
                </div>
                <p className="text-sm text-zinc-600 dark:text-slate-300">
                  {formatCurrency(num(g.current_amount), currency)} of{" "}
                  {formatCurrency(num(g.target_amount), currency)}
                  {g.target_date ? ` by ${g.target_date}` : ""}
                </p>
                <div className="mt-2 h-2 w-full max-w-md overflow-hidden rounded-full bg-zinc-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-zinc-800 transition-[width] dark:bg-emerald-300"
                    style={{ width: `${Math.round(progress * 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-zinc-500 dark:text-slate-400">
                  {formatPercent(progress)} complete ·{" "}
                  {formatCurrency(remaining, currency)} remaining
                </p>
                <GoalFeasibilityNotice
                  feasibility={feasibility}
                  targetDateYmd={g.target_date}
                  currency={currency}
                />
                <p className="mt-1 text-sm text-zinc-700 dark:text-slate-300">
                  {estimate.kind === "met" && (
                    <span>
                      Already at or above target (under current assumptions).
                    </span>
                  )}
                  {estimate.kind === "months" && (
                    <span>
                      ~{formatMonthsApprox(estimate.months)} to reach target
                      (end-of-month contributions).
                    </span>
                  )}
                  {estimate.kind === "unreachable" && (
                    <span className="text-amber-800 dark:text-amber-200">
                      Not reachable within 150 years at current saved balance,
                      monthly addition, and return assumptions.
                    </span>
                  )}
                </p>
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-slate-300 dark:hover:text-slate-50">
                    Edit goal
                  </summary>
                  <GoalEditForm goal={g} investments={investmentOptions} />
                </details>
              </li>
            )
            )}
          </ul>
        )}
      </PageSection>
    </div>
  );
}
