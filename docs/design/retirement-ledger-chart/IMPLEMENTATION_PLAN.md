# Retirement Runway Chart — Implementation Plan (Proposal A)

_Date: 2026-06-02 · Direction: Proposal A "funded spending", warm-light skin._

## Problem Statement

- The new retirement cash-flow ledger (`src/domain/finance/retirement-cashflow-projection.ts`) exposes
  per-age funding/shortfall fields, but **nothing in the UI renders them** — the dashboard still shows
  only the legacy asset-stack chart (`AgeCombinedAssetsProjectionChart`).
- Users can't see how each retirement year's spending is funded, when income hands off to passive
  income/yield, or when a shortfall (`goalsGap`) begins.
- Goal: ship the "funded spending" runway chart (Proposal A) as the retirement chart.

## Decisions (locked)

1. **Placement — Replace.** The runway chart replaces `AgeCombinedAssetsProjectionChart` in
   `DashboardRetirementSection.tsx`. The CPF-by-age chart (`CpfProjectionByAgeChart`) is unaffected.
2. **Take-home — Add domain field.** Add explicit `employmentInflow` (employment + bonus) to the
   ledger breakdown rather than deriving a residual in the UI (residual would mislabel vehicle/housing
   cash as "take-home").
3. **Aesthetic — Warm-light.** Port A's warm-light ivory/sage/terracotta. Add warm-light chart tokens
   + a light tooltip variant to the design system; leave the existing dark tokens (used by other
   charts) untouched.

## Success Criteria

- Dashboard retirement section renders the warm-light funded-spending runway chart from real data.
- Bars = `requiredOutflow` segmented by `employmentInflow`, passive (`cpfLifeInflow + rentalInflow`),
  yield (`investmentDividendInflow + ilpIncomeInflow`), withdrawals (`investmentWithdrawalInflow +
  principalWithdrawn`), shortfall (`goalsGap`); net-worth line on the right axis.
- Milestones, retirement band, selected-age pane (collapsible groups + master toggle), width-aware
  auto-collapse, and mobile age-slider all work.
- `npm run test` / `build` / `lint` / `map:check` green; `PROJECT_CONTEXT.md` updated.

## Build Sequence (phased — verify each before the next)

### Phase 1 — Domain: employment-income breakdown
- `retirement-cashflow-projection.ts`: add `employmentInflow` to `InflowBreakdown` + `ProjectionPeriodRow`;
  break out `employment_income` and `bonus_income` in `addSourceBreakdown`; init in `createInitialBreakdown`.
- Update `retirement-cashflow-projection.test.ts` (assert `employmentInflow` on relevant rows).
- **Gate:** domain tests pass; existing inflow totals unchanged (employment was already in `cashAccessibleInflow`).

### Phase 2 — Data: thread the field
- `age-asset-breakdown.ts`: add `employmentInflow?: number` to `AgeAssetBreakdownPoint`.
- `dashboard.ts`: map `employmentInflow` into `assetPoints` (~:1392).
- **Gate:** `dashboard*.test.ts` pass; type flows to the section props.

### Phase 3 — Design system: warm-light chart tokens
- New `src/ui/runway-chart-styles.ts` (don't mutate existing dark `chart-styles.ts`): warm-light tooltip
  props, axis tick, grid color, retirement-band fill, and the funding palette (take-home/passive/yield/
  drawdown/shortfall + hatch).
- **Gate:** `$design-system-check` clean for the new component.

### Phase 4 — UI: RetirementRunwayLedgerChart
- New `src/features/dashboard/RetirementRunwayLedgerChart.tsx` — Recharts `ComposedChart`: stacked `Bar`s
  (`stackId`) on left axis + net-worth `Line` on right + `ReferenceArea` retirement band + `ReferenceLine`/
  `Label` milestones + hatch `<pattern>` for shortfall.
- Pure helper `src/features/dashboard/retirement-runway-rows.ts` — `toRunwayRows(points)` (segment
  derivation) + `deriveMilestones(points)` (rental start, retirement/CPF LIFE, one-off goal, shortfall
  begins). Unit-tested.
- Selected-age state, collapsible insight pane (master toggle + per-group chevrons), width-aware
  auto-collapse (`ResizeObserver`), mobile age slider — port from the mockup.
- **Gate:** `$nextjs16-guard`, component SSR smoke test renders.

### Phase 5 — Wire + retire the old chart
- `DashboardRetirementSection.tsx`: swap `<AgeCombinedAssetsProjectionChart>` → `<RetirementRunwayLedgerChart>`;
  reconcile the warm-light card surface inside the emerald section wrapper.
- Blast-radius / `$find-orphans` on `AgeCombinedAssetsProjectionChart` before deleting; remove if fully orphaned.
- **Gate:** dashboard page renders; no dangling imports.

### Phase 6 — Tests, gates, docs
- Helper unit tests + component SSR smoke test (repo convention: `renderToStaticMarkup`, no RTL).
- `npm run test`, `npm run build`, `npm run lint`, `npm run map` (regen function tree), `npm run map:check`.
- `$test-strategy-gate`, `$design-system-check`.
- Update `PROJECT_CONTEXT.md` (Feature inventory + Routes/Database if relevant + `_Last reviewed_`).

## Public Interfaces / Contracts

- **Domain type change:** `ProjectionPeriodRow` / `AgeAssetBreakdownPoint` gain `employmentInflow`. Additive,
  optional on the data point. No API/route change.
- **DB migrations:** none. **Env vars:** none.

## Change Impact

- New: `RetirementRunwayLedgerChart.tsx`, `retirement-runway-rows.ts`, `runway-chart-styles.ts`, tests.
- Edited: `retirement-cashflow-projection.ts` (+test), `age-asset-breakdown.ts`, `dashboard.ts`,
  `DashboardRetirementSection.tsx`.
- Removed: `AgeCombinedAssetsProjectionChart.tsx` (if orphaned after swap).
- High-priority watch: warm-light-inside-emerald-panel visual reconciliation (Phase 5); employment total
  parity (Phase 1 — breakdown must not change `cashAccessibleInflow` sums).

## Rollout / Rollback

- Local UI/domain change, no migration. Rollback = revert the commit.

## Out of Scope

- Proposal B, the hybrid skin, and any further mockup iteration.
- Changes to `CpfProjectionByAgeChart` and the legacy `buildNetWorthByAgeProjection` fallback.
