"use client";

import type { ReactNode } from "react";
import type { AgeAssetBreakdownPoint } from "@/data/age-asset-breakdown";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  fpChartAxisTick,
  fpChartGridColor,
  fpChartTooltipProps,
} from "@/ui/chart-styles";
import { ChartFrame } from "@/ui/ChartFrame";
import { useNarrowScreen } from "@/ui/use-narrow-screen";

const STACK = "assets";

const fills = {
  investments: "#0d9488",
  cash: "#99f6e4",
  cpf: "#6366f1",
  vehiclesNet: "#f59e0b",
} as const;

function formatMoney(n: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

function TooltipDetail({
  title,
  amount,
  accentClass,
  children,
}: {
  title: string;
  amount: string;
  accentClass: string;
  children: ReactNode;
}) {
  return (
    <details className="group border-b border-slate-600/50 py-1 last:border-b-0">
      <summary
        className={`flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-0.5 py-1 text-[11px] font-semibold marker:content-none touch-manipulation [&::-webkit-details-marker]:hidden sm:min-h-0 sm:py-0.5 ${accentClass}`}
      >
        <span className="min-w-0 flex-1 truncate">{title}</span>
        <span className="shrink-0 font-mono tabular-nums text-slate-100">{amount}</span>
      </summary>
      <div className="mt-1.5 pl-0.5 text-[10px] font-normal leading-snug text-slate-300">
        {children}
      </div>
    </details>
  );
}

function AssetTooltip({
  active,
  payload,
  label,
  currency,
  budgetMonth,
  surplusSpendUsesLogged,
  compact,
  annualBonusTakeHomeNet,
  annualBonusPayoutMonth,
}: {
  active?: boolean;
  payload?: Array<{ payload: AgeAssetBreakdownPoint }>;
  label?: string;
  currency: string;
  /** Expenses month (YYYY-MM) for surplus copy; omit if unknown. */
  budgetMonth?: string;
  /**
   * When false, surplus still uses planned monthly budget until any expense is logged
   * for `budgetMonth`.
   */
  surplusSpendUsesLogged?: boolean;
  /** Small screens: flat amounts only (no expandable blocks over the legend). */
  compact?: boolean;
  /** When set, cash path includes this amount once per payout month each year. */
  annualBonusTakeHomeNet?: number | null;
  annualBonusPayoutMonth?: number;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const bonusMonthLabel =
    annualBonusPayoutMonth != null &&
    annualBonusPayoutMonth >= 1 &&
    annualBonusPayoutMonth <= 12
      ? new Date(2020, annualBonusPayoutMonth - 1, 15).toLocaleString(undefined, {
          month: "long",
        })
      : null;
  const hasBonusCashModel =
    (annualBonusTakeHomeNet ?? 0) > 0 && bonusMonthLabel != null;
  const monthPhrase =
    budgetMonth == null
      ? "Log expenses on the Expenses page to align spend totals with the dashboard month."
      : surplusSpendUsesLogged === false
        ? `No expenses logged for ${budgetMonth} yet — projected cash uses the sum of active monthly budget lines for that month. After you log any expense in ${budgetMonth}, the chart uses logged totals instead.`
        : `Expenses for ${budgetMonth} come from the Expenses page (same basis as savings rate and cash surplus here).`;

  if (compact) {
    return (
      <div
        className="box-border min-w-0 max-w-[calc(100vw-1.5rem)] rounded-xl border border-slate-500/40 px-3 py-2.5 shadow-xl sm:max-w-[18rem]"
        style={fpChartTooltipProps.contentStyle}
      >
        <p className="mb-2 border-b border-slate-500/50 pb-1.5 text-xs font-semibold text-slate-200">
          Age {label}
        </p>
        <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-1.5 text-[11px] leading-tight text-slate-200">
          <dt className="text-teal-200/95">Investments</dt>
          <dd className="text-right font-mono tabular-nums text-slate-50">
            {formatMoney(row.investments, currency)}
          </dd>
          <dt className="text-teal-100/90">Cash</dt>
          <dd className="text-right font-mono tabular-nums text-slate-50">
            {formatMoney(row.cash, currency)}
          </dd>
          <dt className="text-indigo-200">CPF (total)</dt>
          <dd className="text-right font-mono tabular-nums text-slate-50">
            {formatMoney(row.cpf, currency)}
          </dd>
          <dt className="pl-2 text-[10px] font-normal text-slate-400">OA</dt>
          <dd className="text-right font-mono text-[10px] tabular-nums text-slate-300">
            {formatMoney(row.cpfOa ?? 0, currency)}
          </dd>
          <dt className="pl-2 text-[10px] font-normal text-slate-400">SA</dt>
          <dd className="text-right font-mono text-[10px] tabular-nums text-slate-300">
            {formatMoney(row.cpfSa ?? 0, currency)}
          </dd>
          <dt className="pl-2 text-[10px] font-normal text-slate-400">MA</dt>
          <dd className="text-right font-mono text-[10px] tabular-nums text-slate-300">
            {formatMoney(row.cpfMa ?? 0, currency)}
          </dd>
          {(row.cpfCpfis ?? 0) > 0.5 ? (
            <>
              <dt className="pl-2 text-[10px] font-normal text-slate-400">CPFIS</dt>
              <dd className="text-right font-mono text-[10px] tabular-nums text-slate-300">
                {formatMoney(row.cpfCpfis ?? 0, currency)}
              </dd>
            </>
          ) : null}
          <dt className="text-amber-200/95">Vehicles (net)</dt>
          <dd className="text-right font-mono tabular-nums text-slate-50">
            {formatMoney(row.vehiclesNet, currency)}
          </dd>
          <dt className="text-rose-200/95">Debts</dt>
          <dd className="text-right font-mono tabular-nums text-slate-50">
            −{formatMoney(row.liabilities, currency)}
          </dd>
          <dt className="border-t border-slate-500/50 pt-1.5 font-semibold text-white">
            Net
          </dt>
          <dd className="border-t border-slate-500/50 pt-1.5 text-right font-mono font-semibold tabular-nums text-white">
            {formatMoney(row.value, currency)}
          </dd>
          <dt className="pt-1 text-[10px] font-medium text-slate-400">
            Net excl. CPF
          </dt>
          <dd className="pt-1 text-right font-mono text-[11px] font-semibold tabular-nums text-slate-200">
            {formatMoney(row.value - row.cpf, currency)}
          </dd>
        </dl>
        <p className="mt-2 text-[10px] leading-snug text-slate-500">
          Wider screen: expandable rows in this tooltip. How it works → methodology
          for full rules.
        </p>
        {hasBonusCashModel && annualBonusTakeHomeNet != null ? (
          <p className="mt-1.5 text-[10px] leading-snug text-slate-400">
            Cash path: annual bonus take-home{" "}
            <span className="font-mono text-slate-300">
              {formatMoney(annualBonusTakeHomeNet, currency)}
            </span>{" "}
            added once each {bonusMonthLabel} (not in monthly income).
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className="box-border min-w-0 max-w-[calc(100vw-1.25rem)] sm:max-w-[20rem]"
      style={fpChartTooltipProps.contentStyle}
    >
      <p style={{ ...fpChartTooltipProps.labelStyle, marginBottom: 6 }}>
        Age {label} · OA/SA/MA under CPF; tap other rows for detail
      </p>
      <div className="max-h-[min(70vh,22rem)] overflow-y-auto pr-0.5">
        <TooltipDetail
          title="Investments"
          amount={formatMoney(row.investments, currency)}
          accentClass="text-teal-200"
        >
          <ul className="list-disc space-y-1 pl-3.5">
            <li>
              Every <strong>Balances → Investment account</strong>: current value,
              monthly contribution, and expected annual return.
            </li>
            <li>
              Accounts are <strong>merged into one pool</strong> for this chart, with
              a balance-weighted average return.
            </li>
            <li>
              Only the <strong>monthly contribution</strong> you enter on each
              account is applied; take-home minus expenses is{" "}
              <strong>not</strong> treated as extra contributions here. {monthPhrase}
            </li>
            <li>
              This point is <strong>compounded forward</strong> to the horizon date
              for this age (approx. months from today).
            </li>
          </ul>
        </TooltipDetail>
        <TooltipDetail
          title="Cash"
          amount={formatMoney(row.cash, currency)}
          accentClass="text-teal-200/95"
        >
          <ul className="list-disc space-y-1 pl-3.5">
            <li>
              <strong>Balances → Cash</strong> today, plus{" "}
              <strong>take-home minus spend basis</strong> for the dashboard month
              (logged expenses when any exist in that month, otherwise planned monthly
              budget), times months forward (same surplus each month in this model),
              plus any modeled vehicle cash-in.
            </li>
            <li>
              After COE, <strong>modeled net at deregistration</strong> (rebates /
              terminal / OTR paths only) is added here once when applicable — not when
              gross is <strong>listing-only</strong> (typical motorcycles), so cash
              does not jump for a sale the model does not assume.
            </li>
            {hasBonusCashModel && annualBonusTakeHomeNet != null ? (
              <li>
                If you entered an <strong>annual bonus</strong> on Setup → Income, its
                take-home after employee CPF on additional wages is added once each{" "}
                <strong>{bonusMonthLabel}</strong> (
                {formatMoney(annualBonusTakeHomeNet, currency)} per year in this
                model), on top of the repeating monthly surplus.
              </li>
            ) : null}
          </ul>
        </TooltipDetail>
        <div className="border-b border-slate-600/50 py-1.5 last:border-b-0">
          <div className="flex items-center justify-between gap-3 text-[11px] font-semibold text-indigo-200">
            <span className="min-w-0 flex-1 truncate">CPF (projected)</span>
            <span className="shrink-0 font-mono tabular-nums text-slate-100">
              {formatMoney(row.cpf, currency)}
            </span>
          </div>
          <div className="mt-1.5 space-y-0.5 border-l border-indigo-500/30 pl-2 font-mono text-[11px] tabular-nums leading-snug text-slate-200 sm:text-[10px]">
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">OA</span>
              <span>{formatMoney(row.cpfOa ?? 0, currency)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">SA</span>
              <span>{formatMoney(row.cpfSa ?? 0, currency)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-400">MA</span>
              <span>{formatMoney(row.cpfMa ?? 0, currency)}</span>
            </div>
            {(row.cpfCpfis ?? 0) > 0.5 ? (
              <div className="flex justify-between gap-4">
                <span className="text-slate-400">CPFIS</span>
                <span>{formatMoney(row.cpfCpfis ?? 0, currency)}</span>
              </div>
            ) : null}
          </div>
          <details className="group mt-1.5">
            <summary className="min-h-10 cursor-pointer list-none py-1.5 text-xs font-medium text-slate-400 marker:content-none touch-manipulation [&::-webkit-details-marker]:hidden hover:text-slate-300 sm:min-h-0 sm:py-0 sm:text-[10px]">
              How this is calculated
            </summary>
            <ul className="mt-1 list-disc space-y-1 pl-3.5 text-[10px] font-normal leading-snug text-slate-300">
              <li>
                Same month-step model as the blue CPF-by-age chart:{" "}
                <strong>Balances → CPF</strong> balances, gross salary (and growth),
                age band, optional CPFIS, and <strong>housing loan</strong> OA lumps
                / instalment share when saved.
              </li>
              <li>
                <strong>OA</strong> is usually what you can direct toward housing
                first (within limits); withdrawal rules are not fully modeled here.
              </li>
            </ul>
          </details>
        </div>
        <TooltipDetail
          title="Vehicles (net)"
          amount={formatMoney(row.vehiclesNet, currency)}
          accentClass="text-amber-200"
        >
          <ul className="list-disc space-y-1 pl-3.5">
            <li>
              <strong>Active</strong> vehicles from Balances with the Singapore
              valuation path you configured (PARF/COE, OTR→terminal, or market value).
            </li>
            <li>
              <strong>Net</strong> = modeled gross − modeled loan balance at the
              horizon date.
            </li>
            <li>
              <strong>0</strong> after the COE calendar month. Cash increases only if
              your vehicle path models net proceeds at COE (not listing-only gross).
            </li>
          </ul>
        </TooltipDetail>
        <TooltipDetail
          title="Debts (Cash & liabilities)"
          amount={`−${formatMoney(row.liabilities, currency)}`}
          accentClass="text-rose-200"
        >
          <ul className="list-disc space-y-1 pl-3.5">
            <li>
              Sum of <strong>Balances → Cash &amp; liabilities</strong> liability
              rows only (credit cards, loans you list there).
            </li>
            <li>
              <strong>Housing mortgage</strong> rows are <strong>not</strong> here —
              they feed the CPF OA projection instead.
            </li>
          </ul>
        </TooltipDetail>
        <TooltipDetail
          title="Net after debts"
          amount={formatMoney(row.value, currency)}
          accentClass="text-white"
        >
          <ul className="list-disc space-y-1 pl-3.5">
            <li>
              <strong>Investments + Cash + CPF + Vehicles −</strong> generic debts
              above.
            </li>
            <li>Same total as the dark line on the chart for this age.</li>
          </ul>
        </TooltipDetail>
        <TooltipDetail
          title="Net excluding CPF"
          amount={formatMoney(row.value - row.cpf, currency)}
          accentClass="text-slate-200"
        >
          <ul className="list-disc space-y-1 pl-3.5">
            <li>
              Full net for this age <strong>minus</strong> projected CPF total
              (OA+SA+MA+CPFIS). A liquidity-style read; rules on actual withdrawals
              are not modeled here.
            </li>
          </ul>
        </TooltipDetail>
      </div>
    </div>
  );
}

export function AgeCombinedAssetsProjectionChart({
  data,
  currency,
  budgetMonth,
  surplusSpendUsesLogged,
  annualBonusTakeHomeNet,
  annualBonusPayoutMonth,
}: {
  data: AgeAssetBreakdownPoint[];
  currency: string;
  /** Dashboard `YYYY-MM` for expense/surplus wording in the tooltip. */
  budgetMonth?: string;
  /** False when dashboard uses planned budget because no expenses logged yet. */
  surplusSpendUsesLogged?: boolean;
  annualBonusTakeHomeNet?: number | null;
  annualBonusPayoutMonth?: number;
}) {
  const narrow = useNarrowScreen();

  if (!data.length) return null;

  return (
    <ChartFrame
      className="h-64 min-h-[220px] sm:h-80 sm:min-h-0"
      clipContent={false}
    >
      <div className="h-full w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <ComposedChart
            data={data}
            margin={{ top: 4, right: 4, left: 0, bottom: 24 }}
          >
            <CartesianGrid
              strokeDasharray="3 6"
              stroke={fpChartGridColor}
              vertical={false}
            />
            <XAxis
              dataKey="age"
              tick={fpChartAxisTick}
              axisLine={{ stroke: fpChartGridColor }}
              tickLine={false}
              label={{
                value: "Age",
                position: "insideBottom",
                offset: -2,
                style: { fontSize: 11, fill: "#64748b", fontWeight: 500 },
              }}
            />
            <YAxis
              width={44}
              tick={{ ...fpChartAxisTick, fontSize: 10 }}
              tickMargin={4}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) =>
                new Intl.NumberFormat(undefined, {
                  notation: "compact",
                  maximumFractionDigits: 1,
                }).format(v as number)
              }
            />
            <Tooltip
              content={
                <AssetTooltip
                  currency={currency}
                  budgetMonth={budgetMonth}
                  surplusSpendUsesLogged={surplusSpendUsesLogged}
                  compact={narrow}
                  annualBonusTakeHomeNet={annualBonusTakeHomeNet}
                  annualBonusPayoutMonth={annualBonusPayoutMonth}
                />
              }
              allowEscapeViewBox={{ x: true, y: false }}
              wrapperStyle={{ zIndex: 80, outline: "none", pointerEvents: "none" }}
              cursor={{ stroke: "#94a3b8", strokeWidth: 1, strokeDasharray: "4 4" }}
              isAnimationActive={false}
            />
            <Legend
              verticalAlign="top"
              align="left"
              wrapperStyle={{
                fontSize: narrow ? 9 : 10,
                paddingBottom: 6,
                width: "100%",
                maxWidth: "100%",
                lineHeight: 1.25,
              }}
              formatter={(value) => (
                <span className="text-slate-600">{value}</span>
              )}
            />
            <Area
              type="monotone"
              dataKey="investments"
              name="Investments"
              stackId={STACK}
              fill={fills.investments}
              stroke={fills.investments}
              strokeWidth={0.5}
              fillOpacity={0.9}
            />
            <Area
              type="monotone"
              dataKey="cash"
              name="Cash"
              stackId={STACK}
              fill={fills.cash}
              stroke="#14b8a6"
              strokeWidth={0.5}
              fillOpacity={0.95}
            />
            <Area
              type="monotone"
              dataKey="cpf"
              name="CPF (projected)"
              stackId={STACK}
              fill={fills.cpf}
              stroke="#4338ca"
              strokeWidth={0.5}
              fillOpacity={0.88}
            />
            <Area
              type="monotone"
              dataKey="vehiclesNet"
              name="Vehicles (net)"
              stackId={STACK}
              fill={fills.vehiclesNet}
              stroke="#b45309"
              strokeWidth={0.5}
              fillOpacity={0.88}
            />
            <Line
              type="monotone"
              dataKey="value"
              name="Net after debts"
              stroke="#0f172a"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "#0f172a", stroke: "#fff", strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
