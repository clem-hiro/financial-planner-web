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
  const r = 44;
  const c = 2 * Math.PI * r;
  const clamped = Math.min(1, Math.max(0, ratio));
  const dash = clamped * c;
  const stroke = overBudget ? "#dc2626" : "#0d9488";
  return (
    <svg
      width="112"
      height="112"
      viewBox="0 0 112 112"
      className="shrink-0"
      aria-hidden
    >
      <circle
        cx="56"
        cy="56"
        r={r}
        fill="none"
        stroke="#e4e4e7"
        strokeWidth="10"
      />
      <circle
        cx="56"
        cy="56"
        r={r}
        fill="none"
        stroke={stroke}
        strokeWidth="10"
        strokeDasharray={`${dash} ${c}`}
        strokeLinecap="round"
        transform="rotate(-90 56 56)"
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
    savingsHealth = { label: "Add lines to see savings balance", tone: "ok" };
  } else if (savingsShare >= 0.18) {
    savingsHealth = { label: "Savings mix looks strong", tone: "good" };
  } else if (savingsShare >= 0.1) {
    savingsHealth = { label: "Savings mix is healthy", tone: "ok" };
  } else {
    savingsHealth = {
      label: "Room to grow your savings slice",
      tone: "low",
    };
  }

  const healthClass =
    savingsHealth.tone === "good"
      ? "text-emerald-800 dark:text-emerald-200"
      : savingsHealth.tone === "low"
        ? "text-amber-800 dark:text-amber-200"
        : "text-zinc-700 dark:text-slate-200";

  const { freeCashFlow, unallocatedAfterCommitments } = cashFlow;
  const hasOtherCommitments = cashFlow.plannedGoalContributions > 0;
  const showCommitmentsFootnote =
    hasOtherCommitments && unallocatedAfterCommitments != null;

  function freeCashFlowClass(value: number): string {
    if (value < 0) {
      return "mt-0.5 font-semibold tabular-nums text-amber-900 dark:text-amber-200";
    }
    return "mt-0.5 font-semibold tabular-nums text-teal-900 dark:text-teal-100";
  }

  return (
    <section
      id="budget-hero"
      className="scroll-mt-4 overflow-hidden rounded-3xl border border-zinc-200/80 bg-linear-to-br from-white via-teal-50/30 to-zinc-50/90 p-6 shadow-sm dark:border-slate-800 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 dark:shadow-black/25 sm:p-8"
    >
      <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700/80 dark:text-teal-300">
            Monthly spending plan
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-slate-50 sm:text-4xl">
            Your plan for {title}
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-zinc-600 dark:text-slate-300">
            A calm view of what you intended to spend, what is left, and how
            your essentials, lifestyle, and savings balance out — no spreadsheet
            required.
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-zinc-600 dark:text-slate-300">
            <Link
              className={`${appInlineLinkClass} font-medium`}
              href={budgetMonthHref(
                budgetPathVariant,
                prevMonth,
                yearFromYearMonth(prevMonth)
              )}
            >
              Previous month
            </Link>
            <span className="font-mono text-xs text-zinc-400 dark:text-slate-500">{month}</span>
            <Link
              className={`${appInlineLinkClass} font-medium`}
              href={budgetMonthHref(
                budgetPathVariant,
                nextMonth,
                yearFromYearMonth(nextMonth)
              )}
            >
              Next month
            </Link>
            <BudgetMonthJump
              month={month}
              budgetPathVariant={budgetPathVariant}
            />
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-8">
          <div className="relative">
            <BudgetRingProgress ratio={ratio} overBudget={!agg.onTrack} />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-slate-400">
                Used
              </span>
              <span className="text-lg font-semibold tabular-nums text-zinc-900 dark:text-slate-50">
                {planned > 0
                  ? `${Math.min(100, Math.round(ratio * 100))}%`
                  : "—"}
              </span>
            </div>
          </div>
          <dl className="grid w-full max-w-xs grid-cols-2 gap-x-4 gap-y-3 text-sm sm:max-w-md">
            {cashFlow.takeHome != null ? (
              <div className="rounded-2xl bg-white/80 px-3 py-2 shadow-sm ring-1 ring-zinc-100 dark:bg-slate-900/75 dark:ring-slate-700/70">
                <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-slate-400">
                  Take-home
                </dt>
                <dd className="mt-0.5 font-semibold tabular-nums text-zinc-900 dark:text-slate-50">
                  {formatCurrency(cashFlow.takeHome, currency)}
                </dd>
              </div>
            ) : (
              <div className="col-span-2 rounded-2xl border border-dashed border-zinc-200 bg-white/80 px-3 py-2 text-xs text-zinc-600 dark:border-slate-700 dark:bg-slate-900/75 dark:text-slate-300">
                <Link href="/setup?tab=profile" className={appInlineLinkClass}>
                  Set take-home
                </Link>{" "}
                on your profile to see free cash flow after your plan.
              </div>
            )}
            <div className="rounded-2xl bg-white/80 px-3 py-2 shadow-sm ring-1 ring-zinc-100 dark:bg-slate-900/75 dark:ring-slate-700/70">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-slate-400">
                Monthly planned
              </dt>
              <dd className="mt-0.5 font-semibold tabular-nums text-zinc-900 dark:text-slate-50">
                {formatCurrency(planned, currency)}
              </dd>
            </div>
            {freeCashFlow != null && (
              <div className="col-span-2 rounded-2xl border border-teal-200/90 bg-teal-50/60 px-3 py-2 shadow-sm dark:border-teal-400/35 dark:bg-teal-950/35">
                <dt className="flex flex-wrap items-center gap-x-2 text-[11px] font-medium uppercase tracking-wide text-teal-900 dark:text-teal-100">
                  <span>Free cash flow</span>
                  <MethodologyOpenLink
                    topicId="budget-cash-flow-allocation"
                    className="normal-case tracking-normal"
                  >
                    How calculated
                  </MethodologyOpenLink>
                </dt>
                <dd className={freeCashFlowClass(freeCashFlow)}>
                  {formatCurrency(freeCashFlow, currency)}
                </dd>
                {freeCashFlow < 0 ? (
                  <p className="mt-1 text-xs text-amber-900/90 dark:text-amber-100">
                    Your planned spending leaves no free cash flow — trim
                    categories or check income.
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-teal-900/80 dark:text-teal-100/85">
                    You have {formatCurrency(freeCashFlow, currency)} in free
                    cash flow.{" "}
                    <Link
                      href="/setup?tab=investments#add-investment"
                      className={appInlineLinkClass}
                    >
                      Add or adjust an investment
                    </Link>{" "}
                    to see how projections change.
                  </p>
                )}
              </div>
            )}
            {showCommitmentsFootnote && (
              <div className="col-span-2 space-y-1.5 rounded-2xl border border-zinc-200/80 bg-zinc-50/80 px-3 py-2 text-xs text-zinc-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
                <p className="font-medium text-zinc-800 dark:text-slate-100">
                  Other monthly commitments (not in budget lines)
                </p>
                {cashFlow.plannedGoalContributions > 0 && (
                  <p>
                    Goals:{" "}
                    <span className="font-medium tabular-nums text-zinc-900 dark:text-slate-50">
                      {formatCurrency(
                        cashFlow.plannedGoalContributions,
                        currency
                      )}
                    </span>
                    /mo —{" "}
                    <Link href="/setup?tab=goals" className={appInlineLinkClass}>
                      Setup → Goals
                    </Link>
                  </p>
                )}
                <p>
                  After goals:{" "}
                  <span
                    className={
                      unallocatedAfterCommitments! < 0
                        ? "font-semibold tabular-nums text-amber-900 dark:text-amber-200"
                        : "font-semibold tabular-nums text-zinc-900 dark:text-slate-50"
                    }
                  >
                    {formatCurrency(unallocatedAfterCommitments!, currency)}
                  </span>
                </p>
              </div>
            )}
            <div className="rounded-2xl bg-white/80 px-3 py-2 shadow-sm ring-1 ring-zinc-100 dark:bg-slate-900/75 dark:ring-slate-700/70">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-slate-400">
                Logged
              </dt>
              <dd className="mt-0.5 font-semibold tabular-nums text-zinc-900 dark:text-slate-50">
                {formatCurrency(spent, currency)}
              </dd>
            </div>
            <div className="rounded-2xl bg-white/80 px-3 py-2 shadow-sm ring-1 ring-zinc-100 dark:bg-slate-900/75 dark:ring-slate-700/70">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-slate-400">
                Left in plan
              </dt>
              <dd
                className={
                  totals.remaining < 0
                    ? "mt-0.5 font-semibold tabular-nums text-red-600 dark:text-red-300"
                    : "mt-0.5 font-semibold tabular-nums text-emerald-800 dark:text-emerald-200"
                }
              >
                {formatCurrency(totals.remaining, currency)}
              </dd>
            </div>
            <div className="col-span-2 rounded-2xl border border-dashed border-teal-200/80 bg-teal-50/40 px-3 py-2 dark:border-teal-400/30 dark:bg-teal-950/25">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-teal-800 dark:text-teal-200">
                Savings shape
              </dt>
              <dd className={`mt-0.5 text-sm font-medium ${healthClass}`}>
                {savingsHealth.label}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
