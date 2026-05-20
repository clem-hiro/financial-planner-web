import { describe, expect, it } from "vitest";
import { buildBudgetReviewWorkflow } from "./budget-review";
import type { BudgetVsActualResult } from "./budget";

const monthly: BudgetVsActualResult = {
  totals: {
    budget: 1_000,
    spent: 1_150,
    remaining: -150,
  },
  lines: [
    {
      categoryLabel: "groceries",
      categoryKey: "groceries",
      budget: 500,
      spent: 650,
      remaining: -150,
      over: true,
    },
    {
      categoryLabel: "transport",
      categoryKey: "transport",
      budget: 200,
      spent: 100,
      remaining: 100,
      over: false,
    },
    {
      categoryLabel: "subscriptions",
      categoryKey: "subscriptions",
      budget: 300,
      spent: 0,
      remaining: 300,
      over: false,
    },
  ],
};

describe("buildBudgetReviewWorkflow", () => {
  it("flags overspend, overrides, unbudgeted spend, and inactive lines for review", () => {
    const review = buildBudgetReviewWorkflow({
      month: "2026-05",
      monthly,
      activeMonthlyLines: [
        { id: "groceries", category: "groceries", baseAmount: 500 },
        { id: "transport", category: "transport", baseAmount: 180 },
        { id: "subscriptions", category: "subscriptions", baseAmount: 300 },
      ],
      inactiveMonthlyLines: [
        {
          id: "loan",
          category: "debt repayments - car loan",
          baseAmount: 800,
          endYearMonth: "2026-04",
        },
      ],
      overrideByLineId: { transport: 200 },
      unbudgetedMonthlyCount: 2,
      unbudgetedMonthlyTotal: 125.5,
    });

    expect(review.status).toBe("attention");
    expect(review.overspentCategories.map((line) => line.categoryKey)).toEqual([
      "groceries",
    ]);
    expect(review.unusedCategories.map((line) => line.categoryKey)).toEqual([
      "subscriptions",
    ]);
    expect(review.overrides).toEqual([
      {
        lineId: "transport",
        category: "transport",
        baseAmount: 180,
        overrideAmount: 200,
      },
    ]);
    expect(
      review.steps.filter((step) => step.status === "review").map((step) => step.id)
    ).toEqual([
      "actual-spend",
      "temporary-overrides",
      "unbudgeted-spend",
      "inactive-lines",
    ]);
  });

  it("returns ready when categories are active with no review items", () => {
    const review = buildBudgetReviewWorkflow({
      month: "2026-05",
      monthly: {
        totals: {
          budget: 500,
          spent: 200,
          remaining: 300,
        },
        lines: [
          {
            categoryLabel: "groceries",
            categoryKey: "groceries",
            budget: 500,
            spent: 200,
            remaining: 300,
            over: false,
          },
        ],
      },
      activeMonthlyLines: [
        { id: "groceries", category: "groceries", baseAmount: 500 },
      ],
      inactiveMonthlyLines: [],
      overrideByLineId: {},
      unbudgetedMonthlyCount: 0,
      unbudgetedMonthlyTotal: 0,
    });

    expect(review.status).toBe("ready");
    expect(review.summary).toContain("clear");
    expect(review.steps.every((step) => step.status === "done")).toBe(true);
  });

  it("returns empty when no monthly categories apply", () => {
    const review = buildBudgetReviewWorkflow({
      month: "2026-05",
      monthly: {
        totals: {
          budget: 0,
          spent: 0,
          remaining: 0,
        },
        lines: [],
      },
      activeMonthlyLines: [],
      inactiveMonthlyLines: [],
      overrideByLineId: {},
      unbudgetedMonthlyCount: 0,
      unbudgetedMonthlyTotal: 0,
    });

    expect(review.status).toBe("empty");
    expect(review.steps[0]).toMatchObject({
      id: "planned-categories",
      status: "empty",
    });
  });
});
