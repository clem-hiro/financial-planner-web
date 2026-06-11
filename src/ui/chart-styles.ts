/** Recharts Tooltip props for a dark “pro app” floating tooltip. */
export const fpChartTooltipProps = {
  contentStyle: {
    borderRadius: 12,
    border: "1px solid rgba(148, 163, 184, 0.25)",
    backgroundColor: "rgba(15, 23, 42, 0.94)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    color: "#f8fafc",
    fontSize: 12,
    padding: "10px 12px",
    boxShadow: "0 16px 48px rgba(15, 23, 42, 0.35)",
  },
  labelStyle: { color: "#94a3b8", marginBottom: 6, fontSize: 11 },
  itemStyle: { color: "#f1f5f9", fontWeight: 500 },
};

export const fpChartAxisTick = { fill: "#64748b", fontSize: 11 };
export const fpChartGridColor = "var(--chart-grid, #e2e8f0)";
