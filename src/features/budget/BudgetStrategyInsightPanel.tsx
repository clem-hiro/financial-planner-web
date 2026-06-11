import {
  strategyNeedsWantsSavings,
  sumBucketAmounts,
  type BudgetingStrategyId,
} from "@/domain/finance/budget-guided-setup";
import { isMonthlyBudgetLineApplicable } from "@/domain/finance/budget";
import { num } from "@/data/mappers";
import type { BudgetLineRow, ProfileRow } from "@/data/supabase/types";
import { appInlineLinkClass } from "@/ui/app-link-styles";
import { formatCurrency } from "@/ui/lib/format";
import Link from "next/link";

const STRATEGY_IDS: BudgetingStrategyId[] = [
  "balanced",
  "aggressive_saver",
  "flexible_lifestyle",
  "custom",
];

function coerceStrategy(
  raw: string | null | undefined
): BudgetingStrategyId | null {
  if (!raw) return null;
  return STRATEGY_IDS.includes(raw as BudgetingStrategyId)
    ? (raw as BudgetingStrategyId)
    : null;
}

type Props = {
  profile: ProfileRow | null;
  currency: string;
  month: string;
  monthlyLines: BudgetLineRow[];
};

/**
 * Needs / wants / savings visualization and placeholders for future advisor/AI tooling.
 */
