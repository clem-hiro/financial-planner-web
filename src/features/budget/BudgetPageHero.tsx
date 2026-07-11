import Link from "next/link";
import { sumBucketAmounts } from "@/domain/finance/budget-guided-setup";
import { monthlyBudgetAggregateOverspend } from "@/domain/finance/budget";
import type { BudgetCashFlowAllocation } from "@/domain/finance/budget-cash-flow-allocation";
import { num } from "@/data/mappers";
import type { BudgetLineRow } from "@/data/supabase/types";
import { BudgetMonthJump } from "@/features/budget/BudgetMonthJump";
import { MethodologyOpenLink } from "@/features/help/MethodologyOpenLink";
import { yearFromYearMonth } from "@/lib/dates";
import {
  type BudgetPathVariant,
  budgetMonthHref,
} from "@/lib/setup-urls";
import { appInlineLinkClass } from "@/ui/app-link-styles";
import { formatCurrency } from "@/ui/lib/format";

function formatPlanMonthTitle(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return yearMonth;
  const d = new Date(y, m - 1, 1);
  return d.toLocaleString("en-SG", { month: "long", year: "numeric" });
}

function BudgetRingProgress({
  ratio,
  overBudget,
}: {
  ratio: number;
  overBudget: boolean;
}) {
  const r = 36;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(1, Math.max(0, ratio));
  const dash = clamped * c;
  const stroke = overBudget ? "#dc2626" : "#0d9488";
  return (
    <svg
      width="96"
      height="96"
      viewBox="0 0 96 96"
      className="shrink-0"
      aria-hidden
    >
      <circle
        cx="48"
        cy="48"
        r={r}
        fill="none"
        stroke="currentColor"
        className="text-zinc-200 dark:text-slate-700"
        strokeWidth="8"
      />
      <circle
        cx="48"
        cy="48"
        r={r}
        fill="none"
        stroke={stroke}
        strokeWidth="8"
        strokeDasharray={`${dash} ${c}`}
        strokeLinecap="round"
        transform="rotate(-90 48 48)"
      />
    </svg>
  );
}

type Props = {
  month: string;
  currency: string;
  totals: { budget: number; spent: number; remaining: number };
  cashFlow: BudgetCashFlowAllocation;
  activeMonthlyLines: BudgetLineRow[];
  prevMonth: string;
  nextMonth: string;
  budgetPathVariant?: BudgetPathVariant;
  /** Quiet Profile assumptions review — collapsed so Budget stays uncluttered. */
  assumptions?: {
    annualBonusTakeHome: number | null;
    yearlyPayRisePercent: number | null;
    profileHref: string;
  } | null;
};

