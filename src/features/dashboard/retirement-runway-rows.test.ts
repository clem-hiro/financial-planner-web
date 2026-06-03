import { describe, expect, it } from "vitest";
import type { AgeAssetBreakdownPoint } from "@/data/age-asset-breakdown";
import { deriveMilestones, toRunwayRows } from "./retirement-runway-rows";

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

const stackSum = (row: ReturnType<typeof toRunwayRows>["rows"][number]) =>
  row.takehome +
  row.passive +
  row.yield +
  row.other +
  row.drawdown +
  row.cashReserve +
  row.shortfall;

describe("toRunwayRows - financing stack", () => {
  it("uses take-home to illustrate the pre-retirement expense bar", () => {
    const result = toRunwayRows([
      point({
        age: 30,
        requiredOutflow: 80,
        employmentInflow: 168,
        value: 2_000,
        outflowBreakdown: [
          {
            key: "planned_expense:Food",
            label: "Food",
            sourceType: "planned_expense",
            amount: 50,
          },
          {
            key: "tax:Estimated income tax",
            label: "Estimated income tax",
            sourceType: "tax",
            amount: 30,
          },
        ],
      }),
    ]);

    expect(result.segments.map((s) => s.label)).toEqual(["Take-home"]);
    expect(result.rows[0].expenses).toBe(80);
    expect(result.rows[0].takehome).toBe(80);
    expect(stackSum(result.rows[0])).toBe(80);
    expect(result.rows[0].rawTakehome).toBe(168);
    expect(result.rows[0].fundableAssets).toBe(0);
    expect(result.rows[0].outflowSegments.map((s) => s.label)).toEqual([
      "Food",
      "Estimated income tax",
    ]);
  });

  it("splits outflow categories for contextual hover and breakdown detail", () => {
    const result = toRunwayRows([
      point({
        age: 31,
        requiredOutflow: 110,
        employmentInflow: 200,
        outflowBreakdown: [
          {
            key: "planned_expense:Food",
            label: "Food",
            sourceType: "planned_expense",
            amount: 40,
          },
          {
            key: "planned_expense:Transport",
            label: "Transport",
            sourceType: "planned_expense",
            amount: 30,
          },
          {
            key: "tax:Estimated income tax",
            label: "Estimated income tax",
            sourceType: "tax",
            amount: 25,
          },
          {
            key: "housing_cash:Housing cash payment",
            label: "Housing cash payment",
            sourceType: "housing_cash",
            amount: 15,
          },
        ],
      }),
    ]);

    expect(result.segments.map((s) => s.label)).toEqual(["Take-home"]);
    expect(result.rows[0].outflowSegments.map((s) => s.label)).toEqual([
      "Food",
      "Transport",
      "Estimated income tax",
      "Housing cash payment",
    ]);
    expect(result.rows[0].expenses).toBe(110);
    expect(stackSum(result.rows[0])).toBe(110);
  });

  it("uses retirement financing components without generic retirement labels", () => {
    const result = toRunwayRows([
      point({
        age: 65,
        phase: "post_retirement",
        requiredOutflow: 120,
        cpfLifeInflow: 28,
        investmentDividendInflow: 10,
        principalWithdrawn: 20,
        cashReserveDrawdown: 30,
        goalsGap: 32,
        outflowBreakdown: [
          {
            key: "retirement_spend:Retirement spend need 2051",
            label: "Retirement spend need 2051",
            sourceType: "retirement_spend",
            amount: 120,
          },
        ],
      }),
    ]);

    expect(result.segments.map((s) => s.label)).toEqual([
      "Passive income",
      "Investment income",
      "Investment / ILP drawdown",
      "Cash reserve drawdown",
      "Shortfall",
    ]);
    const row = result.rows[0];
    expect(row.passive).toBe(28);
    expect(row.yield).toBe(10);
    expect(row.drawdown).toBe(20);
    expect(row.cashReserve).toBe(30);
    expect(row.shortfall).toBe(32);
    expect(row.rawCpfLife).toBe(28);
    expect(row.rawPrincipalWithdrawn).toBe(20);
    expect(row.outflowSegments).toEqual([
      {
        key: "outflow:retirement",
        label: "Retirement spending need",
        amount: 120,
      },
    ]);
    expect(stackSum(row)).toBe(120);
  });

  it("does not show recycled cash events as reserve drawdown once cash is not spending down", () => {
    const result = toRunwayRows([
      point({
        age: 69,
        phase: "post_retirement",
        requiredOutflow: 100,
        cpfLifeInflow: 4,
        cashReserveDrawdown: 4,
        goalsGap: 96,
        cash: 1,
      }),
      point({
        age: 70,
        phase: "post_retirement",
        requiredOutflow: 100,
        cpfLifeInflow: 4,
        cashReserveDrawdown: 4,
        goalsGap: 96,
        cash: 1,
      }),
    ]);

    const row = result.rows[1];
    expect(row.passive).toBe(4);
    expect(row.cashReserve).toBe(0);
    expect(row.shortfall).toBe(96);
    expect(stackSum(row)).toBe(100);
  });

  it("exposes net-worth components without changing the net-worth total", () => {
    const result = toRunwayRows([
      point({
        age: 45,
        value: 800,
        cash: 100,
        investmentPrincipal: 200,
        investments: 300,
        cpf: 400,
        propertyNet: 350,
        vehiclesNet: 50,
        liabilities: 300,
      }),
    ]);

    expect(result.rows[0].networth).toBe(800);
    expect(result.rows[0].cashBalance).toBe(100);
    expect(result.rows[0].investmentPrincipal).toBe(200);
    expect(result.rows[0].cpfBalance).toBe(400);
    expect(result.rows[0].propertyNet).toBe(350);
    expect(result.rows[0].vehiclesNet).toBe(50);
    expect(result.rows[0].liabilities).toBe(300);
    expect(result.rows[0].fundableAssets).toBe(300);
  });

  it("returns empty rows and segments for empty input", () => {
    expect(toRunwayRows([])).toEqual({ rows: [], segments: [] });
  });
});

