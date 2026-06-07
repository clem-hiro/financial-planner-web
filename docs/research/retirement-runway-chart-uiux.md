# Research: Retirement Runway Chart — UI/UX & Charting Best Practices (2025–2026)

**Date:** 2026-06-02
**Status:** Complete

## Question

What are the current (2025–2026) industry best practices and trending UI/UX for an interactive
"retirement runway" chart in a premium personal-finance web+mobile app? The target chart:
stacked-bar-per-age cashflow funding (take-home, passive/rental, investment yield, planned
withdrawals, red shortfall/GoalsGap) on a left axis, net-worth/cash-savings line on a secondary
right axis, floating milestone markers above bars, a collapsible right-side detail pane, and a
mobile mode where the pane stacks below and an age slider scrubs the x-axis.

This brief informs HTML chart mockups.

---

## 1. Visual / Aesthetic Direction — "Calm, Confident, Premium"

The dominant 2025–2026 wealth-product direction is **confidence through clarity**, not maximalism.
The market is splitting:

- **Declining (trading/crypto aesthetic):** pure-black backgrounds, neon green, high-saturation
  gain/loss colors, dense KPI grids, frequent motion. Users associate this with stress/speculation.
- **Growing (premium wealth aesthetic):** soft warm-neutral backgrounds, muted accents, large
  whitespace, typography-led hierarchy, minimal chrome, "low-stimulus UI" to reduce cognitive fatigue.

For a retirement screen the emotional target is **"your future is under control,"** not "your
portfolio is performing." This is the single most important framing decision.

**Color system (concrete, from synthesized trend sources):**

| Role | Recommendation | Avoid |
|---|---|---|
| App background | Warm ivory `#FAF8F4` / soft sand `#F4F1EC` | Pure black, stark white |
| Surface / card | `#FFFFFF` or off-white `#FCFBF9`, border `rgba(0,0,0,0.06)`, radius 20–28px, shadow y8/blur24/opacity 6–8% | Heavy glassmorphism, dramatic shadows |
| Primary "wealth"/positive | Deep sage `#6C8570` / muted evergreen `#4F6F5A` | `#00FF66`-style fintech green |
| Secondary / informational | Dusty navy `#51647A` / slate blue `#61758A` | — |
| Risk / shortfall | Terracotta `#B76E5D` / muted amber `#C99852` | Bright pure red `#FF0000` |
| Text | Charcoal `#222`, warm gray `#555` | Pure black on pure white |

Muted warm tones for the shortfall segment ("advisory, not alarming") reduce anxiety while keeping
the funded/shortfall distinction legible. Visualize depletion **gently** — a gradual warm transition,
not a red cliff.

**Typography:** Inter / SF Pro / Geist / IBM Plex Sans / Instrument Sans dominate. Create distinction
through **type, not color**. Hero runway number 40–56px, medium/semibold (500–600). Labels 12–14px
weight 400–500 muted. Explanatory text 15–17px with generous line-height.

**Layout:** Overview-first — one dominant hero ("Money lasts until age 94"), then 2–4 supporting
metrics, then assumptions. Bento-style blocks with generous spacing beat dense financial grids.
Transparency is the trust currency: surface "updated today," inflation/return assumptions, and a
confidence explanation directly.