export function BudgetPageHero({
  month,
  currency,
  totals,
  cashFlow,
  activeMonthlyLines,
  prevMonth,
  nextMonth,
  budgetPathVariant = "setup",
  assumptions = null,
}: Props) {
  const title = formatPlanMonthTitle(month);
  const agg = monthlyBudgetAggregateOverspend(totals);
  const planned = totals.budget;
  const spent = totals.spent;
  const ratio = planned > 0 ? spent / planned : 0;

  const bucket = sumBucketAmounts(
    activeMonthlyLines.map((l) => ({
      category: l.category,
      amount: num(l.amount),
    }))
  );
  const plannedBucketTotal = bucket.needs + bucket.wants + bucket.savings;
  const savingsShare =
    plannedBucketTotal > 0 ? bucket.savings / plannedBucketTotal : 0;
  let savingsHealth: { label: string; tone: "good" | "ok" | "low" };
  if (plannedBucketTotal <= 0) {
    savingsHealth = { label: "Add categories to see your savings mix", tone: "ok" };
  } else if (savingsShare >= 0.18) {
    savingsHealth = { label: "Savings mix looks strong", tone: "good" };
  } else if (savingsShare >= 0.1) {
    savingsHealth = { label: "Savings mix is on track", tone: "ok" };
  } else {
    savingsHealth = {
      label: "Room to grow savings in this plan",
      tone: "low",
    };
  }

  const healthClass =
    savingsHealth.tone === "good"
      ? "text-emerald-800 dark:text-emerald-200"
      : savingsHealth.tone === "low"
        ? "text-amber-800 dark:text-amber-200"
        : "text-zinc-600 dark:text-slate-300";

  const { freeCashFlow, unallocatedAfterCommitments } = cashFlow;
  const hasOtherCommitments = cashFlow.plannedGoalContributions > 0;
  const showCommitmentsFootnote =
    hasOtherCommitments && unallocatedAfterCommitments != null;

  const metricClass =
    "min-w-0 space-y-0.5 border-l border-zinc-200/90 pl-3 first:border-l-0 first:pl-0 dark:border-slate-700/80 sm:pl-4 sm:first:pl-0";

  return (
    <section
      id="budget-hero"
      className="scroll-mt-4 space-y-6 rounded-3xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:shadow-black/25 sm:p-7"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-teal-700/80 dark:text-teal-300">
            This month
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-slate-50 sm:text-[1.75rem]">
            {title}
          </h1>
          <p className="max-w-lg text-sm leading-relaxed text-zinc-500 dark:text-slate-400">
            Planned spend, what&apos;s left, and room for savings.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-zinc-600 dark:text-slate-300">
          <Link
            className={`${appInlineLinkClass} font-medium`}
            href={budgetMonthHref(
              budgetPathVariant,
              prevMonth,
              yearFromYearMonth(prevMonth)
            )}
          >
            Prev
          </Link>
          <Link
            className={`${appInlineLinkClass} font-medium`}
            href={budgetMonthHref(
              budgetPathVariant,
              nextMonth,
              yearFromYearMonth(nextMonth)
            )}
          >
            Next
          </Link>
          <BudgetMonthJump
            month={month}
            budgetPathVariant={budgetPathVariant}
          />
        </div>
      </div>

      <div className="flex flex-col gap-6 border-t border-zinc-100 pt-6 dark:border-slate-800 sm:flex-row sm:items-center sm:gap-8">
        <div className="relative mx-auto sm:mx-0">
          <BudgetRingProgress ratio={ratio} overBudget={!agg.onTrack} />
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-400 dark:text-slate-500">
              Used
            </span>
            <span className="text-base font-semibold tabular-nums text-zinc-900 dark:text-slate-50">
              {planned > 0
                ? `${Math.min(100, Math.round(ratio * 100))}%`
                : "—"}
            </span>
          </div>
        </div>

        <dl className="grid min-w-0 flex-1 grid-cols-2 gap-y-4 sm:grid-cols-4 sm:gap-y-0">
          {cashFlow.takeHome != null ? (
            <div className={metricClass}>
              <dt className="text-[11px] text-zinc-500 dark:text-slate-400">
                Take-home
              </dt>
              <dd className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-slate-50">
                {formatCurrency(cashFlow.takeHome, currency)}
              </dd>
            </div>
          ) : (
            <div className={`${metricClass} col-span-2 sm:col-span-4`}>
              <dt className="text-[11px] text-zinc-500 dark:text-slate-400">
                Take-home
              </dt>
              <dd className="text-sm text-zinc-600 dark:text-slate-300">
                <Link href="/setup?tab=profile" className={appInlineLinkClass}>
                  Set income in Profile
                </Link>
              </dd>
            </div>
          )}
          <div className={metricClass}>
            <dt className="text-[11px] text-zinc-500 dark:text-slate-400">
              Planned
            </dt>
            <dd className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-slate-50">
              {formatCurrency(planned, currency)}
            </dd>
          </div>
          <div className={metricClass}>
            <dt className="text-[11px] text-zinc-500 dark:text-slate-400">
              Logged
            </dt>
            <dd className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-slate-50">
              {formatCurrency(spent, currency)}
            </dd>
          </div>
          <div className={metricClass}>
            <dt className="text-[11px] text-zinc-500 dark:text-slate-400">
              Left
            </dt>
            <dd
              className={
                totals.remaining < 0
                  ? "text-sm font-semibold tabular-nums text-red-600 dark:text-red-300"
                  : "text-sm font-semibold tabular-nums text-emerald-800 dark:text-emerald-200"
              }
            >
              {formatCurrency(totals.remaining, currency)}
            </dd>
          </div>
        </dl>
      </div>

      {freeCashFlow != null && (
        <div className="rounded-2xl bg-teal-50/70 px-4 py-3.5 dark:bg-teal-950/30">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-teal-800/80 dark:text-teal-200/90">
                Free cash flow
              </p>
              <p
                className={
                  freeCashFlow < 0
                    ? "mt-0.5 text-xl font-semibold tabular-nums text-amber-900 dark:text-amber-200"
                    : "mt-0.5 text-xl font-semibold tabular-nums text-teal-950 dark:text-teal-50"
                }
              >
                {formatCurrency(freeCashFlow, currency)}
              </p>
            </div>
            <MethodologyOpenLink
              topicId="budget-cash-flow-allocation"
              className="text-xs"
            >
              How calculated
            </MethodologyOpenLink>
          </div>
          {freeCashFlow < 0 ? (
            <p className="mt-2 text-xs text-amber-900/90 dark:text-amber-100">
              Planned spend leaves no spare cash — trim categories or check
              income.
            </p>
          ) : (
            <p className="mt-2 text-xs text-teal-900/75 dark:text-teal-100/80">
              Spare after this plan.{" "}
              <Link
                href="/setup?tab=investments#add-investment"
                className={appInlineLinkClass}
              >
                Direct it to investments
              </Link>{" "}
              if you like.
            </p>
          )}
          {showCommitmentsFootnote ? (
            <p className="mt-2 text-xs text-teal-900/70 dark:text-teal-100/70">
              Goals still take{" "}
              <span className="font-medium tabular-nums">
                {formatCurrency(cashFlow.plannedGoalContributions, currency)}
              </span>
              /mo outside budget lines —{" "}
              <Link href="/setup?tab=goals" className={appInlineLinkClass}>
                Goals
              </Link>
              . After that:{" "}
              <span
                className={
                  unallocatedAfterCommitments! < 0
                    ? "font-medium tabular-nums text-amber-900 dark:text-amber-200"
                    : "font-medium tabular-nums"
                }
              >
                {formatCurrency(unallocatedAfterCommitments!, currency)}
              </span>
              .
            </p>
          ) : null}
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-zinc-100 pt-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
        <p className={`text-sm ${healthClass}`}>{savingsHealth.label}</p>
        {assumptions ? (
          <details className="group text-sm text-zinc-500 dark:text-slate-400">
            <summary className="cursor-pointer list-none marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="inline-flex items-center gap-1.5 hover:text-zinc-700 dark:hover:text-slate-200">
                From Profile
                <span
                  className="text-[10px] transition-transform group-open:rotate-180"
                  aria-hidden
                >
                  ▾
                </span>
              </span>
            </summary>
            <div className="mt-2 space-y-1 text-xs leading-relaxed text-zinc-600 dark:text-slate-300 sm:text-right">
              {cashFlow.takeHome != null ? (
                <p>
                  Take-home{" "}
                  <span className="font-medium tabular-nums text-zinc-900 dark:text-slate-50">
                    {formatCurrency(cashFlow.takeHome, currency)}
                  </span>
                </p>
              ) : null}
              {assumptions.annualBonusTakeHome != null &&
              assumptions.annualBonusTakeHome > 0 ? (
                <p>
                  Bonus{" "}
                  <span className="font-medium tabular-nums text-zinc-900 dark:text-slate-50">
                    {formatCurrency(
                      assumptions.annualBonusTakeHome,
                      currency
                    )}
                  </span>
                  <span className="text-zinc-400"> / year</span>
                </p>
              ) : null}
              <p>
                Pay rises{" "}
                <span className="font-medium text-zinc-900 dark:text-slate-50">
                  {assumptions.yearlyPayRisePercent != null &&
                  assumptions.yearlyPayRisePercent > 0
                    ? `${assumptions.yearlyPayRisePercent}%`
                    : "None"}
                </span>
              </p>
              <p>
                <Link
                  href={assumptions.profileHref}
                  className={appInlineLinkClass}
                >
                  Edit in Profile
                </Link>
              </p>
            </div>
          </details>
        ) : null}
      </div>
    </section>
  );
}
