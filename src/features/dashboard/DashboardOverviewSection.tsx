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
  "text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500";
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
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      <div
        className={`${metricCard} relative overflow-hidden border-l-[3px] border-l-emerald-600`}
      >
        <div className="pointer-events-none absolute -right-8 -top-12 h-32 w-32 rounded-full bg-emerald-500/[0.07] blur-2xl" />
        <div className="relative flex flex-wrap items-center gap-1">
          <p className={labelClass}>Net worth</p>
          <InfoTooltip ariaLabel="How net worth is calculated">
            Investments + cash + optional CPF and vehicle equity, minus debts.
          </InfoTooltip>
        </div>
        <p className={figureClass} style={appBrandNavyTextStyle}>
          {formatCurrency(payload.netWorth, payload.baseCurrency)}
        </p>
        {payload.netWorthBreakdown.cpf > 0 && (
          <div className="relative mt-5 border-t border-slate-100 pt-5">
            <div className="flex flex-wrap items-center gap-1">
              <p className={labelClass}>Net excluding CPF</p>
              <InfoTooltip ariaLabel="How net excluding CPF relates to full net worth">
                Investments + cash + vehicles minus debts; CPF balances omitted.
              </InfoTooltip>
            </div>
            <p className="mt-2 font-mono text-xl font-semibold tracking-tight text-slate-800 tabular-nums sm:text-2xl">
              {formatCurrency(
                payload.netWorthExcludingCpf,
                payload.baseCurrency
              )}
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
              Investments + cash + vehicles − debts; CPF balances omitted for a
              more liquid picture.
            </p>
          </div>
        )}
        <details className="relative mt-3 text-xs text-slate-600">
          <summary className="cursor-pointer select-none font-medium text-slate-500 hover:text-slate-800">
            Breakdown
          </summary>
          <ul className="mt-2 space-y-1 border-t border-slate-100/80 pt-2 font-mono tabular-nums">
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
            <li>
              Debts (Cash &amp; liabilities){" "}
              <span className="text-rose-600">
                −
                {formatCurrency(
                  payload.netWorthBreakdown.liabilities,
                  payload.baseCurrency
                )}
              </span>
            </li>
            {payload.netWorthBreakdown.vehicleCount > 0 && (
              <li className="flex flex-wrap items-baseline gap-x-1.5 text-zinc-600">
                <span>
                  Vehicles (est.){" "}
                  {formatCurrency(
                    payload.netWorthBreakdown.vehiclesGrossAsset,
                    payload.baseCurrency
                  )}
                </span>
                <InfoTooltip ariaLabel="How vehicle value is estimated">
                  Estimated market value less loan; approximate listing or resale-based estimate.
                </InfoTooltip>
              </li>
            )}
          </ul>
        </details>
        <p className="relative mt-2 text-xs text-slate-500">
          <Link href="/setup#balances-accounts" className={appInlineLinkClass}>
            Setup
          </Link>
          <span className="text-slate-400"> · </span>
          {payload.investmentSummary.count} linked account
          {payload.investmentSummary.count === 1 ? "" : "s"}
        </p>
        {payload.investmentSummary.count > 0 ? (
          <p className="relative mt-1 text-[11px] leading-relaxed text-slate-500">
            Investment totals use balances and return assumptions you entered—not live
            portfolio data.
          </p>
        ) : null}
      </div>
      <div className={`${metricCard} bg-linear-to-br from-white via-white to-sky-50/45`}>
        <div className="flex flex-wrap items-center gap-1">
          <p className={labelClass}>Savings rate</p>
          <InfoTooltip ariaLabel="How savings rate is calculated">
            Share of take-home left after this month&apos;s expenses and planned
            monthly goal contributions. Spend uses logged expenses when present,
            otherwise planned monthly budget.
          </InfoTooltip>
        </div>
        <p className={figureClass} style={appBrandNavyTextStyle}>{formatPercent(payload.savingsRate)}</p>
        <p className="mt-2 text-xs text-slate-500">
          Take-home − spend basis − planned goals ({currency})
        </p>
      </div>
      <div className={`${metricCard} bg-linear-to-br from-white via-white to-amber-50/35 sm:col-span-2 xl:col-span-1`}>
        <div className="flex flex-wrap items-center gap-1">
          <p className={labelClass}>Spend basis (this month)</p>
          <InfoTooltip ariaLabel="How monthly spend basis is calculated">
            Monthly take-home used to calculate budgets and savings rate; uses logged expenses when present.
          </InfoTooltip>
        </div>
        <p className={figureClass} style={appBrandNavyTextStyle}>
          {formatCurrency(
            payload.monthlyExpensesTotal,
            payload.baseCurrency
          )}
        </p>
        <p className="mt-2 text-xs text-slate-500">
          {payload.monthlyExpensesLoggedTotal > 0 ? (
            <>
              Logged {formatCurrency(payload.monthlyExpensesLoggedTotal, currency)}
              . Same total drives savings rate and cash projection.
            </>
          ) : payload.monthlyPlannedMonthlyBudgetTotal > 0 ? (
            <>
              Forecast from monthly budget (
              {formatCurrency(payload.monthlyPlannedMonthlyBudgetTotal, currency)}
              ); logs replace this once you add any expense in {payload.month}.
            </>
          ) : (
            <>No monthly budget lines and no expenses—add either to model spend.</>
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
  );
}
