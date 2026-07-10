import Link from "next/link";
import type { DashboardPayload } from "@/data/dashboard";
import { yearFromYearMonth } from "@/lib/dates";
import { planningCashFlowBudgetPath } from "@/lib/setup-urls";
import { appInlineLinkClass } from "@/ui/app-link-styles";
import { appBrandNavyTextStyle } from "@/ui/app-tab-styles";
import { InfoTooltip } from "@/ui/InfoTooltip";
import { appCardClass, appCardPadding } from "@/ui/surface-classes";
import { formatCurrency, formatPercent } from "@/ui/lib/format";

const labelClass =
  "text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400";
const metricCard = `${appCardClass} ${appCardPadding} transition-[box-shadow,transform] duration-200 hover:-translate-y-px hover:shadow-md hover:shadow-slate-900/8`;
const figureClass =
  "mt-3 font-mono text-2xl font-semibold tracking-tight tabular-nums sm:text-[1.65rem]";

export function DashboardOverviewSection({
  payload,
  currency,
}: {
  payload: DashboardPayload;
  currency: string;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <div
          className={`${metricCard} flex h-full flex-col border border-emerald-200/70 bg-emerald-50/80 dark:border-emerald-300/35 dark:bg-emerald-950/35`}
        >
          <div className="flex flex-wrap items-center gap-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-800 dark:text-emerald-200">
              Safe to spend
            </p>
            <InfoTooltip ariaLabel="How safe to spend is calculated">
              Take-home minus this month&apos;s spend basis and planned monthly goal
              contributions. Shown as zero when negative.
            </InfoTooltip>
          </div>
          <p className={`${figureClass} text-emerald-950 dark:text-emerald-50`}>
            {payload.discretionaryAfterGoals != null
              ? formatCurrency(
                  Math.max(0, payload.discretionaryAfterGoals),
                  payload.baseCurrency
                )
              : "Set income"}
          </p>
          <p className="mt-2 text-xs text-emerald-900/85 dark:text-emerald-100/80">
            Monthly buffer after spend basis and planned goals.
          </p>
        </div>

        <div
          className={`${metricCard} flex h-full flex-col bg-linear-to-br from-white via-white to-sky-50/45 dark:from-slate-950 dark:via-slate-900 dark:to-sky-950/35`}
        >
          <div className="flex flex-wrap items-center gap-1">
            <p className={labelClass}>Savings rate</p>
            <InfoTooltip ariaLabel="How savings rate is calculated">
              Share of take-home left after this month&apos;s expenses and planned
              monthly goal contributions. Spend uses logged expenses when present,
              otherwise planned monthly budget.
            </InfoTooltip>
          </div>
          <p className={figureClass} style={appBrandNavyTextStyle}>
            {formatPercent(payload.savingsRate)}
          </p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Take-home − spend basis − planned goals ({currency})
          </p>
        </div>

        <div
          className={`${metricCard} flex h-full flex-col bg-linear-to-br from-white via-white to-amber-50/35 dark:from-slate-950 dark:via-slate-900 dark:to-amber-950/25`}
        >
          <div className="flex flex-wrap items-center gap-1">
            <p className={labelClass}>Spend basis (this month)</p>
            <InfoTooltip ariaLabel="How monthly spend basis is calculated">
              Monthly take-home used to calculate budgets and savings rate; uses
              logged expenses when present.
            </InfoTooltip>
          </div>
          <p className={figureClass} style={appBrandNavyTextStyle}>
            {formatCurrency(
              payload.monthlyExpensesTotal,
              payload.baseCurrency
            )}
          </p>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {payload.monthlyExpensesLoggedTotal > 0 ? (
              <>
                Logged{" "}
                {formatCurrency(payload.monthlyExpensesLoggedTotal, currency)}.
              </>
            ) : payload.monthlyPlannedMonthlyBudgetTotal > 0 ? (
              <>
                Forecast from monthly budget (
                {formatCurrency(
                  payload.monthlyPlannedMonthlyBudgetTotal,
                  currency
                )}
                ).
              </>
            ) : (
              <>No monthly budget or expenses yet.</>
            )}{" "}
            <Link href="/expenses" className={appInlineLinkClass}>
              Log / edit
            </Link>
            {" · "}
            <Link
              href={planningCashFlowBudgetPath(
                payload.month,
                yearFromYearMonth(payload.month)
              )}
              className={appInlineLinkClass}
            >
              Budget
            </Link>
          </p>
        </div>
      </div>

      <div
        className={`${metricCard} relative overflow-hidden border-l-[3px] border-l-emerald-600`}
      >
        <div className="pointer-events-none absolute -right-8 -top-12 h-32 w-32 rounded-full bg-emerald-500/[0.07] blur-2xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1">
              <p className={labelClass}>Net worth</p>
              <InfoTooltip ariaLabel="How net worth is calculated">
                Investments + cash + property and vehicle equity + optional CPF,
                minus debts.
              </InfoTooltip>
            </div>
            <p
              className="mt-2 font-mono text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl"
              style={appBrandNavyTextStyle}
            >
              {formatCurrency(payload.netWorth, payload.baseCurrency)}
            </p>
            {payload.netWorthBreakdown.cpf > 0 ? (
              <p className="mt-2 flex flex-wrap items-center gap-1 text-sm text-slate-600 dark:text-slate-300">
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

        <details className="relative mt-4 text-xs text-slate-600 dark:text-slate-300">
          <summary className="cursor-pointer select-none font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100">
            Breakdown
          </summary>
          <ul className="mt-2 grid gap-1 border-t border-slate-100/80 pt-3 font-mono text-sm tabular-nums sm:grid-cols-2 dark:border-slate-700/80">
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
            <p className="mt-3 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              Investment totals use balances and return assumptions you
              entered—not live portfolio data.
            </p>
          ) : null}
        </details>
      </div>
    </div>
  );
}
