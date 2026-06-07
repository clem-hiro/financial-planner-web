import { describe, expect, it } from "vitest";
import { analyzeGoalFeasibility } from "./goal-feasibility";

const today = new Date(2026, 4, 24); // 2026-05-24 local

describe("analyzeGoalFeasibility", () => {
  it("flags raise_contribution when surplus can fund required but plan is low", () => {
    const result = analyzeGoalFeasibility({
      today,
      targetDateYmd: "2028-12-31",
      currentAmount: 10_000,
      targetAmount: 50_000,
      plannedMonthly: 500,
      expectedAnnualReturn: 0,
      affordableMonthly: 2000,
    });

    expect(result.status).toBe("raise_contribution");
    expect(result.requiredMonthly).not.toBeNull();
    expect(result.affordableMonthly).toBe(2000);
    expect((result.requiredMonthly ?? 0) <= 2000).toBe(true);
  });

  it("flags not_achievable_on_date with spend cut and later suggested date", () => {
    const result = analyzeGoalFeasibility({
      today,
      targetDateYmd: "2027-06-30",
      currentAmount: 0,
      targetAmount: 24_000,
      plannedMonthly: 500,
      expectedAnnualReturn: 0,
      affordableMonthly: 500,
    });

    expect(result.status).toBe("not_achievable_on_date");
    expect(result.spendCutMonthly).not.toBeNull();
    expect((result.spendCutMonthly ?? 0) > 0).toBe(true);
    expect(result.suggestedDateYmd).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.extraPeriodsVsDeadline).not.toBeNull();
  });

  it("flags cash_constrained when math is on track but funded amount is lower", () => {
    const result = analyzeGoalFeasibility({
      today,
      targetDateYmd: "2030-12-31",
      currentAmount: 20_000,
      targetAmount: 40_000,
      plannedMonthly: 800,
      expectedAnnualReturn: 0,
      affordableMonthly: 300,
    });

    expect(result.deadline.kind).toBe("on_track");
    expect(result.status).toBe("cash_constrained");
  });

  it("uses raise_contribution without cash context when income unknown", () => {
    const result = analyzeGoalFeasibility({
      today,
      targetDateYmd: "2028-12-31",
      currentAmount: 0,
      targetAmount: 50_000,
      plannedMonthly: 200,
      expectedAnnualReturn: 0,
      affordableMonthly: null,
    });

    expect(result.status).toBe("raise_contribution");
  });

  it("flags slower ETA without a target date when affordable < planned", () => {
    const result = analyzeGoalFeasibility({
      today,
      targetDateYmd: null,
      currentAmount: 0,
      targetAmount: 12_000,
      plannedMonthly: 1000,
      expectedAnnualReturn: 0,
      affordableMonthly: 400,
    });

    expect(result.status).toBe("no_deadline_affordable_slower");
    expect(result.etaMonthsAtAffordable).not.toBeNull();
    expect(result.etaMonthsAtPlanned).not.toBeNull();
    expect(result.etaMonthsAtAffordable!).toBeGreaterThan(
      result.etaMonthsAtPlanned!
    );
  });
});
