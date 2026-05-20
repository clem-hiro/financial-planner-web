import type { BudgetVsActualResult } from "@/domain/finance/budget";

export type BudgetReviewLineInput = {
  id: string;
  category: string;
  baseAmount: number;
  startYearMonth?: string | null;
  endYearMonth?: string | null;
};

export type BudgetReviewOverride = {
  lineId: string;
  category: string;
  baseAmount: number;
  overrideAmount: number;
};

export type BudgetReviewStepId =
  | "planned-categories"
  | "actual-spend"
  | "temporary-overrides"
  | "unbudgeted-spend"
  | "inactive-lines";

export type BudgetReviewStep = {
  id: BudgetReviewStepId;
  label: string;
  status: "done" | "review" | "empty";
  summary: string;
  detail: string;
  count: number;
};

export type BudgetReviewWorkflow = {
  status: "ready" | "attention" | "empty";
  month: string;
  summary: string;
  steps: BudgetReviewStep[];
  overspentCategories: BudgetVsActualResult["lines"];
  unusedCategories: BudgetVsActualResult["lines"];
  overrides: BudgetReviewOverride[];
  inactiveLines: BudgetReviewLineInput[];
};

export function buildBudgetReviewWorkflow({
  month,
  monthly,
  activeMonthlyLines,
  inactiveMonthlyLines,
  overrideByLineId,
  unbudgetedMonthlyCount,
  unbudgetedMonthlyTotal,
}: {
  month: string;
  monthly: BudgetVsActualResult;
  activeMonthlyLines: BudgetReviewLineInput[];
  inactiveMonthlyLines: BudgetReviewLineInput[];
  overrideByLineId: Record<string, number>;
  unbudgetedMonthlyCount: number;
  unbudgetedMonthlyTotal: number;
}): BudgetReviewWorkflow {
  const overspentCategories = monthly.lines
    .filter((line) => line.over)
    .sort((a, b) => b.spent - b.budget - (a.spent - a.budget));
  const unusedCategories = monthly.lines
    .filter((line) => line.spent === 0 && line.budget > 0)
    .sort((a, b) => b.budget - a.budget);
  const overrides = activeMonthlyLines
    .filter((line) => overrideByLineId[line.id] !== undefined)
    .map((line) => ({
      lineId: line.id,
      category: line.category,
      baseAmount: line.baseAmount,
      overrideAmount: overrideByLineId[line.id]!,
    }));

  const hasPlan = activeMonthlyLines.length > 0;
  const needsAttention =
    !hasPlan ||
    overspentCategories.length > 0 ||
    overrides.length > 0 ||
    unbudgetedMonthlyCount > 0 ||
    inactiveMonthlyLines.length > 0;

  const steps: BudgetReviewStep[] = [
    {
      id: "planned-categories",
      label: "Confirm planned categories",
      status: hasPlan ? "done" : "empty",
      summary: hasPlan
        ? `${activeMonthlyLines.length} active monthly categories`
        : "No active monthly categories",
      detail: hasPlan
        ? "Check that each planned line still reflects the client's current lifestyle and commitments."
        : "Add starter categories before reviewing monthly spending.",
      count: activeMonthlyLines.length,
    },
    {
      id: "actual-spend",
      label: "Compare actual spend",
      status: overspentCategories.length > 0 ? "review" : hasPlan ? "done" : "empty",
      summary:
        overspentCategories.length > 0
          ? `${overspentCategories.length} categories over plan`
          : hasPlan
            ? "No budgeted category is over plan"
            : "No plan to compare yet",
      detail:
        overspentCategories.length > 0
          ? "Review whether overspending is temporary, needs a one-month override, or should change the base monthly plan."
          : "Use this check every month after expenses are logged.",
      count: overspentCategories.length,
    },
    {
      id: "temporary-overrides",
      label: "Review temporary overrides",
      status: overrides.length > 0 ? "review" : "done",
      summary:
        overrides.length > 0
          ? `${overrides.length} overrides active for ${month}`
          : "No temporary overrides this month",
      detail:
        overrides.length > 0
          ? "Decide whether each override should remain one-off, be cleared, or become the new base budget."
          : "One-off monthly changes are clear.",
      count: overrides.length,
    },
    {
      id: "unbudgeted-spend",
      label: "Map uncategorised spending",
      status: unbudgetedMonthlyCount > 0 ? "review" : "done",
      summary:
        unbudgetedMonthlyCount > 0
          ? `${unbudgetedMonthlyCount} expenses outside plan`
          : "No spend outside planned categories",
      detail:
        unbudgetedMonthlyCount > 0
          ? `Create or adjust budget lines for uncategorised monthly spend totalling ${unbudgetedMonthlyTotal.toFixed(2)}.`
          : "All monthly expenses are mapped to active planned categories.",
      count: unbudgetedMonthlyCount,
    },
    {
      id: "inactive-lines",
      label: "Check scheduled lines",
      status: inactiveMonthlyLines.length > 0 ? "review" : "done",
      summary:
        inactiveMonthlyLines.length > 0
          ? `${inactiveMonthlyLines.length} scheduled lines inactive`
          : "No inactive scheduled lines",
      detail:
        inactiveMonthlyLines.length > 0
          ? "Review lines that start later or ended already, especially debt repayments and temporary categories."
          : "All monthly lines are active for this review month.",
      count: inactiveMonthlyLines.length,
    },
  ];

  return {
    status: !hasPlan ? "empty" : needsAttention ? "attention" : "ready",
    month,
    summary: !hasPlan
      ? "Set up monthly categories before running a review."
      : needsAttention
        ? "Monthly review has items to check before rolling the plan forward."
        : "Monthly review is clear; planned categories and overrides look current.",
    steps,
    overspentCategories,
    unusedCategories,
    overrides,
    inactiveLines: inactiveMonthlyLines,
  };
}
