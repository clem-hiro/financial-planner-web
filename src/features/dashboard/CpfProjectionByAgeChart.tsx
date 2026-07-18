"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
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

export type CpfAgePoint = {
  age: number;
  oa: number;
  sa: number;
  ma: number;
  ra: number;
  cpfis: number;
  totalCpf: number;
};

export type CpfRetirementSumTargets = {
  brs: number;
  frs: number;
  ers: number;
};

const OA = "#4f46e5";
const SA = "#7c3aed";
const MA = "#059669";
const RA = "#0f766e";
const CPFIS = "#d97706";
const TOTAL = "#64748b";
const BRS = "#94a3b8";
const FRS = "#64748b";
const ERS = "#475569";

export function CpfProjectionByAgeChart({
  data,
  currency,
  markers = [],
  retirementSumTargets,
  raFormationAge,
}: {
  data: CpfAgePoint[];
  currency: string;
  markers?: Array<{ age: number; label: string }>;
  /** Estimated BRS / FRS / ERS at age 55 — drawn as horizontal guides. */
  retirementSumTargets?: CpfRetirementSumTargets | null;
  /** Vertical marker for RA set-aside (default 55). */
  raFormationAge?: number | null;
}) {
  const narrow = useNarrowScreen();

  if (!data.length) return null;

  const fmt = (v: number | string | undefined) =>
    new Intl.NumberFormat("en-SG", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(Number(v ?? 0));

  const showCpfis = data.some((d) => d.cpfis > 0.5);
  const showRa = data.some((d) => d.ra > 0.5);
  const targets =
    retirementSumTargets != null &&
    retirementSumTargets.frs > 0 &&
    Number.isFinite(retirementSumTargets.frs)
      ? retirementSumTargets
      : null;
  const ages = data.map((d) => d.age);
  const minAge = Math.min(...ages);
  const maxAge = Math.max(...ages);
  const showRaAgeMarker =
    raFormationAge != null &&
    Number.isFinite(raFormationAge) &&
    raFormationAge >= minAge &&
    raFormationAge <= maxAge &&
    !markers.some((m) => m.age === raFormationAge);

  return (
    <ChartFrame
      className="h-56 min-h-[200px] sm:h-full sm:min-h-[220px]"
      clipContent={false}
    >
      <div className="h-full w-full min-h-[200px] min-w-0 sm:min-h-0">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <LineChart
          data={data}
          margin={{ top: 4, right: targets ? 36 : 4, left: 0, bottom: 26 }}
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
              style: { fontSize: 11, fill: "currentColor", fontWeight: 500 },
              className: "fill-slate-500 dark:fill-slate-400",
            }}
          />
          <YAxis
            width={44}
            tick={{ ...fpChartAxisTick, fontSize: 10 }}
            tickMargin={4}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) =>
              new Intl.NumberFormat("en-SG", {
                notation: "compact",
                maximumFractionDigits: 1,
              }).format(v as number)
            }
          />
          <Tooltip
            {...fpChartTooltipProps}
            allowEscapeViewBox={{ x: true, y: false }}
            wrapperStyle={{ zIndex: 80, outline: "none", pointerEvents: "none" }}
            formatter={(value, name) => {
              const v = Array.isArray(value) ? value[0] : value;
              return [fmt(Number(v)), String(name)];
            }}
            labelFormatter={(age) => `Age ${age}`}
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
            formatter={(value) => <span className="text-slate-600 dark:text-slate-300">{value}</span>}
          />
          {markers.map((m, i) => (
            <ReferenceLine
              key={`${m.age}-${i}`}
              x={m.age}
              stroke="#94a3b8"
              strokeDasharray="4 4"
              label={
                narrow
                  ? false
                  : {
                      value: m.label,
                      position: "insideTopLeft",
                      fill: "currentColor",
                      fontSize: 9,
                      className: "fill-slate-500 dark:fill-slate-400",
                    }
              }
            />
          ))}
          {showRaAgeMarker ? (
            <ReferenceLine
              x={raFormationAge}
              stroke="#0f766e"
              strokeDasharray="3 3"
              strokeOpacity={0.55}
              label={
                narrow
                  ? false
                  : {
                      value: `Age ${raFormationAge}`,
                      position: "insideTopLeft",
                      fill: "currentColor",
                      fontSize: 9,
                      className: "fill-teal-700 dark:fill-teal-300",
                    }
              }
            />
          ) : null}
          {targets ? (
            <>
              <ReferenceLine
                y={targets.brs}
                stroke={BRS}
                strokeDasharray="2 4"
                strokeOpacity={0.85}
                label={
                  narrow
                    ? false
                    : {
                        value: "BRS",
                        position: "insideTopRight",
                        fill: BRS,
                        fontSize: 9,
                      }
                }
              />
              <ReferenceLine
                y={targets.frs}
                stroke={FRS}
                strokeDasharray="4 3"
                strokeOpacity={0.9}
                label={
                  narrow
                    ? false
                    : {
                        value: "FRS",
                        position: "insideTopRight",
                        fill: FRS,
                        fontSize: 9,
                      }
                }
              />
              <ReferenceLine
                y={targets.ers}
                stroke={ERS}
                strokeDasharray="6 3"
                strokeOpacity={0.85}
                label={
                  narrow
                    ? false
                    : {
                        value: "ERS",
                        position: "insideTopRight",
                        fill: ERS,
                        fontSize: 9,
                      }
                }
              />
            </>
          ) : null}
          <Line
            type="monotone"
            dataKey="oa"
            name="OA"
            stroke={OA}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: OA, stroke: "#fff", strokeWidth: 1 }}
          />
          <Line
            type="monotone"
            dataKey="sa"
            name="SA"
            stroke={SA}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: SA, stroke: "#fff", strokeWidth: 1 }}
          />
          <Line
            type="monotone"
            dataKey="ma"
            name="MA"
            stroke={MA}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: MA, stroke: "#fff", strokeWidth: 1 }}
          />
          {showRa && (
            <Line
              type="monotone"
              dataKey="ra"
              name="RA"
              stroke={RA}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: RA, stroke: "#fff", strokeWidth: 1 }}
            />
          )}
          {showCpfis && (
            <Line
              type="monotone"
              dataKey="cpfis"
              name="CPFIS (notional)"
              stroke={CPFIS}
              strokeWidth={2}
              dot={false}
              strokeDasharray="4 2"
              activeDot={{ r: 4, fill: CPFIS, stroke: "#fff", strokeWidth: 1 }}
            />
          )}
          <Line
            type="monotone"
            dataKey="totalCpf"
            name="Total CPF"
            stroke={TOTAL}
            strokeWidth={1.5}
            dot={false}
            strokeDasharray="6 4"
            activeDot={{ r: 3, fill: TOTAL, stroke: "#fff", strokeWidth: 1 }}
          />
        </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
