/**
 * Warm-light skin for the retirement runway ledger chart (Proposal A).
 * Separate from the dark `chart-styles.ts` so other charts keep their dark tokens.
 * Token values are ported verbatim from
 * `docs/design/retirement-ledger-chart/proposal-a-funded-spending.html`.
 */

/** Warm-light page/card surface tokens (ivory/sage neutrals). */
export const fpRunwaySurface = {
  paper: "#faf8f4",
  card: "#fffdfa",
  line: "#ece7df",
  ink: "#20242c",
  inkSoft: "#595f6b",
  muted: "#8a909c",
} as const;

/** Funding-segment palette: each retirement year's spending by source. CVD-safe. */
export const fpRunwayFundingPalette = {
  /** Employment + bonus (slate blue). */
  takehome: "#5b7fb4",
  /** CPF LIFE + rental (sage). */
  passive: "#7aa07e",
  /** Dividends + ILP income (warm gold). */
  yield: "#c79a4e",
  /** Planned withdrawal + principal drawdown (muted violet). */
  drawdown: "#9b8bb4",
  /** Unmapped cash inflow residual — vehicle proceeds, other (neutral slate-gray). */
  other: "#9aa0ab",
  /** GoalsGap shortfall (muted terracotta + hatch — not pure red). */
  shortfall: "#c2705a",
} as const;

/** Outflow-segment palette for the runway bars. */
export const fpRunwayOutflowPalette = {
  preRetirement: "#5b7fb4",
  retirement: "#9b8bb4",
  budget: "#7aa07e",
  tax: "#c79a4e",
  housing: "#4f91a8",
  goal: "#c2705a",
  other: "#9aa0ab",
  categoryCycle: [
    "#5b7fb4",
    "#7aa07e",
    "#c79a4e",
    "#4f91a8",
    "#9b8bb4",
    "#c2705a",
    "#8b927f",
    "#b8845c",
  ],
} as const;

/** Net-worth line on the right axis (deep slate). */
export const fpRunwayNetWorthColor = "#2c3a4f";

/** Diagonal-hatch pattern params for the shortfall segment. */
export const fpRunwayShortfallHatch = {
  color: fpRunwayFundingPalette.shortfall,
  angle: 45,
  strokeWidth: 1,
  size: 6,
} as const;

export const fpRunwayAxisTick = { fill: fpRunwaySurface.muted, fontSize: 11, fontWeight: 600 };
export const fpRunwayGridColor = "#f1ede6";

/** Retirement-phase ReferenceArea fill (translucent sage). */
export const fpRunwayBandFill = "rgba(124, 142, 122, 0.07)";

/** Recharts Tooltip props for the warm-dark floating tooltip (per approved Proposal A mockup). */
export const fpRunwayTooltipProps = {
  contentStyle: {
    borderRadius: 14,
    border: "none",
    backgroundColor: "rgba(32, 36, 44, 0.97)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    color: "#f6f4ef",
    fontSize: 12,
    padding: "12px 13px",
    boxShadow: "0 20px 50px rgba(20, 18, 14, 0.34)",
  },
  labelStyle: { color: "#f6f4ef", marginBottom: 8, fontSize: 13, fontWeight: 700 },
  itemStyle: { color: "#cdc9c0", fontWeight: 500 },
};
