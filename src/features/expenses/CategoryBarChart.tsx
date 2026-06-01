"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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

const BAR_COLORS = [
  "#0d9488",
  "#14b8a6",
  "#2dd4bf",
  "#0891b2",
  "#06b6d4",
  "#0ea5e9",
  "#6366f1",
  "#8b5cf6",
];

export function CategoryBarChart({
  data,
  currency,
}: {
  data: { category: string; amount: number }[];
  currency: string;
}) {
  if (!data.length) return null;

  return (
    <ChartFrame>
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 4, bottom: 52 }}>
          <CartesianGrid
            strokeDasharray="3 6"
            stroke={fpChartGridColor}
            vertical={false}
          />
          <XAxis
            dataKey="category"
            tick={fpChartAxisTick}
            interval={0}
            angle={-28}
            textAnchor="end"
            height={72}
            axisLine={{ stroke: fpChartGridColor }}
            tickLine={false}
          />
          <YAxis
            width={48}
            tick={fpChartAxisTick}
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
            formatter={(value) =>
              new Intl.NumberFormat(undefined, {
                style: "currency",
                currency,
                maximumFractionDigits: 0,
              }).format(Number(value ?? 0))
            }
          />
          <Bar dataKey="amount" radius={[8, 8, 4, 4]} maxBarSize={44}>
            {data.map((_, i) => (
              <Cell
                key={`cell-${i}`}
                fill={BAR_COLORS[i % BAR_COLORS.length]}
                fillOpacity={0.92}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
