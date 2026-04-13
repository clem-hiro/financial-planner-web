import Link from "next/link";
import type { DashboardPayload } from "@/data/dashboard";
import { appInlineLinkClass } from "@/ui/app-link-styles";
import { InfoTooltip } from "@/ui/InfoTooltip";
import { appCardClass, appCardPadding } from "@/ui/surface-classes";
import { formatCurrency, formatPercent } from "@/ui/lib/format";

const labelClass =
  "text-[11px] font-semibold uppercase tracking-wider text-slate-400";
const metricCard = `${appCardClass} ${appCardPadding} transition-[box-shadow,transform] duration-200 hover:shadow-lg hover:shadow-slate-900/10`;
const figureClass =
  "mt-2 font-mono text-2xl font-semibold tracking-tight text-slate-900 tabular-nums";

export function DashboardOverviewSection({
  payload,
  currency,
}: {
  payload: DashboardPayload;
  currency: string;
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <div
        className={`${metricCard} relative overflow-hidden border-l-[3px] border-l-teal-500`}
      >
        <div className="pointer-events-none absolute -right-8 -top-12 h-32 w-32 rounded-full bg-teal-400/10 blur-2xl" />
        <div className="relative flex flex-wrap items-center gap-1">
          <p className={labelClass}>Net worth</p>
          <InfoTooltip
            methodologyTopicId="net-worth"
            ariaLabel="How net worth is calculated"
          >
            <span className="sr-only">Open methodology: net worth</span>
          </InfoTooltip>
        </div>
        <p className={figureClass}>
          {formatCurrency(payload.netWorth, payload.baseCurrency)}
        </p>
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
                <InfoTooltip
                  methodologyTopicId="vehicles-sg"
                  ariaLabel="How vehicle value is estimated"
                >
                  <span className="sr-only">Vehicle methodology</span>
                </InfoTooltip>
              </li>
            )}
          </ul>
        </details>
        <p className="relative mt-2 text-xs text-slate-500">
          <Link href="/balances#assets-liabilities" className={appInlineLinkClass}>
            Balances
          </Link>
          <span className="text-slate-400"> · </span>
          {payload.investmentSummary.count} linked account
          {payload.investmentSummary.count === 1 ? "" : "s"}
        </p>
      </div>
      <div className={metricCard}>
        <div className="flex flex-wrap items-center gap-1">
          <p className={labelClass}>Savings rate</p>
          <InfoTooltip
            methodologyTopicId="savings-rate"
            ariaLabel="How savings rate is calculated"
          >
            <span className="sr-only">Savings rate methodology</span>
          </InfoTooltip>
        </div>
        <p className={figureClass}>{formatPercent(payload.savingsRate)}</p>
        <p className="mt-2 text-xs text-slate-500">
          Take-home − expenses ({currency})
        </p>
      </div>
      <div className={`${metricCard} sm:col-span-2 lg:col-span-1`}>
        <div className="flex flex-wrap items-center gap-1">
          <p className={labelClass}>Expenses (this month)</p>
          <InfoTooltip
            methodologyTopicId="expenses-month"
            ariaLabel="How the expenses month works"
          >
            <span className="sr-only">Expenses month methodology</span>
          </InfoTooltip>
        </div>
        <p className={figureClass}>
          {formatCurrency(
            payload.monthlyExpensesTotal,
            payload.baseCurrency
          )}
        </p>
        <p className="mt-2 text-xs text-slate-500">
          <Link href="/expenses" className={appInlineLinkClass}>
            Log / edit
          </Link>
        </p>
      </div>
    </div>
  );
}