export function BudgetStrategyInsightPanel({
  profile,
  currency,
  month,
  monthlyLines,
}: Props) {
  const strategyId = coerceStrategy(profile?.budgeting_strategy);
  const applicable = monthlyLines.filter(
    (l) =>
      l.cadence === "monthly" &&
      isMonthlyBudgetLineApplicable(
        month,
        l.start_year_month ?? null,
        l.end_year_month ?? null
      )
  );
  const bucketActual = sumBucketAmounts(
    applicable.map((l) => ({ category: l.category, amount: num(l.amount) }))
  );
  const totalActual =
    bucketActual.needs + bucketActual.wants + bucketActual.savings;

  const split = strategyId ? strategyNeedsWantsSavings(strategyId) : null;

  return (
    <section
      id="budget-plan-lens"
      className="scroll-mt-4 space-y-5 rounded-3xl border border-zinc-200/80 bg-linear-to-br from-white via-sky-50/20 to-zinc-50/90 p-5 shadow-sm dark:border-slate-800 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 dark:shadow-black/25 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-zinc-900 dark:text-slate-50">
            Needs, wants & savings
          </h3>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-zinc-600 dark:text-slate-300">
            A simple lens on where your plan leans — built for clarity, not
            accounting perfection.
          </p>
        </div>
        {profile?.lifestyle_profile && (
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-zinc-700 dark:bg-slate-800 dark:text-slate-200">
            Lifestyle: {profile.lifestyle_profile.replace(/_/g, " ")}
          </span>
        )}
      </div>

      {!strategyId ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-white/60 p-4 text-sm text-zinc-700 dark:border-slate-700 dark:bg-slate-900/75 dark:text-slate-200">
          <p className="font-medium text-zinc-900 dark:text-slate-50">Pick a budgeting style</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-slate-300">
            Set it in{" "}
            <Link href="/setup?tab=profile" className={appInlineLinkClass}>
              Setup → Profile
            </Link>{" "}
            under <span className="font-medium">Budget lens</span> to see your
            target mix alongside your lines.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-zinc-100 bg-white/90 p-4 shadow-sm ring-1 ring-zinc-100/80 dark:border-slate-700 dark:bg-slate-900/75 dark:ring-slate-700/60">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-slate-400">
              Your style target
            </p>
            <p className="mt-1 text-xs capitalize text-zinc-600 dark:text-slate-300">
              {strategyId.replace(/_/g, " ")}
            </p>
            <div className="mt-3">
              <StackedMixBar
                needs={split!.needs}
                wants={split!.wants}
                savings={split!.savings}
              />
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-zinc-600 dark:text-slate-300">
              <div>
                <dt className="text-sky-800 dark:text-sky-200">Needs</dt>
                <dd className="font-semibold text-zinc-900 dark:text-slate-50">
                  {(split!.needs * 100).toFixed(0)}%
                </dd>
              </div>
              <div>
                <dt className="text-violet-800 dark:text-violet-200">Wants</dt>
                <dd className="font-semibold text-zinc-900 dark:text-slate-50">
                  {(split!.wants * 100).toFixed(0)}%
                </dd>
              </div>
              <div>
                <dt className="text-emerald-800 dark:text-emerald-200">Savings</dt>
                <dd className="font-semibold text-zinc-900 dark:text-slate-50">
                  {(split!.savings * 100).toFixed(0)}%
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl border border-zinc-100 bg-white/90 p-4 shadow-sm ring-1 ring-zinc-100/80 dark:border-slate-700 dark:bg-slate-900/75 dark:ring-slate-700/60">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-slate-400">
              Your lines this month ({month})
            </p>
            {totalActual <= 0 ? (
              <p className="mt-2 text-sm text-zinc-600 dark:text-slate-300">
                No active monthly lines yet.{" "}
                <Link href="#budget-quick-add" className={appInlineLinkClass}>
                  Quick add
                </Link>{" "}
                a few categories to see this fill in.
              </p>
            ) : (
              <>
                <div className="mt-3">
                  <StackedMixBar
                    needs={bucketActual.needs / totalActual}
                    wants={bucketActual.wants / totalActual}
                    savings={bucketActual.savings / totalActual}
                  />
                </div>
                <ul className="mt-3 grid grid-cols-3 gap-2 text-[11px] text-zinc-600 dark:text-slate-300">
                  <li className="rounded-lg bg-sky-50/80 px-2 py-1.5 dark:bg-sky-950/45">
                    <span className="text-sky-900 dark:text-sky-200">Needs</span>
                    <span className="mt-0.5 block font-semibold text-zinc-900 dark:text-slate-50">
                      {formatCurrency(bucketActual.needs, currency)}
                    </span>
                  </li>
                  <li className="rounded-lg bg-violet-50/80 px-2 py-1.5 dark:bg-violet-950/45">
                    <span className="text-violet-900 dark:text-violet-200">Wants</span>
                    <span className="mt-0.5 block font-semibold text-zinc-900 dark:text-slate-50">
                      {formatCurrency(bucketActual.wants, currency)}
                    </span>
                  </li>
                  <li className="rounded-lg bg-emerald-50/80 px-2 py-1.5 dark:bg-emerald-950/45">
                    <span className="text-emerald-900 dark:text-emerald-200">Savings</span>
                    <span className="mt-0.5 block font-semibold text-zinc-900 dark:text-slate-50">
                      {formatCurrency(bucketActual.savings, currency)}
                    </span>
                  </li>
                </ul>
              </>
            )}
          </div>
        </div>
      )}

      <div className="grid gap-3 border-t border-zinc-100 pt-4 dark:border-slate-800 sm:grid-cols-2">
        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-3 text-xs text-zinc-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
          <p className="font-semibold text-zinc-800 dark:text-slate-100">Auto rebalance</p>
          <p className="mt-1">Coming soon — gentle nudges when categories drift.</p>
        </div>
        <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 p-3 text-xs text-zinc-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
          <p className="font-semibold text-zinc-800 dark:text-slate-100">Advisor insights</p>
          <p className="mt-1">Coming soon — patterns your advisor can discuss without spreadsheet detail.</p>
        </div>
      </div>

      <p className="text-[11px] text-zinc-500 dark:text-slate-400">
        AI suggestions: Coming soon · Predictive cashflow: Coming soon
      </p>
    </section>
  );
}

function StackedMixBar({
  needs,
  wants,
  savings,
}: {
  needs: number;
  wants: number;
  savings: number;
}) {
  const n = Math.max(0, needs);
  const w = Math.max(0, wants);
  const s = Math.max(0, savings);
  const t = n + w + s || 1;
  const pn = (n / t) * 100;
  const pw = (w / t) * 100;
  const ps = (s / t) * 100;
  return (
    <div
      className="flex h-3.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-slate-800"
      role="img"
      aria-label={`Needs ${pn.toFixed(0)} percent, wants ${pw.toFixed(0)} percent, savings ${ps.toFixed(0)} percent`}
    >
      <div
        className="h-full bg-sky-500/90"
        style={{ width: `${pn}%` }}
        title="Needs"
      />
      <div
        className="h-full bg-violet-500/85"
        style={{ width: `${pw}%` }}
        title="Wants"
      />
      <div
        className="h-full bg-emerald-600/90"
        style={{ width: `${ps}%` }}
        title="Savings"
      />
    </div>
  );
}