> **Codebase tension to flag:** the existing `src/ui/chart-styles.ts` defines a *dark* "pro app"
> tooltip (`rgba(15,23,42,0.94)`, slate text). That is the declining aesthetic. For this premium
> runway chart, the mockups should propose a warm-light tooltip variant; reconcile with the existing
> dark token before shipping (don't silently fork the design system).

---

## 2. Dual-Axis Stacked-Bar + Line — Best Practices & Pitfalls

This combo is **acceptable and common for lifecycle/age charts** — the age x-axis is naturally
sequential, funding composition matters, and net worth is valuable context. But it carries
well-documented interpretation risks.

**Do:**
- **Stacked bars = composition + total.** Best at conveying total annual funding (bar height) and
  each source's contribution. Keep to **4–6 segments**, order them **consistently** across ages, and
  put the **most important / most-compared source at the bottom** (shared baseline = easiest to read).
- **Flow vs stock framing.** Bars are *annual flows*; the net-worth line is an *accumulated stock*.
  Users instinctively compare bar-height to line-height as if equivalent. Mitigate with explicit
  labels: left axis "Annual Funding ($)", right axis "Net Worth ($)" — and color the axis labels to
  match their series.
- **Make the line unmistakably separate:** dark, high-contrast, slightly thicker stroke; direct-label
  its final point rather than relying on a legend.
- **Zero baseline for the bars** (length encodes magnitude). The line *may* use a non-zero minimum if
  needed, but only if clearly labeled.

**Pitfalls:**
- **Manufactured correlation** is the #1 risk: tuning the right-axis range can make the line appear to
  track or diverge from the bars arbitrarily. Use natural ranges; never tune scales to force visual
  alignment.
- Interior stack segments are hard to compare across ages (baselines shift). If one source comparison
  is critical, bottom-anchor it.
- Overcrowding: stacked bar already encodes total + components + proportions; the line adds a 4th
  variable. >6 categories or dense age ticks spikes cognitive load.

**If net worth becomes the primary message** (or scales differ by >1 order of magnitude), prefer
**two vertically-aligned panels sharing the age x-axis** — eliminates most dual-axis misreading.

**How the market presents this:**
- **Consumer apps (Monarch, Origin, Copilot):** net-worth line is the hero; retirement = drawdown
  phase; funding sources live in tooltips, not stacked in the primary chart; event markers + Monte
  Carlo success rate emphasized. Validates the age timeline, event markers, and net-worth line.
- **Advisor platforms (RightCapital, eMoney):** the real benchmark for *decumulation*. RightCapital's
  Retirement → Cash Flows explicitly stacks income sources (employment, pension, annuity, SS) +
  withdrawal sources (planned distributions, RMDs, qualified/Roth/HSA) and shows net flows, with
  calendar year + client age shown together. eMoney is cash-flow-centric with phase-based retirement
  modeling.

> **Implication:** the proposed chart is closer to RightCapital/eMoney than Monarch/Origin — more
> informative for decumulation — while keeping the consumer-familiar net-worth line. This is a
> defensible "best of both" position.

---

## 3. Mobile Interaction — Scrubbing the Age Axis

- **Hover has no touch equivalent — make hover info reachable by tap/drag.** Treat *chart scrubbing*
  and the *age slider* as **the same age-state control**: dragging either updates selected age,
  tooltip, marker, and the detail pane.
- **Scrub, don't tap tiny points.** Finger imprecision makes per-year point tapping unreliable. The
  **entire plot area** should be the hit target; touch anywhere → snap to nearest age; drag → scrub
  continuously with a vertical guide line that follows the finger; tooltip stays visible while dragging.
- **Touch targets:** ≥44×44pt (Apple) / 48×48dp (Google), ≥8px spacing between adjacent targets.
- **Thumb zone:** place the age control **at the bottom** (sticky) for one-handed use, not the top.
- **Progressive disclosure / what to drop on small screens:**
  - *Keep:* primary age scale, selected age, current value, the trend line, one active tooltip.
  - *Drop/simplify:* persistent data tables, obvious-color legends, secondary-axis labels, dense
    gridlines, every age tick, hover-only affordances, multiple simultaneous tooltips.
- **Consider dropping the separate slider on mobile entirely** — direct chart scrubbing already
  provides age selection; a "selected age" chip + optional "jump to age" may suffice. (Desktop keeps
  chart + slider + hover.)
- **Live feedback during scrub:** update age label, marker, value, and highlighted year *during* the
  drag, not on release.

---

## 4. Milestone / Event Annotation Patterns

- Markers float **above bars** (RightCapital, Monarch both annotate directly on the timeline): icon +
  short label cards anchored to an age. Examples: "Rental income starts · 62", "Retirement · CPF LIFE
  · 65", one-off goal outflow.
- **Avoid clutter:** cap visible markers; cluster/collapse dense regions; on hover/tap expand the card
  with detail. For 5–20 milestones, simple anchored markers work; beyond that, a dedicated annotation
  engine (see §6) pays off.
- Keep marker labels terse (icon + 2–4 words); push detail into the tooltip or the right detail pane.
- On mobile, milestones become especially noisy — show icons only, reveal labels on tap, or surface
  the active-age milestone in the detail pane rather than floating all of them.

---

## 5. Accessibility for Financial Charts

**Do not encode funded vs shortfall by color alone** (~8% of men have red-green CVD). Use **redundant
multi-channel encoding** — color + pattern + icon + label:

| State | Color | Fill | Icon | Sign | Label |
|---|---|---|---|---|---|
| Funded | blue/sage solid | solid | ▲ | + | "Funded" |
| Shortfall | orange/terracotta | diagonal hatch | ▼ | − | "Shortfall" |

- **Palettes:** prefer blue↔orange / blue↔magenta diverging scales; use validated **Okabe-Ito**,
  **Wong**, or **ColorBrewer** palettes. (Note: this can coexist with the warm premium palette — the
  hatch + icon + label carry the meaning even if hues are muted.)
- **Direct-label bars** ("$1.8M funded", "$400K shortfall") instead of forcing a legend lookup.
- **Contrast:** text ≥4.5:1 (≥3:1 for large), non-text/adjacent regions ≥3:1. Check bars, lines,
  markers, focus rings, hover states, annotations, axis + data labels against the *background*.
- **Screen reader:** provide (a) a concise **summary** stating the key finding ("Funds last to age 94;
  shortfall begins at 91, peaking at $12k/yr"), and (b) a **machine-readable data table** mirroring the
  chart values.
- **ARIA / SVG:** `role="img"` + `aria-labelledby` pointing at `<title>` and `<desc>`; per-point
  `aria-label` with series + category + value + state.
- **Keyboard:** chart = **one tab stop**; arrow keys move between ages (left/right) and series
  (up/down); Home/End to first/last. Recharts documents this pattern.
- **Focus visibility:** thick outline / increased stroke / highlight marker + SR announcement — never
  color-shift alone.

---

## 6. Charting Library Landscape (React/Next.js)

**Recommendation: stay with Recharts (already at 3.8.1 in this repo).** Lowest effort, lowest
migration risk, and it natively does the exact chart.

| Capability | Recharts | visx | Nivo | ECharts | Tremor |
|---|---|---|---|---|---|
| Dual-axis bar+line | Native (`ComposedChart`) | Custom build | Less straightforward | Excellent | Yes (wraps Recharts) |
| Stacked bars | Native (`stackId`) | Custom | Native | Native | Yes |
| Milestone annotations | `ReferenceLine`/`ReferenceDot`/`Label` (custom-ish) | Excellent (fully custom) | Annotation pkg | **Best-in-class** (`MarkLine`/`MarkPoint`/`MarkArea`) | Same as Recharts |
| Responsive | `ResponsiveContainer` | Utilities | Variants | Yes | Yes |
| Dev effort | **Low** | High | Medium | Medium | Low |
| Premium look | Good w/ custom styling | Excellent | Excellent (best defaults) | Excellent | Good |

**Recharts build sketch for this chart:** `ComposedChart` → stacked `Bar`s sharing one `stackId` on
`yAxisId="left"`, net-worth `Line` on `yAxisId="right"`, milestones via `ReferenceLine` +
custom `Label` (or absolutely-positioned overlay cards), custom warm-light tooltip, rounded bar
corners + subtle gradient fills, `ResponsiveContainer`. This is essentially the target chart.

**When to switch:** only if **milestone annotations become a major interactive timeline feature**
(dense events, zoom/brush, annotation interactions). Then **ECharts** is the strongest upgrade —
`MarkLine`/`MarkPoint`/`MarkArea` are dramatically easier than custom SVG annotation layers.
**Tremor** is a Recharts wrapper (its `ComboChart` imports Recharts primitives, supports
`enableBiaxial`) — useful for dashboard scaffolding, not a charting-engine upgrade. **visx** only if
the chart becomes a pixel-perfect product differentiator worth the build cost. **Nivo** has the
prettiest defaults but isn't a clear win over Recharts for this exact composed chart.

---

## Recommendations (actionable for the mockups)

1. **Warm-light, low-stimulus theme.** Ivory background, white soft-rounded surfaces (radius 20–28px,
   ~6% shadow), sage/slate accents, muted terracotta/amber for shortfall. Hero number 40–56px.
   *Propose a warm-light tooltip and reconcile with the existing dark `chart-styles.ts` token.*
2. **Recharts `ComposedChart`.** Stacked bars (4–6 ordered segments, shortfall bottom-anchored or
   clearly distinct) on left "Annual Funding ($)" axis; net-worth line on right "Net Worth ($)" axis,
   dark + thick + end-labeled. Zero baseline on bars; natural (untuned) right-axis range.
3. **Label flow vs stock explicitly** to prevent the bar-height-vs-line-height misread.
4. **Shortfall encoded redundantly:** muted warm color + diagonal hatch + ▼ + "Shortfall" label — not
   color alone.
5. **Milestones as terse anchored icon-cards above bars;** cluster on density; detail in tooltip/pane;
   icons-only with tap-to-reveal on mobile.
6. **Mobile:** whole-plot scrub with snap-to-age + following guide line; bottom sticky age control
   (consider dropping the separate slider — scrub may suffice); progressive disclosure (drop tables,
   legends, secondary-axis labels, dense ticks); live updates during drag; ≥44–48px targets.
7. **Accessibility baked in from mockup stage:** SVG `role="img"` + title/desc, per-point aria-labels,
   single-tab-stop + arrow-key traversal, ≥4.5:1 text / ≥3:1 non-text contrast, a mirrored data table.
8. **Trust signals on-screen:** "updated today," inflation + return assumptions, confidence note.
9. **Consider a stacked-panel fallback** (two aligned charts sharing the age axis) if user testing
   shows the dual axis misleads — keep it as a known escape hatch.

---

## Sources

- The Masterly — Fintech design guide: https://www.themasterly.com/blog/fintech-design-guide
- Intuitia — App design trends 2026 (low-stimulus UI, palettes, surfaces): https://www.intuitia.tech/blog/app-design-trends
- DesignPixil — Fintech dashboard design: https://designpixil.com/blog/fintech-dashboard-design
- SaaSFactor — Fintech mobile app design: https://www.saasfactor.co/blogs/fintech-mobile-app-design
- Atlassian — Stacked bar chart complete guide: https://www.atlassian.com/data/charts/stacked-bar-chart-complete-guide
- QuantHub — Dual y-axis chart pitfalls: https://www.quanthub.com/common-chart-design-pitfalls-dual-y-axis-charts/
- data.europa.eu — Stacked charts guidance: https://data.europa.eu/apps/data-visualisation-guide/stacked-charts
- The Comm Spot — Designing data for accuracy: https://thecommspot.com/comm-subjects/visual-communication/data-visualization/
- RightCapital — Retirement Cash Flows module: https://help.rightcapital.com/module-overview/client-portal/retirement/cash-flows
- RightCapital — Retirement Analysis: https://help.rightcapital.com/article/93-analysis
- Monarch — Forecasting: https://help.monarch.com/hc/en-us/articles/48344305092244-Forecasting-in-Monarch
- Origin — Getting started with forecasting: https://useoriginsupport.zendesk.com/hc/en-us/articles/36002437169677-Getting-started-with-forecasting
- eMoney — Cash-flow planning case study: https://emoneyadvisor.com/resources/case-studies/helping-clients-navigate-retirement-with-cash-flow-planning/
- UXPin — Responsive design for touch devices: https://www.uxpin.com/studio/blog/responsive-design-touch-devices-key-considerations/
- Boundev — Mobile data visualization design guide: https://www.boundev.com/blog/mobile-data-visualization-design-guide
- EG Digital Library — Mobile visualization touch inspection (research): https://diglib.eg.org/server/api/core/bitstreams/e04d5731-f11f-4a5d-a482-7ba145fbad62/content
- Flook — Mobile tooltip best practices: https://flook.co/blog/posts/mobile-tooltip-best-practices
- colorblind.io — Data visualization accessibility: https://colorblind.io/guides/data-visualization
- ColorArchive — Data viz palette design: https://colorarchive.org/guides/data-visualization-palette-design/
- ChartGen — Chart accessibility / inclusive data viz: https://chartgen.ai/resources/blog/chart-accessibility-inclusive-data-visualization
- LearnSpace — ARIA-first charts: https://learnspace.blog/blog/accessible-data-visualization-building-aria-first-charts/
- Recharts — Accessibility wiki: https://github.com/recharts/recharts/wiki/Recharts-and-accessibility
- Recharts — Bar API: https://recharts.github.io/en-US/api/Bar/
- visx — docs: https://visx.airbnb.tech/docs/visx
- Nivo: https://contextqmd.com/libraries/nivo
- Apache ECharts — examples / cheat sheet: https://echarts.apache.org/examples/en/index.html
- Tremor — Combo chart: https://tremor.so/docs/visualizations/combo-chart
