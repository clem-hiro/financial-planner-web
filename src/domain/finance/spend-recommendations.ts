import type { Money } from "./types";

export type SpendRecommendationsInput = {
  monthlyTakeHome: Money | null;
  monthlyExpensesTotal: Money;
  savingsRate: number | null;
  budgetAggregate: { onTrack: boolean; overBy: number };
  topOverBudget: Array<{ categoryLabel: string; overBy: number }>;
};

function fmt(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

/**
 * Rule-based guidance for whether to spend less this month (no AI).
 * Uses take-home vs all logged expenses in the month, savings rate, and
 * monthly budget lines vs monthly-tagged spend only.
 */
export function buildSpendRecommendationsForMonth(
  input: SpendRecommendationsInput
): string[] {
  const lines: string[] = [];
  const {
    monthlyTakeHome,
    monthlyExpensesTotal,
    savingsRate,
    budgetAggregate,
    topOverBudget,
  } = input;

  if (
    monthlyTakeHome != null &&
    monthlyTakeHome > 0 &&
    monthlyExpensesTotal > monthlyTakeHome
  ) {
    const over = monthlyExpensesTotal - monthlyTakeHome;
    lines.push(
      `Spend less or adjust activity: logged expenses (${fmt(monthlyExpensesTotal)}) are above your stated take-home (${fmt(monthlyTakeHome)}) by about ${fmt(over)} this month.`
    );
  } else if (savingsRate != null && savingsRate < 0) {
    lines.push(
      "Savings rate is negative this month — reduce discretionary spending or review logged amounts."
    );
  }

  if (!budgetAggregate.onTrack && budgetAggregate.overBy > 0) {
    lines.push(
      `Across monthly budget lines, spend ran over plan by about ${fmt(budgetAggregate.overBy)} (monthly-tagged categories vs budget). Tighten categories above their line first.`
    );
  }

  for (const row of topOverBudget) {
    if (row.overBy > 0) {
      lines.push(
        `Category "${row.categoryLabel}" is about ${fmt(row.overBy)} over that line — a good place to trim if you need to spend less.`
      );
    }
  }

  if (monthlyTakeHome == null || monthlyTakeHome <= 0) {
    lines.push(
      "Set monthly take-home on your profile so we can compare spending to income more clearly."
    );
  }

  if (
    monthlyTakeHome != null &&
    monthlyTakeHome > 0 &&
    monthlyExpensesTotal < monthlyTakeHome
  ) {
    const surplus = monthlyTakeHome - monthlyExpensesTotal;
    lines.push(
      `By-age projected cash grows by ~${fmt(surplus)}/mo from this surplus (take-home minus this month’s expenses). If you auto-invest most of it, keep investment “monthly contribution” aligned so you do not double-count the same money in both places.`
    );
  }

  if (lines.length === 0) {
    lines.push(
      "No strong overspend signal vs income and monthly budget lines this month — keep tracking for trends."
    );
  }

  return lines;
}
