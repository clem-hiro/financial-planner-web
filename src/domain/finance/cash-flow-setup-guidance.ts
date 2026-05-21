import type { ProfileRow } from "@/data/supabase/types";
import { isFinancialProfileIncomplete } from "@/data/financial-profile";
import type { BudgetPathVariant } from "@/lib/setup-urls";
import { setupTabPath } from "@/lib/setup-urls";

export type CashFlowSetupGapId = "income" | "budget_lines" | "budget_lens";

export type CashFlowSetupGap = {
  id: CashFlowSetupGapId;
  title: string;
  detail: string;
  ctaHref: string;
  ctaLabel: string;
};

export type CashFlowSetupGuidanceInput = {
  profile: ProfileRow | null;
  monthlyIncome: number | null;
  activeMonthlyBudgetLineCount: number;
  pathVariant: BudgetPathVariant;
  month: string;
  calendarYear: number;
};

function hasBudgetLensSaved(profile: ProfileRow | null): boolean {
  if (!profile) return false;
  const lifestyle =
    profile.lifestyle_profile != null &&
    String(profile.lifestyle_profile).trim() !== "";
  const strategy =
    profile.budgeting_strategy != null &&
    String(profile.budgeting_strategy).trim() !== "";
  return lifestyle && strategy;
}

function incomeAnchor(
  pathVariant: BudgetPathVariant,
  month: string,
  calendarYear: number
): string {
  if (pathVariant === "planning") {
    return "#planning-cashflow-profile";
  }
  return setupTabPath("profile", { month, year: String(calendarYear) });
}

function budgetLensAnchor(
  pathVariant: BudgetPathVariant,
  month: string,
  calendarYear: number
): string {
  if (pathVariant === "planning") {
    return "#planning-cashflow-lens";
  }
  return `${setupTabPath("budget", { month, year: String(calendarYear) })}#budget-plan-lens`;
}

/**
 * Ordered checklist of what still blocks useful cash-flow views.
 * Empty when income and at least one active monthly budget line exist.
 */
export function cashFlowSetupGaps(
  input: CashFlowSetupGuidanceInput
): CashFlowSetupGap[] {
  const gaps: CashFlowSetupGap[] = [];
  const incomeMissing =
    isFinancialProfileIncomplete(input.profile) ||
    input.monthlyIncome == null ||
    input.monthlyIncome <= 0;
  const noMonthlyPlan = input.activeMonthlyBudgetLineCount <= 0;
  const lensMissing = !hasBudgetLensSaved(input.profile);

  if (incomeMissing) {
    gaps.push({
      id: "income",
      title: "Add monthly take-home income",
      detail:
        "Safe-to-spend, surplus charts, and income-aware quick-add presets stay approximate until income is saved.",
      ctaHref: incomeAnchor(
        input.pathVariant,
        input.month,
        input.calendarYear
      ),
      ctaLabel: "Set income",
    });
  }

  if (noMonthlyPlan) {
    gaps.push({
      id: "budget_lines",
      title: "Create your monthly spending plan",
      detail:
        "Add a few categories (or use the starter lens below) so monthly review and guidance can compare plan vs actual spend.",
      ctaHref: "#budget-quick-add",
      ctaLabel: "Quick-add categories",
    });
  }

  if (lensMissing && (incomeMissing || noMonthlyPlan)) {
    gaps.push({
      id: "budget_lens",
      title: "Use a starter budget lens (optional)",
      detail:
        "Pick a lifestyle and savings style to generate Singapore-oriented starter lines — helpful when you are not sure what to allocate yet.",
      ctaHref: budgetLensAnchor(
        input.pathVariant,
        input.month,
        input.calendarYear
      ),
      ctaLabel: "Open budget lens",
    });
  }

  return gaps;
}

export function shouldShowCashFlowSetupGuidance(
  input: CashFlowSetupGuidanceInput
): boolean {
  return cashFlowSetupGaps(input).length > 0;
}
