import type { DashboardPayload } from "@/data/dashboard";
import type { ProfileRow } from "@/data/supabase/types";
import { profileMonthlyGross, profileSalaryTakeHomeMonthly } from "@/data/mappers";
import { formatYearMonth } from "@/lib/dates";

/** Lightweight labels for roster cards (no heavy dashboard fetch). */
export type AdvisorClientRosterSignals = {
  savingsHealthLabel: string;
  budgetHealthLabel: string;
  riskBand: "low" | "medium" | "high";
  tags: string[];
  nextActionHint: string;
};

/** Richer signals for the client workspace header (uses dashboard month payload). */
export type AdvisorClientWorkspaceSignals = AdvisorClientRosterSignals & {
  financialHealthHeadline: string;
  savingsRatePercent: number | null;
  monthlySurplus: number | null;
  budgetOnTrack: boolean | null;
};

function dec(v: string | number | null | undefined): number {
  if (v == null || v === "") return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function effectiveMonthlyIncome(
  monthlyIncome: string | number | null | undefined,
  monthlyGross: string | number | null | undefined
): number | null {
  const fromIncome = dec(monthlyIncome);
  if (fromIncome > 0) return fromIncome;
  const g = dec(monthlyGross);
  return g > 0 ? g : null;
}

/**
 * Derive roster-level badges from profile list columns only.
 * Opportunity detection / AI remain future layers — keep outputs deterministic.
 */
export function advisorClientRosterSignals(input: {
  monthly_income: string | number | null | undefined;
  monthly_gross_salary: string | number | null | undefined;
  savings_target_monthly: string | number | null | undefined;
  fixed_expenses_monthly: string | number | null | undefined;
  onboarding_completed_at: string | null | undefined;
  onboarding_required: boolean;
  last_expense_spent_at: string | null | undefined;
  expense_count: string | number | null | undefined;
}): AdvisorClientRosterSignals {
  const income = effectiveMonthlyIncome(
    input.monthly_income,
    input.monthly_gross_salary
  );
  const savingsTarget = dec(input.savings_target_monthly);
  const fixed = dec(input.fixed_expenses_monthly);
  const expenseN = dec(input.expense_count);

  let savingsHealthLabel = "Unknown";
  let savingsTag: string | null = null;
  if (income != null && income > 0) {
    const rate = savingsTarget / income;
    if (rate >= 0.25) {
      savingsHealthLabel = "Strong saver";
      savingsTag = "Strong Saver";
    } else if (rate >= 0.12) {
      savingsHealthLabel = "Healthy";
    } else if (rate > 0) {
      savingsHealthLabel = "Room to grow";
      savingsTag = "Savings focus";
    } else {
      savingsHealthLabel = "No target set";
      savingsTag = "Needs Review";
    }
  }

  let budgetHealthLabel = "Unknown";
  if (income != null && income > 0 && fixed > 0) {
    const burden = fixed / income;
    if (burden > 0.75) {
      budgetHealthLabel = "Tight cashflow";
    } else if (burden > 0.55) {
      budgetHealthLabel = "Elevated fixed costs";
    } else {
      budgetHealthLabel = "Manageable";
    }
  } else if (income != null && income > 0) {
    budgetHealthLabel = "Incomplete setup";
  }

  const tags: string[] = [];
  if (savingsTag) tags.push(savingsTag);
  if (!input.onboarding_completed_at && input.onboarding_required) {
    tags.push("Onboarding");
  }
  if (income != null && income > 0 && fixed / income > 0.65) {
    tags.push("Budget Risk");
  }
  if (income != null && income > 0 && savingsTarget / income >= 0.2 && expenseN > 0) {
    tags.push("High Opportunity");
  }

  let riskBand: AdvisorClientRosterSignals["riskBand"] = "low";
  if (income != null && income > 0 && fixed / income > 0.72) riskBand = "high";
  else if (
    income != null &&
    income > 0 &&
    (fixed / income > 0.58 || savingsTarget / income < 0.08)
  ) {
    riskBand = "medium";
  }

  let nextActionHint = "Review plan in workspace";
  if (!input.onboarding_completed_at && input.onboarding_required) {
    nextActionHint = "Complete onboarding check-in";
  } else if (!input.last_expense_spent_at && expenseN === 0) {
    nextActionHint = "Encourage spending capture";
  } else if (income == null) {
    nextActionHint = "Confirm income assumptions";
  }

  return {
    savingsHealthLabel,
    budgetHealthLabel,
    riskBand,
    tags: [...new Set(tags)].slice(0, 4),
    nextActionHint,
  };
}

export function advisorClientWorkspaceSignals(
  profile: ProfileRow | null,
  payload: DashboardPayload | null
): AdvisorClientWorkspaceSignals {
  const hasSpend = (payload?.monthlyExpensesLoggedTotal ?? 0) > 0;
  const roster = advisorClientRosterSignals({
    monthly_income: profile?.monthly_income ?? null,
    monthly_gross_salary: profile?.monthly_gross_salary ?? null,
    savings_target_monthly: profile?.savings_target_monthly ?? null,
    fixed_expenses_monthly: profile?.fixed_expenses_monthly ?? null,
    onboarding_completed_at: profile?.onboarding_completed_at ?? null,
    onboarding_required: !!profile?.onboarding_required,
    last_expense_spent_at: null,
    expense_count: hasSpend ? 1 : 0,
  });

  const refYm = payload?.month ?? formatYearMonth(new Date());
  const income =
    profileSalaryTakeHomeMonthly(profile, refYm) ?? profileMonthlyGross(profile);
  const savingsRate =
    payload?.savingsRate != null && Number.isFinite(payload.savingsRate)
      ? Math.round(payload.savingsRate * 1000) / 10
      : null;
  const monthlySurplus = payload?.takeHomeMinusExpenses ?? null;
  const budgetOnTrack = payload?.monthlyBudgetAggregate?.onTrack ?? null;

  let financialHealthHeadline = "Snapshot incomplete";
  if (payload && income != null) {
    if (budgetOnTrack === false && (payload.monthlyBudgetAggregate?.overBy ?? 0) > 0) {
      financialHealthHeadline = "Budget pressure this month";
    } else if (savingsRate != null && savingsRate >= 20) {
      financialHealthHeadline = "Solid savings discipline";
    } else if (savingsRate != null && savingsRate < 8) {
      financialHealthHeadline = "Savings runway at risk";
    } else {
      financialHealthHeadline = "Balanced trajectory";
    }
  }

  return {
    ...roster,
    financialHealthHeadline,
    savingsRatePercent: savingsRate,
    monthlySurplus,
    budgetOnTrack,
  };
}