describe("deriveMilestones", () => {
  const series: AgeAssetBreakdownPoint[] = [
    point({ age: 60, requiredOutflow: 78 }),
    point({ age: 62, requiredOutflow: 80, rentalInflow: 22 }),
    point({ age: 64, requiredOutflow: 180 }),
    point({ age: 65, requiredOutflow: 79, phase: "post_retirement", cpfLifeInflow: 28 }),
    point({ age: 80, requiredOutflow: 90, phase: "post_retirement", goalsGap: 0 }),
    point({ age: 85, requiredOutflow: 95, phase: "post_retirement", goalsGap: 40 }),
  ];

  it("derives rental, retirement, one-off goal and shortfall, sorted by age", () => {
    const ms = deriveMilestones(series);
    expect(ms.map((m) => [m.kind, m.age])).toEqual([
      ["rental", 62],
      ["goal", 64],
      ["retirement", 65],
      ["shortfall", 85],
    ]);
  });

  it("falls back to CPF LIFE onset when no phase flag is present", () => {
    const noPhase = [
      point({ age: 64, requiredOutflow: 80 }),
      point({ age: 65, requiredOutflow: 80, cpfLifeInflow: 28 }),
    ];
    const retire = deriveMilestones(noPhase).find((m) => m.kind === "retirement");
    expect(retire?.age).toBe(65);
  });

  it("emits no goal milestone without an interior spike", () => {
    const flat = [
      point({ age: 60, requiredOutflow: 80 }),
      point({ age: 61, requiredOutflow: 82 }),
      point({ age: 62, requiredOutflow: 84 }),
    ];
    expect(deriveMilestones(flat).some((m) => m.kind === "goal")).toBe(false);
  });
});
