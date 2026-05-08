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
  cpfis: number;
  totalCpf: number;
};

const OA = "#4f46e5";
const SA = "#7c3aed";
const MA = "#059669";
const CPFIS = "#d97706";
const TOTAL = "#64748b";

export function CpfProjectionByAgeChart({
  data,
  currency,
  markers = [],
}: {
  data: CpfAgePoint[];
  currency: string;
  markers?: Array<{ age: number; label: string }>;
}) {
  const narrow = useNarrowScreen();

  if (!data.length) return null;

  const fmt = (v: number | string | undefined) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(Number(v ?? 0));

  const showCpfis = data.some((d) => d.cpfis > 0.5);

  return (
    <ChartFrame className="h-full min-h-0" clipContent={false}>
      <div className="h-full min-h-0 w-full">
        <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 4, right: 4, left: 0, bottom: 26 }}
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
            formatter={(value) => <span className="text-slate-600">{value}</span>}
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
                      fill: "#64748b",
                      fontSize: 9,
                    }
              }
            />
          ))}
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
