import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { AgeAssetBreakdownPoint } from "@/data/age-asset-breakdown";
import { RetirementRunwayLedgerChart } from "./RetirementRunwayLedgerChart";

// Recharts' ResponsiveContainer measures to 0 in node SSR, so the SVG plot is empty;
// this smoke test exercises the static chrome (header, legend, milestone
// pane) and confirms the component renders without throwing. Plot math is covered by
// retirement-runway-rows.test.ts.
const point = (
  over: Partial<AgeAssetBreakdownPoint> & { age: number }
): AgeAssetBreakdownPoint => ({
  value: 0,
  investments: 0,
  cash: 0,
  cpf: 0,
  cpfOa: 0,
  cpfSa: 0,
  cpfMa: 0,
  cpfRa: 0,
  cpfCpfis: 0,
  liabilities: 0,
  vehiclesNet: 0,
  ...over,
});

const data: AgeAssetBreakdownPoint[] = [
  point({ age: 60, requiredOutflow: 78, employmentInflow: 160, value: 1_800_000 }),
  point({ age: 62, requiredOutflow: 80, employmentInflow: 160, rentalInflow: 22, value: 1_900_000 }),
  point({ age: 64, requiredOutflow: 180, employmentInflow: 160, value: 2_000_000 }),
  point({
    age: 65,
    phase: "post_retirement",
    requiredOutflow: 82,
    cpfLifeInflow: 28,
    rentalInflow: 22,
    investmentDividendInflow: 31,
    value: 2_560_000,
  }),
  point({
    age: 85,
    phase: "post_retirement",
    requiredOutflow: 95,
    cpfLifeInflow: 28,
    goalsGap: 40,
    value: 900_000,
  }),
];

describe("RetirementRunwayLedgerChart SSR composition", () => {
  it("renders header, legend, and milestone pane without throwing", () => {
    const html = renderToStaticMarkup(
      <RetirementRunwayLedgerChart
        data={data}
        cashReserveData={data}
        currency="SGD"
      />
    );
    expect(html).toContain("Retirement runway");
    expect(html).toContain("Use cash reserves");
    expect(html).toContain("Show breakdowns");
    expect(html).toContain("Take-home");
    expect(html).toContain("Passive income");
    expect(html).toContain("Net worth");
    expect(html).toContain("Milestones");
    expect(html).toContain("Rental income starts");
    expect(html).toContain("Shortfall begins");
    expect(html).not.toContain("Budget categories");
    expect(html).not.toContain("Pre-retirement expenses");
    expect(html).not.toContain("Retirement expenses");
  });

  it("flags shortfall in the hero status when goalsGap is present", () => {
    const html = renderToStaticMarkup(
      <RetirementRunwayLedgerChart data={data} currency="SGD" />
    );
    expect(html).toContain("Shortfall from 85");
  });

  it("returns null for empty data", () => {
    const html = renderToStaticMarkup(
      <RetirementRunwayLedgerChart data={[]} currency="SGD" />
    );
    expect(html).toBe("");
  });
});
