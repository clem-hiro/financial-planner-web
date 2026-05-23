import { describe, expect, it } from "vitest";
import { analyzeGoalPriorityTradeoff } from "./goal-priority-tradeoff";

describe("analyzeGoalPriorityTradeoff", () => {
  it("funds higher-priority goals first until surplus runs out", () => {
    const result = analyzeGoalPriorityTradeoff({
      takeHomeMonthly: 5000,
      monthlyExpensesTotal: 3000,
      goals: [
        {
          id: "a",
          title: "Emergency",
          display_order: 0,
          monthly_contribution: 1500,
        },
        {
          id: "b",
          title: "House",
          display_order: 1,
          monthly_contribution: 1200,
        },
        {
          id: "c",
          title: "Travel",
          display_order: 2,
          monthly_contribution: 500,
        },
      ],
    });

    expect(result.surplusBeforeGoals).toBe(2000);
    expect(result.totalPlannedMonthly).toBe(3200);
    expect(result.overCommitmentMonthly).toBe(1200);
    expect(result.lines[0]).toMatchObject({
      goalId: "a",
      fundedMonthly: 1500,
      shortfallMonthly: 0,
    });
    expect(result.lines[1]).toMatchObject({
      goalId: "b",
      fundedMonthly: 500,
      shortfallMonthly: 700,
    });
    expect(result.lines[2]).toMatchObject({
      goalId: "c",
      fundedMonthly: 0,
      shortfallMonthly: 500,
    });
    expect(result.unallocatedSurplus).toBe(0);
  });

  it("leaves unallocated surplus when plans fit", () => {
    const result = analyzeGoalPriorityTradeoff({
      takeHomeMonthly: 6000,
      monthlyExpensesTotal: 2000,
      goals: [
        {
          id: "a",
          title: "A",
          display_order: 0,
          monthly_contribution: 500,
        },
        {
          id: "b",
          title: "B",
          display_order: 1,
          monthly_contribution: 300,
        },
      ],
    });

    expect(result.overCommitmentMonthly).toBe(0);
    expect(result.unallocatedSurplus).toBe(3200);
    expect(result.lines.every((l) => l.shortfallMonthly === 0)).toBe(true);
  });
});
