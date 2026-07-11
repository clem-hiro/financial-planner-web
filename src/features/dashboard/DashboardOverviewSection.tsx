import Link from "next/link";
import type { DashboardPayload } from "@/data/dashboard";
import { yearFromYearMonth, formatYearMonthLong } from "@/lib/dates";
import { setupBudgetPath } from "@/lib/setup-urls";
import { appInlineLinkClass } from "@/ui/app-link-styles";
import { appBrandNavyTextStyle } from "@/ui/app-tab-styles";
import { InfoTooltip } from "@/ui/InfoTooltip";
import { appCardClass } from "@/ui/surface-classes";
import { formatCurrency } from "@/ui/lib/format";

const labelClass =
  "text-xs font-medium text-slate-600 dark:text-slate-300";
const monthlyCardShell = `${appCardClass} flex h-full flex-col bg-linear-to-br from-white via-white to-slate-50/50 p-4 transition-[box-shadow,transform] duration-200 hover:-translate-y-px hover:shadow-md hover:shadow-slate-900/8 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900/60 sm:p-5`;
const figureClass =
  "mt-1.5 font-mono text-xl font-semibold tracking-tight tabular-nums sm:text-2xl";

export function DashboardOverviewSection({
  payload,
}: {
  payload: DashboardPayload;
}) {
  const monthLabel = formatYearMonthLong(payload.month);
  const hasLoggedSpend = payload.monthlyExpensesLoggedTotal > 0;
  const hasBudgetForecast = payload.monthlyPlannedMonthlyBudgetTotal > 0;
  const expensesAction = hasLoggedSpend
    ? { href: "/expenses", label: "View expenses" }
    : hasBudgetForecast
      ? {
          href: setupBudgetPath(
            payload.month,
            yearFromYearMonth(payload.month)
          ),
          label: "Edit budget",
        }
      : {
          href: setupBudgetPath(
            payload.month,
            yearFromYearMonth(payload.month)
          ),
          label: "Set up budget",
        };
  const showSetupPrompt = payload.investmentSummary.count === 0;
  const leftAfterExpenses = payload.takeHomeMinusExpenses;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {monthLabel}
        </p>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          This month&apos;s income and planned spend
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div
          className={`${monthlyCardShell} border-l-[3px] border-l-emerald-600 ring-1 ring-emerald-100/80 dark:ring-emerald-900/40`}
        >
          <div className="flex flex-wrap items-center gap-1">
            <p
              className={`${labelClass} font-semibold text-emerald-800 dark:text-emerald-200`}
            >
              Income
            </p>
            <InfoTooltip
              variant="emerald"
              ariaLabel="How monthly income is calculated"
            >
              Salary take-home from Setup → Profile, plus any other monthly
              take-home you added there (side hustle, freelance, etc.). Rental on
              Housing is separate and not included here.
            </InfoTooltip>
          </div>
          <p className={`${figureClass} text-emerald-950 dark:text-emerald-50`}>
            {payload.monthlyTakeHome != null
              ? formatCurrency(payload.monthlyTakeHome, payload.baseCurrency)
              : "Set income"}
          </p>
          {payload.monthlyTakeHome == null ? (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              <Link href="/setup?tab=profile" className={appInlineLinkClass}>
                Edit profile
              </Link>
            </p>
          ) : null}
        </div>

        <div className={monthlyCardShell}>
          <div className="flex flex-wrap items-center gap-1">
            <p className={labelClass}>Expenses</p>
            <InfoTooltip ariaLabel="How monthly expenses are calculated">
              Uses your monthly budget by default. Switches to logged expenses
              when any expense exists for this month.
            </InfoTooltip>
          </div>
          <p className={figureClass} style={appBrandNavyTextStyle}>
            {formatCurrency(
              payload.monthlyExpensesTotal,
              payload.baseCurrency
            )}
          </p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {hasLoggedSpend ? (
              <>Based on logged expenses.</>
            ) : hasBudgetForecast ? (
              <>Based on monthly budget.</>
            ) : (
              <>No budget or expenses yet.</>
            )}{" "}
            <Link href={expensesAction.href} className={appInlineLinkClass}>
              {expensesAction.label}
            </Link>
          </p>
        </div>

        <div className={monthlyCardShell}>
          <div className="flex flex-wrap items-center gap-1">
            <p className={labelClass}>Left after expenses</p>
            <InfoTooltip ariaLabel="How left after expenses is calculated">
              Income minus this month&apos;s expenses. Goal contributions are not
              subtracted here — see Goals &amp; cash flow below when you have
              planned goal amounts.
            </InfoTooltip>
          </div>
          <p
            className={
              leftAfterExpenses != null && leftAfterExpenses < 0
                ? `${figureClass} text-amber-900 dark:text-amber-200`
                : figureClass
            }
            style={
              leftAfterExpenses != null && leftAfterExpenses < 0
                ? undefined
                : appBrandNavyTextStyle
            }
          >
            {leftAfterExpenses != null
              ? formatCurrency(leftAfterExpenses, payload.baseCurrency)
              : "Set income"}
          </p>
        </div>
      </div>

      <div
        className={`${monthlyCardShell} relative overflow-hidden border-l-[3px] border-l-emerald-600`}
      >
        <div className="pointer-events-none absolute -right-8 -top-12 h-32 w-32 rounded-full bg-emerald-500/5 blur-2xl" />
        <div className="relative space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1">
                <p className={labelClass}>Net worth</p>
                <InfoTooltip ariaLabel="How net worth is calculated">
                  Investments + cash + property and vehicle equity + optional CPF,
                  minus debts.
                </InfoTooltip>
              </div>
              <p
                className="mt-1 font-mono text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl"
                style={appBrandNavyTextStyle}
              >
                {formatCurrency(payload.netWorth, payload.baseCurrency)}
              </p>
              {payload.netWorthBreakdown.cpf > 0 ? (
                <p className="mt-1 flex flex-wrap items-center gap-1 text-sm text-slate-600 dark:text-slate-300">
                  <span>
                    Net excluding CPF:{" "}
                    <span className="font-mono font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                      {formatCurrency(
                        payload.netWorthExcludingCpf,
                        payload.baseCurrency
                      )}
                    </span>
                  </span>
                  <InfoTooltip ariaLabel="How net excluding CPF relates to full net worth">
                    Liquid picture: investments, cash, property and vehicles minus
                    debts; CPF omitted.
                  </InfoTooltip>
                </p>
              ) : null}
            </div>
            <p className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
              <Link
                href="/setup?tab=add-account#add-investment"
                className={appInlineLinkClass}
              >
                Setup
              </Link>
              <span className="text-slate-400 dark:text-slate-500"> · </span>
              {payload.investmentSummary.count} linked account
              {payload.investmentSummary.count === 1 ? "" : "s"}
            </p>
          </div>

          {showSetupPrompt ? (
            <p className="rounded-lg border border-slate-200/80 bg-slate-50/80 px-3 py-2 text-xs leading-relaxed text-slate-600 dark:border-slate-700/80 dark:bg-slate-900/50 dark:text-slate-300">
              Add investments or cash accounts in{" "}
              <Link
                href="/setup?tab=add-account#add-investment"
                className={appInlineLinkClass}
              >
                Setup
              </Link>{" "}
              to refine this total.
            </p>
          ) : null}

          <ul className="grid gap-x-8 gap-y-1 border-t border-slate-100/80 pt-3 font-mono text-sm tabular-nums text-slate-700 dark:border-slate-700/80 dark:text-slate-200 sm:grid-cols-2 sm:max-w-xl">
            <li>
              Investments{" "}
              {formatCurrency(
                payload.netWorthBreakdown.investments,
                payload.baseCurrency
              )}
            </li>
            <li>
              Cash{" "}
              {formatCurrency(
                payload.netWorthBreakdown.cash,
                payload.baseCurrency
              )}
            </li>
            {payload.hasCpfBalanceRecord && (
              <li>
                CPF{" "}
                {formatCurrency(
                  payload.netWorthBreakdown.cpf,
                  payload.baseCurrency
                )}
              </li>
            )}
            {payload.netWorthBreakdown.propertyCount > 0 && (
              <li className="flex flex-wrap items-baseline gap-x-1.5">
                <span>
                  Property equity{" "}
                  {formatCurrency(
                    payload.netWorthBreakdown.propertiesNet,
                    payload.baseCurrency
                  )}
                </span>
                <InfoTooltip ariaLabel="How property equity is estimated">
                  Current owned valuation less linked mortgage balances.
                </InfoTooltip>
              </li>
            )}
            <li>
              Debts (Cash &amp; liabilities){" "}
              <span className="text-rose-600 dark:text-rose-300">
                −
                {formatCurrency(
                  payload.netWorthBreakdown.liabilities,
                  payload.baseCurrency
                )}
              </span>
            </li>
            {payload.netWorthBreakdown.vehicleCount > 0 && (
              <li className="flex flex-wrap items-baseline gap-x-1.5">
                <span>
                  Vehicles (est.){" "}
                  {formatCurrency(
                    payload.netWorthBreakdown.vehiclesGrossAsset,
                    payload.baseCurrency
                  )}
                </span>
                <InfoTooltip ariaLabel="How vehicle value is estimated">
                  Estimated market value less loan.
                </InfoTooltip>
              </li>
            )}
          </ul>
          {payload.investmentSummary.count > 0 ? (
            <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              Investment totals use balances and return assumptions you entered —
              not live portfolio data.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
