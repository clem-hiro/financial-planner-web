import { describe, expect, it } from "vitest";
import type { SetupEvaluationContext } from "@/domain/setup/context";
import {
  buildSetupHubSnapshot,
  evaluateSetupModule,
  pickRecommendedSetupStep,
  summarizeSetupProgress,
} from "@/domain/setup/evaluators";

function emptyContext(
  overrides: Partial<SetupEvaluationContext> = {}
): SetupEvaluationContext {
  return {
    profile: null,
    investments: [],
    cashAccounts: [],
    liabilities: [],
    housingLoans: [],
    vehicles: [],
    cpf: null,
    goals: [],
    budgetLines: [],
    ...overrides,
  };
}

describe("setup evaluators", () => {
  it("profile is complete when name and birth date exist", () => {
    const result = evaluateSetupModule(
      "profile",
      emptyContext({
        profile: {
          id: "u1",
          profile_type: "client",
          advisor_user_id: null,
          display_name: "Alex",
          birth_date: "1990-01-01",
          monthly_income: null,
          salary_frequency: null,
          annual_bonus: null,
          savings_target_monthly: null,
          fixed_expenses_monthly: null,
          debt_obligations_monthly: null,
          monthly_gross_salary: null,
          annual_salary_growth_nominal: null,
          expense_growth_nominal: null,
          cpf_age_band: null,
          target_retirement_age: null,
          retirement_monthly_spend_goal: null,
          retirement_dividend_yield_annual: null,
          retirement_withdrawal_rate_annual: null,
          onboarding_required: false,
          onboarding_step: null,
          onboarding_completed_at: null,
          lifestyle_profile: null,
          budgeting_strategy: null,
          onboarding_confidence_level: null,
          budget_generation_source: null,
          estimated_budget_mode: false,
          food_spend_band: null,
          base_currency: "SGD",
          salary_increment_month: null,
          last_salary_review_at: null,
          created_at: "2026-01-01T00:00:00Z",
        },
      })
    );
    expect(result.status).toBe("complete");
  });

  it("loans partial when liability exists without repayment metadata", () => {
    const result = evaluateSetupModule(
      "loans",
      emptyContext({
        liabilities: [
          {
            id: "l1",
            user_id: "u1",
            name: "Card",
            balance: "1000",
            created_at: "2026-01-02T00:00:00Z",
          },
        ],
      })
    );
    expect(result.status).toBe("partial");
  });

  it("retirement partial when only target age is set", () => {
    const result = evaluateSetupModule(
      "retirement",
      emptyContext({
        profile: {
          id: "u1",
          profile_type: "client",
          advisor_user_id: null,
          display_name: null,
          birth_date: null,
          monthly_income: null,
          salary_frequency: null,
          annual_bonus: null,
          savings_target_monthly: null,
          fixed_expenses_monthly: null,
          debt_obligations_monthly: null,
          monthly_gross_salary: null,
          annual_salary_growth_nominal: null,
          expense_growth_nominal: null,
          cpf_age_band: null,
          target_retirement_age: 65,
          retirement_monthly_spend_goal: null,
          retirement_dividend_yield_annual: null,
          retirement_withdrawal_rate_annual: null,
          onboarding_required: false,
          onboarding_step: null,
          onboarding_completed_at: null,
          lifestyle_profile: null,
          budgeting_strategy: null,
          onboarding_confidence_level: null,
          budget_generation_source: null,
          estimated_budget_mode: false,
          food_spend_band: null,
          base_currency: "SGD",
          salary_increment_month: null,
          last_salary_review_at: null,
          created_at: "2026-01-01T00:00:00Z",
        },
      })
    );
    expect(result.status).toBe("partial");
  });

  it("recommends highest-priority incomplete module", () => {
    const modules = buildSetupHubSnapshot("u1", emptyContext()).modules;
    const step = pickRecommendedSetupStep(modules);
    expect(step?.moduleId).toBe("profile");
  });

  it("summarizes progress from module percentages", () => {
    const modules = buildSetupHubSnapshot(
      "u1",
      emptyContext({
        profile: {
          id: "u1",
          profile_type: "client",
          advisor_user_id: null,
          display_name: "Alex",
          birth_date: "1990-01-01",
          monthly_income: "5000",
          salary_frequency: "monthly",
          annual_bonus: null,
          savings_target_monthly: null,
          fixed_expenses_monthly: "2000",
          debt_obligations_monthly: null,
          monthly_gross_salary: null,
          annual_salary_growth_nominal: null,
          expense_growth_nominal: null,
          cpf_age_band: null,
          target_retirement_age: null,
          retirement_monthly_spend_goal: null,
          retirement_dividend_yield_annual: null,
          retirement_withdrawal_rate_annual: null,
          onboarding_required: false,
          onboarding_step: null,
          onboarding_completed_at: null,
          lifestyle_profile: null,
          budgeting_strategy: null,
          onboarding_confidence_level: null,
          budget_generation_source: null,
          estimated_budget_mode: false,
          food_spend_band: null,
          base_currency: "SGD",
          salary_increment_month: null,
          last_salary_review_at: null,
          created_at: "2026-01-01T00:00:00Z",
        },
      })
    ).modules;
    const summary = summarizeSetupProgress(modules);
    expect(summary.completedCount).toBeGreaterThan(0);
    expect(summary.completionPercent).toBeGreaterThan(0);
  });
});
