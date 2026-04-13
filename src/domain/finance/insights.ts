import type { Money } from "./types";

export type DashboardInsightInput = {
  monthlyIncome: Money | null;
  monthlyExpensesTotal: Money;
  savingsRate: number | null;
  netWorth: Money;
};

/**
 * Rule-based dashboard copy only (no AI).
 */
export function buildDashboardInsights(
  input: DashboardInsightInput
): string[] {
  const insights: string[] = [];

  if (
    input.monthlyIncome != null &&
    input.monthlyIncome > 0 &&
    input.monthlyExpensesTotal > input.monthlyIncome
  ) {
    insights.push(
      "Expenses exceeded your stated monthly take-home pay this period."
    );
  }

  if (input.savingsRate != null) {
    if (input.savingsRate < 0) {
      insights.push(
        "You are spending more than your stated take-home pay this month."
      );
    } else if (input.savingsRate >= 0.2) {
      insights.push("Savings rate is at or above 20% — strong habit.");
    } else if (input.savingsRate < 0.1) {
      insights.push("Savings rate is below 10%; consider trimming discretionary spend.");
    }
  } else if (input.monthlyIncome == null || input.monthlyIncome <= 0) {
    insights.push(
      "Add monthly take-home pay in your profile to see savings rate and richer insights."
    );
  }

  if (input.netWorth < 0) {
    insights.push("Net worth is negative — focus on high-interest debt and emergency fund.");
  }

  if (insights.length === 0) {
    insights.push("Keep logging expenses and updating investments for clearer trends.");
  }

  return insights;
}
