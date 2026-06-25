"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AgeAssetBreakdownPoint } from "@/data/age-asset-breakdown";
import {
  fpRunwayAxisTick,
  fpRunwayBandFill,
  fpRunwayFundingPalette,
  fpRunwayOutflowPalette,
  fpRunwayTooltipProps,
} from "@/ui/runway-chart-styles";
import {
  deriveMilestones,
  toRunwayRows,
  type RunwayAmountDetail,
  type RunwayMilestone,
  type RunwayRow,
  type RunwaySegment,
} from "./retirement-runway-rows";

const NARROW_PX = 780;
const CHART_PANEL_HEIGHT_CLASS =
  "h-[calc(16rem_+_1rem_+_2px)] sm:h-[calc(20rem_+_1.5rem_+_2px)]";

type ColoredRunwaySegment = RunwaySegment & {
  color: string;
};

type AmountDetail = RunwayAmountDetail & {
  tone?: "bad";
};

function formatMoney(n: number, currency: string) {
  return new Intl.NumberFormat("en-SG", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

function rowValue(row: RunwayRow, key: string): number {
  const value = row[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function colorForSegment(segment: RunwaySegment, index: number): string {
  if (segment.kind === "takehome") return fpRunwayFundingPalette.takehome;
  if (segment.kind === "passive") return fpRunwayFundingPalette.passive;
  if (segment.kind === "yield") return fpRunwayFundingPalette.yield;
  if (segment.kind === "other") return fpRunwayFundingPalette.other;
  if (segment.kind === "drawdown") return fpRunwayFundingPalette.drawdown;
  if (segment.kind === "cash") return fpRunwayOutflowPalette.housing;
  if (segment.kind === "shortfall") return fpRunwayFundingPalette.shortfall;
  return fpRunwayOutflowPalette.categoryCycle[
    index % fpRunwayOutflowPalette.categoryCycle.length
  ];
}

function hasAmount(n: number): boolean {
  return Math.abs(n) > 0.5;
}

function addDetail(
  out: AmountDetail[],
  key: string,
  label: string,
  amount: number,
  tone?: "bad"
): void {
  if (!hasAmount(amount)) return;
  out.push({ key, label, amount, tone });
}

function compactDetails(details: AmountDetail[], maxRows = 6): AmountDetail[] {
  const visible = details.filter((detail) => hasAmount(detail.amount));
  if (visible.length <= maxRows) return visible;
  const head = visible.slice(0, maxRows - 1);
  const tail = visible.slice(maxRows - 1);
  const tailAmount = tail.reduce((sum, detail) => sum + detail.amount, 0);
  return [
    ...head,
    {
      key: "detail:more",
      label: `${tail.length} more`,
      amount: tailAmount,
    },
  ];
}

function fundingDetails(row: RunwayRow, key: string): AmountDetail[] {
  const out: AmountDetail[] = [];
  if (key === "takehome") {
    if (row.rawTakehome > row.takehome + 0.5) {
      addDetail(out, "takehome:available", "Annual available", row.rawTakehome);
    }
  } else if (key === "passive") {
    addDetail(out, "passive:cpf-life", "CPF LIFE", row.rawCpfLife);
    addDetail(out, "passive:rental", "Rental income", row.rawRental);
  } else if (key === "yield") {
    addDetail(out, "yield:dividends", "Investment dividends", row.rawInvestmentDividend);
    addDetail(out, "yield:ilp", "ILP income", row.rawIlpIncome);
  } else if (key === "other") {
    addDetail(out, "other:cash-inflow", "Other annual cash inflow", row.rawOther);
  } else if (key === "drawdown") {
    addDetail(out, "drawdown:planned", "Planned withdrawals", row.rawInvestmentWithdrawal);
    addDetail(
      out,
      "drawdown:investment-principal",
      "Investment principal sold",
      row.rawInvestmentPrincipalWithdrawn
    );
    addDetail(out, "drawdown:ilp-principal", "ILP principal sold", row.rawIlpPrincipalWithdrawn);
    if (
      !hasAmount(row.rawInvestmentPrincipalWithdrawn) &&
      !hasAmount(row.rawIlpPrincipalWithdrawn)
    ) {
      addDetail(out, "drawdown:principal", "Principal sold", row.rawPrincipalWithdrawn);
    }
  } else if (key === "cashReserve") {
    addDetail(out, "cash:spend-down", "Cash balance spend-down", row.cashReserve);
  } else if (key === "shortfall") {
    addDetail(
      out,
      "shortfall:debt",
      "Unpaid debt repayment",
      row.rawUnfundedDebtRepayment,
      "bad"
    );
    addDetail(
      out,
      "shortfall:living",
      "Unfunded living expenses",
      row.rawUnfundedLivingOutflow,
      "bad"
    );
  }
  return out;
}

function requiredOutflowDetails(row: RunwayRow): AmountDetail[] {
  if (row.outflowSegments.length > 0) return row.outflowSegments;
  if (!hasAmount(row.expenses)) return [];
  return [
    {
      key: "outflow:modeled-total",
      label: "Modeled annual outflow",
      amount: row.expenses,
    },
  ];
}

function netWorthDetails(row: RunwayRow): AmountDetail[] {
  const out: AmountDetail[] = [];
  const cpfBucketTotal =
    row.cpfOa + row.cpfSa + row.cpfMa + row.cpfRa + row.cpfCpfis;
  const cpfTotal = hasAmount(row.cpfBalance) ? row.cpfBalance : cpfBucketTotal;
  addDetail(out, "networth:cash", "Cash", row.cashBalance);
  addDetail(out, "networth:investments", "Investments", row.investmentPrincipal);
  addDetail(out, "networth:cpf", "CPF", cpfTotal);
  addDetail(out, "networth:property", "Property", row.propertyNet);
  addDetail(out, "networth:vehicles", "Vehicles", row.vehiclesNet);
  addDetail(out, "networth:liabilities", "Liabilities", -row.liabilities, "bad");
  addDetail(
    out,
    "networth:housing-liabilities",
    "Housing loan balance",
    -row.projectedHousingLiabilities,
    "bad"
  );

  const explainedNetWorth =
    row.cashBalance +
    row.investmentPrincipal +
    cpfTotal +
    row.propertyNet +
    row.vehiclesNet -
    row.liabilities;
  const residual = row.networth - explainedNetWorth;
  addDetail(
    out,
    "networth:residual",
    residual > 0 ? "Other model value" : "Unallocated offset",
    residual,
    residual < 0 ? "bad" : undefined
  );
  return out;
}

function cpfDetails(row: RunwayRow): AmountDetail[] {
  const out: AmountDetail[] = [];
  addDetail(out, "cpf:oa", "CPF OA", row.cpfOa);
  addDetail(out, "cpf:sa", "CPF SA", row.cpfSa);
  addDetail(out, "cpf:ma", "CPF MA", row.cpfMa);
  addDetail(out, "cpf:ra", "CPF RA", row.cpfRa);
  addDetail(out, "cpf:cpfis", "CPFIS", row.cpfCpfis);
  return out;
}

function outflowTooltipDetails(row: RunwayRow): AmountDetail[] {
  if (
    row.outflowSegments.length === 1 &&
    row.outflowSegments[0].key === "outflow:retirement" &&
    Math.abs(row.outflowSegments[0].amount - row.expenses) <= 0.5
  ) {
    return [];
  }
  return row.outflowSegments;
}

function useContainerWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      setNarrow(entry.contentRect.width < NARROW_PX);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return { ref, narrow };
}

function TooltipAmountRow({
  label,
  value,
  color,
  tone,
  indent,
  border = true,
  currency,
}: {
  label: string;
  value: number;
  color?: string;
  tone?: "bad";
  indent?: boolean;
  border?: boolean;
  currency: string;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-3 py-1 text-[12px] ${
        border ? "border-t border-white/10" : ""
      }`}
    >
      <span
        className={`inline-flex items-center gap-2 ${indent ? "pl-4 text-[11px]" : ""}`}
        style={{ color: tone === "bad" ? "#e5a08d" : indent ? "#aaa69e" : "#cdc9c0" }}
      >
        {color ? <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} /> : null}
        {label}
      </span>
      <b className="font-mono tabular-nums text-white">
        {formatMoney(value, currency)}
      </b>
    </div>
  );
}

function TooltipDetails({
  details,
  currency,
  maxRows,
}: {
  details: AmountDetail[];
  currency: string;
  maxRows?: number;
}) {
  const rows = compactDetails(details, maxRows);
  if (rows.length === 0) return null;
  return (
    <>
      {rows.map((detail) => (
        <TooltipAmountRow
          key={detail.key}
          label={detail.label}
          value={detail.amount}
          tone={detail.tone}
          indent
          border={false}
          currency={currency}
        />
      ))}
    </>
  );
}

function RunwayTooltip({
  active,
  payload,
  hidden,
  segments,
  currency,
}: {
  active?: boolean;
  payload?: Array<{ payload: RunwayRow }>;
  hidden: Set<string>;
  segments: ColoredRunwaySegment[];
  currency: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  const visibleOutflowSegments = outflowTooltipDetails(row);
  const visibleNetWorthDetails = netWorthDetails(row);

  return (
    <div className="min-w-[16rem] max-w-[22rem]" style={fpRunwayTooltipProps.contentStyle}>
      <p style={fpRunwayTooltipProps.labelStyle}>
        Age {row.age} · {row.phase}
      </p>
      <TooltipAmountRow
        label="Planned expenses"
        value={row.expenses}
        border={false}
        currency={currency}
      />
      <TooltipDetails details={visibleOutflowSegments} currency={currency} maxRows={5} />
      {segments
        .filter((s) => !hidden.has(s.key) && rowValue(row, s.key) > 0.5)
        .map((s) => (
          <Fragment key={s.key}>
            <TooltipAmountRow
              label={s.label}
              value={rowValue(row, s.key)}
              color={s.color}
              tone={s.kind === "shortfall" ? "bad" : undefined}
              currency={currency}
            />
            <TooltipDetails details={fundingDetails(row, s.key)} currency={currency} maxRows={4} />
          </Fragment>
        ))}
      <TooltipAmountRow label="Net worth" value={row.networth} currency={currency} />
      <TooltipDetails details={visibleNetWorthDetails} currency={currency} maxRows={6} />
    </div>
  );
}

function Panel({
  title,
  badge,
  badgeRisk,
  children,
}: {
  title: ReactNode;
  badge?: string;
  badgeRisk?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      open
      className="group shrink-0 overflow-hidden rounded-2xl border bg-white dark:bg-slate-950/80"
      style={{ borderColor: "var(--runway-surface-line)" }}
    >
      <summary
        className="flex min-h-11 w-full cursor-pointer list-none items-center justify-between gap-2 px-3.5 py-3 text-[11px] font-extrabold uppercase tracking-wider [&::-webkit-details-marker]:hidden"
        style={{ color: "var(--runway-surface-muted)" }}
      >
        <span className="inline-flex items-center gap-2">{title}</span>
        <span className="inline-flex items-center gap-2.5">
          {badge ? (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-extrabold tracking-wide"
              style={{
                color: badgeRisk
                  ? fpRunwayFundingPalette.shortfall
                  : fpRunwayFundingPalette.passive,
                background: badgeRisk
                  ? "rgba(194,112,90,0.14)"
                  : "rgba(122,160,126,0.13)",
              }}
            >
              {badge}
            </span>
          ) : null}
          <span
            aria-hidden
            className="inline-block text-[13px] leading-none transition-transform group-open:rotate-90"
          >
            &gt;
          </span>
        </span>
      </summary>
      <div className="px-3 pb-3">{children}</div>
    </details>
  );
}

function InspectorRow({
  label,
  value,
  color,
  tone,
}: {
  label: string;
  value: string;
  color?: string;
  tone?: "good" | "bad";
}) {
  const valueColor =
    tone === "bad"
      ? fpRunwayFundingPalette.shortfall
      : tone === "good"
        ? "#4f7a52"
        : "var(--runway-surface-ink)";
  return (
    <div
      className="flex items-center justify-between border-b py-2 text-[13px] last:border-b-0"
      style={{ borderColor: "var(--runway-grid-line)" }}
    >
      <dt className="inline-flex items-center gap-2" style={{ color: "var(--runway-surface-ink-soft)" }}>
        {color ? <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} /> : null}
        {label}
      </dt>
      <dd className="font-mono font-bold tabular-nums" style={{ color: tone ? valueColor : "var(--runway-surface-ink)" }}>
        {value}
      </dd>
    </div>
  );
}

function InspectorDetailRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "bad";
}) {
  return (
    <div
      className="flex items-center justify-between border-b py-1.5 pl-5 text-[12px] last:border-b-0"
      style={{ borderColor: "var(--runway-grid-line)" }}
    >
      <dt style={{ color: "var(--runway-surface-muted)" }}>{label}</dt>
      <dd
        className="font-mono font-semibold tabular-nums"
        style={{ color: tone === "bad" ? fpRunwayFundingPalette.shortfall : "var(--runway-surface-ink-soft)" }}
      >
        {value}
      </dd>
    </div>
  );
}

function InspectorDetails({
  details,
  currency,
  maxRows,
}: {
  details: AmountDetail[];
  currency: string;
  maxRows?: number;
}) {
  const rows = compactDetails(details, maxRows);
  if (rows.length === 0) return null;
  return (
    <>
      {rows.map((detail) => (
        <InspectorDetailRow
          key={detail.key}
          label={detail.label}
          value={formatMoney(detail.amount, currency)}
          tone={detail.tone}
        />
      ))}
    </>
  );
}

function Toggle({
  checked,
  label,
  onChange,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      className="inline-flex min-h-8 cursor-pointer items-center gap-2 rounded-full border px-2.5 text-[12px] font-bold"
      style={{
        borderColor: checked ? "var(--runway-surface-ink)" : "var(--runway-surface-line)",
        background: checked ? "var(--runway-surface-ink)" : "var(--runway-control-bg)",
        color: checked ? "var(--runway-control-on-ink)" : "var(--runway-surface-ink-soft)",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
        className="sr-only"
      />
      <span
        className="inline-flex h-4 w-7 items-center rounded-full px-0.5"
        style={{
          background: checked ? fpRunwayFundingPalette.passive : "var(--runway-surface-line)",
        }}
        aria-hidden
      >
        <span
          className="h-3 w-3 rounded-full bg-white transition-transform"
          style={{ transform: checked ? "translateX(12px)" : "translateX(0)" }}
        />
      </span>
      {label}
    </label>
  );
}

export function RetirementRunwayLedgerChart({
  data,
  cashReserveData,
  currency,
}: {
  data: AgeAssetBreakdownPoint[];
  cashReserveData?: AgeAssetBreakdownPoint[];
  currency: string;
}) {
  const [useCashReserves, setUseCashReserves] = useState(false);
  const activeData =
    useCashReserves && cashReserveData && cashReserveData.length > 0
      ? cashReserveData
      : data;
  const { rows, segments } = useMemo(() => toRunwayRows(activeData), [activeData]);
  const coloredSegments = useMemo<ColoredRunwaySegment[]>(
    () =>
      segments.map((segment, index) => ({
        ...segment,
        color: colorForSegment(segment, index),
      })),
    [segments]
  );
  const milestones = useMemo(() => deriveMilestones(activeData), [activeData]);
  const { ref, narrow } = useContainerWidth();

  const retireAge = milestones.find((m) => m.kind === "retirement")?.age ?? null;
  const lastAge = rows.length ? rows[rows.length - 1].age : null;
  const shortfallAge = milestones.find((m) => m.kind === "shortfall")?.age ?? null;

  const [selectedAge, setSelectedAge] = useState<number | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [paneOpenOverride, setPaneOpenOverride] = useState<boolean | null>(null);

  const paneOpen = paneOpenOverride ?? false;
  const activeAge = selectedAge ?? retireAge ?? rows[0]?.age ?? null;
  const selectedRow = rows.find((r) => r.age === activeAge) ?? null;

  if (!rows.length) return null;

  const heroRow = rows.find((r) => r.age === retireAge) ?? rows[rows.length - 1];
  const toggleSegment = (key: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div
      ref={ref}
      className="overflow-hidden rounded-3xl border [--runway-chart-bg:linear-gradient(180deg,#fffefb,#fdfbf6)] [--runway-control-bg:rgba(255,255,255,0.62)] [--runway-control-on-ink:#fff] [--runway-grid-line:#f1ede6] [--runway-net-worth-color:#2c3a4f] [--runway-surface-card:#fffdfa] [--runway-surface-ink-soft:#595f6b] [--runway-surface-ink:#20242c] [--runway-surface-line:#ece7df] [--runway-surface-muted:#8a909c] dark:[--runway-chart-bg:#020617] dark:[--runway-control-bg:rgba(15,23,42,0.72)] dark:[--runway-control-on-ink:#020617] dark:[--runway-grid-line:rgba(148,163,184,0.18)] dark:[--runway-net-worth-color:#94a3b8] dark:[--runway-surface-card:#0f172a] dark:[--runway-surface-ink-soft:#cbd5e1] dark:[--runway-surface-ink:#f8fafc] dark:[--runway-surface-line:rgba(148,163,184,0.28)] dark:[--runway-surface-muted:#94a3b8]"
      style={{
        borderColor: "var(--runway-surface-line)",
        background: "var(--runway-surface-card)",
        color: "var(--runway-surface-ink)",
      }}
    >
      <div className="px-5 pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div
              className="text-[11px] font-extrabold uppercase tracking-[0.12em]"
              style={{ color: fpRunwayFundingPalette.passive }}
            >
              Retirement runway
            </div>
            <div className="mt-1.5 text-3xl font-extrabold tracking-tight sm:text-4xl">
              {formatMoney(heroRow.networth, currency)}
              <span
                className="ml-2 text-[0.34em] font-semibold"
                style={{ color: "var(--runway-surface-muted)" }}
              >
                net worth at {heroRow.age}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Toggle
              checked={useCashReserves}
              label="Use cash reserves"
              onChange={setUseCashReserves}
            />
            <span
              className="inline-flex min-h-8 items-center gap-2 rounded-full px-3 text-[12px] font-extrabold"
              style={
                shortfallAge != null
                  ? { background: "rgba(194,112,90,0.14)", color: "#b25a45" }
                  : { background: "rgba(122,160,126,0.13)", color: "#4f7a52" }
              }
            >
              <span className="h-2 w-2 rounded-full bg-current" />
              {shortfallAge != null
                ? `Shortfall from ${shortfallAge}`
                : `On track to ${lastAge}`}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 px-5 pt-3">
        <div className="flex flex-1 flex-wrap gap-x-4 gap-y-2">
          {coloredSegments.map((s) => {
            const off = hidden.has(s.key);
            return (
              <button
                key={s.key}
                type="button"
                aria-pressed={!off}
                onClick={() => toggleSegment(s.key)}
                className="inline-flex items-center gap-2 text-[13px] font-semibold"
                style={{
                  color: "var(--runway-surface-ink-soft)",
                  opacity: off ? 0.38 : 1,
                  textDecoration: off ? "line-through" : "none",
                }}
              >
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
                {s.label}
              </button>
            );
          })}
          <span
            className="inline-flex items-center gap-2 text-[13px] font-semibold"
            style={{ color: "var(--runway-surface-ink-soft)" }}
          >
            <span
              className="h-[3px] w-4 rounded-sm"
              style={{ background: "var(--runway-net-worth-color)" }}
            />
            Net worth
          </span>
        </div>
        <button
          type="button"
          aria-pressed={paneOpen}
          onClick={() => setPaneOpenOverride(!paneOpen)}
          className="ml-auto inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-bold"
          style={
            paneOpen
              ? {
                  borderColor: "var(--runway-surface-line)",
                  background: "var(--runway-control-bg)",
                  color: "var(--runway-surface-ink-soft)",
                }
              : {
                  borderColor: "var(--runway-surface-ink)",
                  background: "var(--runway-surface-ink)",
                  color: "var(--runway-control-on-ink)",
                }
          }
        >
          {paneOpen ? "Breakdowns" : "Show breakdowns"}
        </button>
      </div>

      <div
        className="grid gap-4 px-5 pb-5 pt-3"
        style={{
          gridTemplateColumns:
            paneOpen && !narrow ? "minmax(0,1fr) 304px" : "minmax(0,1fr)",
        }}
      >
        <div className="min-w-0">
          <div
            className={`${CHART_PANEL_HEIGHT_CLASS} rounded-2xl border p-2 sm:p-3`}
            style={{
              borderColor: "var(--runway-surface-line)",
              background: "var(--runway-chart-bg)",
            }}
          >
            <div className="h-full w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <ComposedChart
                  data={rows}
                  margin={{ top: 24, right: 8, left: 0, bottom: 8 }}
                  onClick={(e) => {
                    const label = e?.activeLabel;
                    if (label != null) setSelectedAge(Number(label));
                  }}
                >
                  <CartesianGrid stroke="var(--runway-grid-line)" vertical={false} />
                  {retireAge != null && lastAge != null ? (
                    <ReferenceArea
                      yAxisId="left"
                      x1={retireAge}
                      x2={lastAge}
                      fill={fpRunwayBandFill}
                      ifOverflow="extendDomain"
                    />
                  ) : null}
                  <XAxis
                    dataKey="age"
                    tick={{ ...fpRunwayAxisTick, fill: "var(--runway-surface-muted)" }}
                    tickLine={false}
                    axisLine={{ stroke: "var(--runway-grid-line)" }}
                  />
                  <YAxis
                    yAxisId="left"
                    width={48}
                    tick={{ ...fpRunwayAxisTick, fill: fpRunwayFundingPalette.takehome }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => formatMoney(v as number, currency)}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    width={48}
                    tick={{ ...fpRunwayAxisTick, fill: "var(--runway-net-worth-color)" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => formatMoney(v as number, currency)}
                  />
                  <Tooltip
                    content={
                      <RunwayTooltip
                        hidden={hidden}
                        segments={coloredSegments}
                        currency={currency}
                      />
                    }
                    cursor={{ fill: "rgba(124,142,122,0.08)" }}
                    isAnimationActive={false}
                  />
                  {coloredSegments.map((s) =>
                    hidden.has(s.key) ? null : (
                      <Bar
                        key={s.key}
                        yAxisId="left"
                        dataKey={s.key}
                        name={s.label}
                        stackId="funding"
                        fill={s.color}
                        isAnimationActive={false}
                      />
                    )
                  )}
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="networth"
                    name="Net worth"
                    stroke="var(--runway-net-worth-color)"
                    strokeWidth={3}
                    dot={false}
                    activeDot={{
                      r: 6,
                      fill: "var(--runway-net-worth-color)",
                      stroke: "#fff",
                      strokeWidth: 3,
                    }}
                    isAnimationActive={false}
                  />
                  {milestones.map((m) => (
                    <ReferenceLine
                      key={`${m.kind}-${m.age}`}
                      yAxisId="left"
                      x={m.age}
                      stroke={
                        m.tone === "risk"
                          ? fpRunwayFundingPalette.shortfall
                          : "var(--runway-surface-muted)"
                      }
                      strokeOpacity={0.4}
                      strokeDasharray="3 4"
                      label={{
                        value: m.icon,
                        position: "top",
                        fontSize: 13,
                      }}
                    />
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <MilestoneLegend
            milestones={milestones}
            activeAge={activeAge}
            onSelect={setSelectedAge}
          />

          {narrow ? (
            <div className="px-1.5 pt-2.5">
              <div
                className="flex items-center justify-between text-[12px] font-bold"
                style={{ color: "var(--runway-surface-muted)" }}
              >
                <span>Selected age</span>
                <span>Age {activeAge}</span>
              </div>
              <input
                type="range"
                min={rows[0].age}
                max={rows[rows.length - 1].age}
                value={activeAge ?? rows[0].age}
                step={1}
                onChange={(e) => setSelectedAge(Number(e.target.value))}
                aria-label="Selected age"
                className="mt-2 w-full"
                style={{ accentColor: fpRunwayFundingPalette.passive }}
              />
            </div>
          ) : null}
        </div>

        {paneOpen ? (
          <aside
            className={`${CHART_PANEL_HEIGHT_CLASS} flex min-h-0 flex-col gap-3 overflow-y-auto pr-1`}
            style={{ scrollbarGutter: "stable" }}
          >
            {selectedRow ? (
              <Panel
                title="Planned expenses"
                badge={selectedRow.phase}
                badgeRisk={selectedRow.shortfall > 0.5}
              >
                <dl>
                  <InspectorRow
                    label="Total planned expenses"
                    value={formatMoney(selectedRow.expenses, currency)}
                  />
                  <InspectorDetails
                    details={requiredOutflowDetails(selectedRow)}
                    currency={currency}
                    maxRows={6}
                  />
                </dl>
              </Panel>
            ) : null}
            {selectedRow ? (
              <Panel title="Source">
                <dl>
                  {coloredSegments
                    .filter((s) => rowValue(selectedRow, s.key) > 0.5)
                    .map((s) => (
                      <Fragment key={s.key}>
                        <InspectorRow
                          label={s.label}
                          value={formatMoney(rowValue(selectedRow, s.key), currency)}
                          color={s.color}
                          tone={s.kind === "shortfall" ? "bad" : undefined}
                        />
                        <InspectorDetails
                          details={fundingDetails(selectedRow, s.key)}
                          currency={currency}
                          maxRows={4}
                        />
                      </Fragment>
                    ))}
                </dl>
              </Panel>
            ) : null}
            {selectedRow ? (
              <Panel title="Net worth components">
                <dl>
                  <InspectorRow
                    label="Net worth"
                    value={formatMoney(selectedRow.networth, currency)}
                  />
                  <InspectorDetails
                    details={netWorthDetails(selectedRow)}
                    currency={currency}
                    maxRows={6}
                  />
                </dl>
              </Panel>
            ) : null}
            {selectedRow && cpfDetails(selectedRow).length > 0 ? (
              <Panel title="CPF components">
                <dl>
                  <InspectorDetails
                    details={cpfDetails(selectedRow)}
                    currency={currency}
                    maxRows={6}
                  />
                </dl>
              </Panel>
            ) : null}
          </aside>
        ) : null}
      </div>
    </div>
  );
}

function MilestoneLegend({
  milestones,
  activeAge,
  onSelect,
}: {
  milestones: RunwayMilestone[];
  activeAge: number | null;
  onSelect: (age: number) => void;
}) {
  if (milestones.length === 0) return null;
  return (
    <div className="pt-3">
      <div
        className="mb-2 text-[11px] font-extrabold uppercase tracking-wider"
        style={{ color: "var(--runway-surface-muted)" }}
      >
        Milestones
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {milestones.map((m) => (
          <MilestoneCard
            key={`${m.kind}-${m.age}`}
            milestone={m}
            current={m.age === activeAge}
            onSelect={() => onSelect(m.age)}
            compact
          />
        ))}
      </div>
    </div>
  );
}

function MilestoneCard({
  milestone,
  current,
  onSelect,
  compact,
}: {
  milestone: RunwayMilestone;
  current: boolean;
  onSelect: () => void;
  compact?: boolean;
}) {
  const iconBg =
    milestone.tone === "risk"
      ? "rgba(194,112,90,0.14)"
      : milestone.tone === "gold"
        ? "rgba(199,154,78,0.16)"
        : "rgba(122,160,126,0.12)";
  return (
    <button
      type="button"
      aria-current={current}
      onClick={onSelect}
      className="grid grid-cols-[40px_1fr] items-center gap-3 rounded-2xl border bg-white p-3 text-left dark:bg-slate-950/80"
      style={{
        borderColor: current ? fpRunwayFundingPalette.passive : "var(--runway-surface-line)",
        boxShadow: current ? "0 0 0 3px rgba(122,160,126,0.12)" : undefined,
      }}
    >
      <span
        className="grid h-10 w-10 place-items-center rounded-xl text-sm font-extrabold"
        style={{ background: iconBg }}
        aria-hidden
      >
        {milestone.icon}
      </span>
      <span>
        <span
          className="block text-[11px] font-extrabold tracking-wide"
          style={{ color: "var(--runway-surface-muted)" }}
        >
          Age {milestone.age}
        </span>
        <span
          className={compact ? "block text-[13px] font-bold" : "block text-[14px] font-bold"}
          style={{ color: "var(--runway-surface-ink)" }}
        >
          {milestone.title}
        </span>
      </span>
    </button>
  );
}
