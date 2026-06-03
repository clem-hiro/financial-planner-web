# Retirement Runway Chart — Design Notes

_Date: 2026-06-02 · Source ledger: `src/domain/finance/retirement-cashflow-projection.ts`_

These are static HTML mockups (hand-rolled SVG, no build step) to choose a direction before
implementing the production chart. Open `index.html` for the side-by-side comparison, or each
proposal file directly. Every file has a **Desktop / Mobile** preview toggle (driven by CSS
container queries, so the mobile layout is exactly what a phone renders — not a separate codepath).

## The proposals

| | A · Funded spending | B · Income by source |
|---|---|---|
| **Bar = ** | that year's spending (`requiredOutflow`), segmented by funder | that year's total income (`cashAccessibleInflow`), stacked by source |
| **Spending shown as** | the bar height itself | a dashed step line across the bars |
| **Shortfall (`goalsGap`)** | terracotta cap on top of the bar | terracotta fill from income-top up to the spending line |
| **Aesthetic** | warm-light ivory, sage/terracotta, soft-rounded | deep-navy + emerald (matches app design system) |
| **Matches** | the "each bar shows how spending is funded" caption + GoalsGap reference (Image #3) | Image #1's tall pre-retirement income bars with surplus |

Both share: dual axis (annual $ left / net worth right, axis labels color-matched to series),
retirement shaded band, floating milestone icon-markers above bars, hover-tooltip on desktop,
tap + age-slider scrub on mobile, and a series legend with click-to-toggle.

**Right-side pane controls (two levels of collapse):**
- **Master toggle** — the `Insights` pill next to the legend collapses the *entire* pane so the
  chart animates out to full width; click again (label becomes `Show insights`) to restore. Hidden
  on mobile, where the pane simply stacks below.
- **Per-group collapse** — each card (`Milestones`, `Selected age`) has an obvious chevron header;
  clicking it folds just that group. The chevron rotates to signal state. This replaces the earlier
  single, easy-to-miss `–` button.
- **Width-aware auto-collapse** — when the card narrows past `NARROW = 780px`, the pane auto-collapses
  so the chart keeps full width and stays legible; widening past the threshold auto-restores it.
  A manual toggle within a width regime is respected; crossing the breakpoint re-applies the auto
  default. Detection uses a `ResizeObserver` on `.card` (not viewport `@media`/`matchMedia`), because
  the Mobile-preview toggle changes the *card* width, not the viewport — and CSS container queries
  can't drive JS state. When revealed on a narrow screen the pane **stacks below** the chart (chart
  stays visible above; milestones scroll horizontally).

## Ledger → segment mapping

The ledger already exposes every field the chart needs on `AgeAssetBreakdownPoint`:

- **Take-home income** — `cashAccessibleInflow` minus the broken-out inflows = employment/bonus residual.
  Note: the ledger only itemizes `cpfLifeInflow` and `rentalInflow` via `addSourceBreakdown`; everything
  else cash (employment, bonus, vehicle proceeds, housing cash) is folded into `cashAccessibleInflow`.
  If we want a clean "employment income" segment, the cleanest fix is to add an `employmentInflow`
  (or `otherCashInflow`) breakdown field rather than subtracting in the UI.
- **Passive income** — `cpfLifeInflow` + `rentalInflow`
- **Investment yield** — `investmentDividendInflow` + `ilpIncomeInflow`
- **Withdrawals / drawdown** — `investmentWithdrawalInflow` + `principalWithdrawn` (`investment` + `ilp`)
- **Shortfall** — `goalsGap` (per-year) · `cumulativeGoalsGap` (running)
- **Net-worth line** — `value` / `netWorth`
- **Spending reference** — `requiredOutflow`
- **Retirement band** — `phase === "post_retirement"`

The mockups use a synthetic SG scenario generated in-file; wiring to real data is a straight map
from the table above.

## Research highlights applied (full brief: `docs/research/retirement-runway-chart-uiux.md`)

- **Calm > loud.** Warm-light or restrained-navy, hero number, type-led hierarchy. The neon-on-black
  trading look reads as stress.
- **Dual axis done safely.** Left axis = annual *flows* (bars), right axis = accumulated *stock* (line);
  both axes explicitly labelled and color-matched. Right axis never tuned to manufacture correlation.
- **Shortfall is CVD-safe.** Encoded redundantly: muted terracotta **+ diagonal hatch + text label** —
  never red-vs-green alone (8% of users).
- **Mobile.** Whole plot is the touch target; age slider + chart-scrub share one state; ≥44px targets;
  milestones become a horizontal snap-scroll row; secondary detail moves into the tooltip/pane.
- **Library (for the real build): stay on Recharts 3.x.** `ComposedChart` + stacked `Bar`s (`stackId`)
  on the left axis + net-worth `Line` on the right + `ReferenceLine`/`Label` milestones is this exact
  chart at the lowest effort. Move to ECharts only if milestones become a dense interactive timeline.

## Open decisions for the user

1. **Bar semantics** — Proposal A (funded spending) vs B (income by source). This is the main fork.
2. **Palette** — warm-light (A) vs navy/emerald (B). Independent of #1; either model works in either skin.
   Flag: the app's current `src/ui/chart-styles.ts` defines a *dark* tooltip; reconcile the chosen skin
   with the design system rather than silently forking.
3. **Employment-income breakdown** — add an explicit ledger field, or derive the residual in the UI?
