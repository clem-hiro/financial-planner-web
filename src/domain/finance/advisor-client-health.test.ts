import { describe, expect, it } from "vitest";
import {
  advisorClientRosterSignals,
  advisorClientWorkspaceSignals,
} from "@/domain/finance/advisor-client-health";
import type { DashboardPayload } from "@/data/dashboard";
import type { ProfileRow } from "@/data/supabase/types";

describe("advisorClientRosterSignals", () => {
  it("flags onboarding and savings when income missing", () => {
    const s = advisorClientRosterSignals({
      monthly_income: null,
      monthly_gross_salary: null,
      savings_target_monthly: null,
      fixed_expenses_monthly: null,
      onboarding_completed_at: null,
      onboarding_required: true,
      last_expense_spent_at: null,
      expense_count: 0,
    });
    expect(s.tags).toContain("Onboarding");
    expect(s.nextActionHint).toContain("onboarding");
  });

  it("labels strong saver when target is high vs income", () => {
    const s = advisorClientRosterSignals({
      monthly_income: "10000",
      monthly_gross_salary: null,
      savings_target_monthly: "3000",
      fixed_expenses_monthly: "4000",
      onboarding_completed_at: "2026-01-01",
      onboarding_required: false,
      last_expense_spent_at: "2026-05-01",
      expense_count: 3,
    });
    expect(s.savingsHealthLabel).toBe("Strong saver");
    expect(s.tags.some((t) => t.includes("Strong"))).toBe(true);
  });
});

describe("advisorClientWorkspaceSignals", () => {
  it("merges dashboard budget stress into headline", () => {
    const profile = {
      id: "u1",
      profile_type: "client" as const,
      advisor_user_id: "a1",
      monthly_income: "8000",
      monthly_gross_salary: null,
      savings_target_monthly: "1200",
      fixed_expenses_monthly: "3000",
      onboarding_required: false,
      onboarding_completed_at: "2026-01-01",
      onboarding_step: null,
      display_name: "Test",
      salary_frequency: "monthly" as const,
      annual_bonus: null,
      debt_obligations_monthly: null,
      annual_salary_growth_nominal: null,
      cpf_age_band: null,
      birth_date: null,
      target_retirement_age: null,
      retirement_monthly_spend_goal: null,
      retirement_dividend_yield_annual: null,
      retirement_withdrawal_rate_annual: null,
      lifestyle_profile: null,
      budgeting_strategy: null,
      onboarding_confidence_level: null,
      budget_generation_source: null,
      estimated_budget_mode: false,
      food_spend_band: null,
      base_currency: "SGD",
      created_at: "2026-01-01",
    } satisfies ProfileRow;

    const payload = {
      monthlyBudgetAggregate: { onTrack: false, overBy: 400 },
      takeHomeMinusExpenses: 200,
      savingsRate: 0.05,
    } as unknown as DashboardPayload;

    const s = advisorClientWorkspaceSignals(profile, payload);
    expect(s.financialHealthHeadline).toContain("Budget");
    expect(s.budgetOnTrack).toBe(false);
  });
});
