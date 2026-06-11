import Link from "next/link";
import {
  loadGoalTradeoffContext,
  type GoalTradeoffContext,
} from "@/data/goal-tradeoff-context";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { appInlineLinkClass } from "@/ui/app-link-styles";
import { formatCurrency } from "@/ui/lib/format";

type Props = {
  userId: string;
  currency: string;
  /** When provided, skips a second load (parent already fetched). */
  tradeoffCtx?: GoalTradeoffContext | null;
};

export async function GoalPriorityTradeoffPanel({
  userId,
  currency,
  tradeoffCtx: tradeoffCtxProp,
}: Props) {
  const ctx =
    tradeoffCtxProp !== undefined
      ? tradeoffCtxProp
      : await loadGoalTradeoffContext(
          await createSupabaseServerClient(),
          userId
        );
  if (!ctx) return null;

  const { yearMonth, analysis } = ctx;
  const {
    takeHomeMonthly,
    monthlyExpensesTotal,
    surplusBeforeGoals,
    totalPlannedMonthly,
    overCommitmentMonthly,
    unallocatedSurplus,
    lines,
  } = analysis;

  const hasIncome = takeHomeMonthly != null;
  const hasShortfall = lines.some((l) => l.shortfallMonthly > 0);

  return (
    <section className="rounded-xl border border-zinc-200/90 bg-zinc-50/50 px-4 py-4 dark:border-slate-700/80 dark:bg-slate-900 sm:px-5">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-slate-50">
        Priority &amp; monthly trade-offs
      </h3>
      <p className="mt-1 text-sm text-zinc-600 dark:text-slate-300">
        Goals are funded in priority order (top of your list first) against the
        same monthly surplus basis as{" "}
        <Link href="/dashboard" className={appInlineLinkClass}>
          Home
        </Link>{" "}
        for {yearMonth}. Illustrative only — not advice.
      </p>

      {!hasIncome ? (
        <p className="mt-3 text-sm text-amber-900 dark:text-amber-100">
          Add income in{" "}
          <Link href="/setup?tab=profile" className={appInlineLinkClass}>
            Profile
          </Link>{" "}
          to see surplus vs planned goal contributions.
        </p>
      ) : (
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-zinc-500 dark:text-slate-400">Take-home (month)</dt>
            <dd className="font-medium tabular-nums text-zinc-900 dark:text-slate-50">
              {formatCurrency(takeHomeMonthly, currency)}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500 dark:text-slate-400">Spend basis (month)</dt>
            <dd className="font-medium tabular-nums text-zinc-900 dark:text-slate-50">
              {monthlyExpensesTotal != null
                ? formatCurrency(monthlyExpensesTotal, currency)
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500 dark:text-slate-400">Surplus before goals</dt>
            <dd className="font-medium tabular-nums text-zinc-900 dark:text-slate-50">
              {surplusBeforeGoals != null
                ? formatCurrency(surplusBeforeGoals, currency)
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-zinc-500 dark:text-slate-400">Total planned to goals</dt>
            <dd className="font-medium tabular-nums text-zinc-900 dark:text-slate-50">
              {formatCurrency(totalPlannedMonthly, currency)}
            </dd>
          </div>
        </dl>
      )}

      {hasIncome && overCommitmentMonthly > 0 ? (
        <p
          className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-300/45 dark:bg-amber-950/45 dark:text-amber-100"
          role="status"
        >
          Planned goal contributions exceed surplus by about{" "}
          <strong>{formatCurrency(overCommitmentMonthly, currency)}</strong>
          /mo. Lower-priority goals may need smaller contributions or a later
          target date.
        </p>
      ) : null}

      {hasIncome && overCommitmentMonthly === 0 && unallocatedSurplus > 0 ? (
        <p className="mt-3 text-sm text-zinc-700 dark:text-slate-300">
          After funding all goals in priority order, about{" "}
          <strong>{formatCurrency(unallocatedSurplus, currency)}</strong>
          /mo is unallocated (same as discretionary after goals on Home).
        </p>
      ) : null}

      {lines.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {lines.map((line) => (
            <li
              key={line.goalId}
              className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-zinc-100 bg-white px-3 py-2 text-sm dark:border-slate-700/80 dark:bg-slate-950"
            >
              <span className="font-medium text-zinc-900 dark:text-slate-50">
                <span className="mr-2 text-xs font-normal text-zinc-500 dark:text-slate-400">
                  #{line.priorityRank}
                </span>
                {line.title}
              </span>
              <span className="tabular-nums text-zinc-700 dark:text-slate-300">
                {formatCurrency(line.fundedMonthly, currency)} funded of{" "}
                {formatCurrency(line.plannedMonthly, currency)} planned
                {line.shortfallMonthly > 0 ? (
                  <span className="ml-1 text-amber-800 dark:text-amber-200">
                    (−{formatCurrency(line.shortfallMonthly, currency)})
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {hasIncome && hasShortfall ? (
        <p className="mt-3 text-xs text-zinc-500 dark:text-slate-400">
          Raise priority (↑ Higher) on goals you would fund first if cash is
          tight, then adjust monthly contributions or dates.
        </p>
      ) : null}
    </section>
  );
}
