import Link from "next/link";
import { sumBucketAmounts } from "@/domain/finance/budget-guided-setup";
import { monthlyBudgetAggregateOverspend } from "@/domain/finance/budget";
import { num } from "@/data/mappers";
import type { BudgetLineRow } from "@/data/supabase/types";
import { BudgetMonthJump } from "@/features/budget/BudgetMonthJump";
import { yearFromYearMonth } from "@/lib/dates";
import { setupBudgetPath } from "@/lib/setup-urls";
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
  activeMonthlyLines: BudgetLineRow[];
  prevMonth: string;
  nextMonth: string;
};

export function BudgetPageHero({
  month,
  currency,
  totals,
  activeMonthlyLines,
  prevMonth,
  nextMonth,
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
      ? "text-emerald-800"
      : savingsHealth.tone === "low"
        ? "text-amber-800"
        : "text-zinc-700";

  return (
    <section
      id="budget-hero"
      className="scroll-mt-4 overflow-hidden rounded-3xl border border-zinc-200/80 bg-linear-to-br from-white via-teal-50/30 to-zinc-50/90 p-6 shadow-sm sm:p-8"
    >
      <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-teal-700/80">
            Monthly spending plan
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 sm:text-4xl">
            Your plan for {title}
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-zinc-600">
            A calm view of what you intended to spend, what is left, and how
            your essentials, lifestyle, and savings balance out — no spreadsheet
            required.
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-zinc-600">
            <Link
              className={`${appInlineLinkClass} font-medium`}
              href={setupBudgetPath(prevMonth, yearFromYearMonth(prevMonth))}
            >
              Previous month
            </Link>
            <span className="font-mono text-xs text-zinc-400">{month}</span>
            <Link
              className={`${appInlineLinkClass} font-medium`}
              href={setupBudgetPath(nextMonth, yearFromYearMonth(nextMonth))}
            >
              Next month
            </Link>
            <BudgetMonthJump month={month} />
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-8">
          <div className="relative">
            <BudgetRingProgress ratio={ratio} overBudget={!agg.onTrack} />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Used
              </span>
              <span className="text-lg font-semibold tabular-nums text-zinc-900">
                {planned > 0
                  ? `${Math.min(100, Math.round(ratio * 100))}%`
                  : "—"}
              </span>
            </div>
          </div>
          <dl className="grid w-full max-w-xs grid-cols-2 gap-x-4 gap-y-3 text-sm sm:max-w-sm">
            <div className="rounded-2xl bg-white/80 px-3 py-2 shadow-sm ring-1 ring-zinc-100">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Planned
              </dt>
              <dd className="mt-0.5 font-semibold tabular-nums text-zinc-900">
                {formatCurrency(planned, currency)}
              </dd>
            </div>
            <div className="rounded-2xl bg-white/80 px-3 py-2 shadow-sm ring-1 ring-zinc-100">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Logged
              </dt>
              <dd className="mt-0.5 font-semibold tabular-nums text-zinc-900">
                {formatCurrency(spent, currency)}
              </dd>
            </div>
            <div className="col-span-2 rounded-2xl bg-white/80 px-3 py-2 shadow-sm ring-1 ring-zinc-100">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
                Breathing room (budgeted categories)
              </dt>
              <dd
                className={
                  totals.remaining < 0
                    ? "mt-0.5 font-semibold tabular-nums text-red-600"
                    : "mt-0.5 font-semibold tabular-nums text-emerald-800"
                }
              >
                {formatCurrency(totals.remaining, currency)}
              </dd>
            </div>
            <div className="col-span-2 rounded-2xl border border-dashed border-teal-200/80 bg-teal-50/40 px-3 py-2">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-teal-800">
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
