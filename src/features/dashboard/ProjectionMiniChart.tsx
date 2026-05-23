"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
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

type Point = { month: number; value: number };

export function ProjectionMiniChart({
  data,
  currency,
}: {
  data: Point[];
  currency: string;
}) {
  if (!data.length) return null;

  return (
    <ChartFrame>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: 4, bottom: 4 }}>
          <defs>
            <linearGradient id="projLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#0284c7" />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 6"
            stroke={fpChartGridColor}
            vertical={false}
          />
          <XAxis
            dataKey="month"
            tick={fpChartAxisTick}
            axisLine={{ stroke: fpChartGridColor }}
            tickLine={false}
          />
          <YAxis
            width={52}
            tick={fpChartAxisTick}
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
            wrapperStyle={{ pointerEvents: "none" }}
            formatter={(value) =>
              new Intl.NumberFormat("en-SG", {
                style: "currency",
                currency,
                maximumFractionDigits: 0,
              }).format(Number(value ?? 0))
            }
            labelFormatter={(m) => `Month ${m}`}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="url(#projLine)"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5, fill: "#0284c7", stroke: "#fff", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}
