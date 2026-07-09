import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BudgetLineRow, ProfileRow } from "@/data/supabase/types";

const h = vi.hoisted(() => {
  const profile: ProfileRow = {
    id: "budget-cashflow-client",
    profile_type: "client",
    advisor_user_id: null,
    display_name: "Budget Cashflow Client",
    monthly_income: "5000",
    salary_frequency: "monthly",
    annual_bonus: "0",
    savings_target_monthly: "0",
    fixed_expenses_monthly: "0",
    debt_obligations_monthly: "0",
    monthly_gross_salary: null,
    annual_salary_growth_nominal: null,
    expense_growth_nominal: "0",
    cpf_age_band: null,
    birth_date: "1990-01-01",
    target_retirement_age: 65,
    retirement_monthly_spend_goal: null,
    retirement_dividend_yield_annual: "0",
    retirement_withdrawal_rate_annual: "0.04",
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
    last_cpf_rules_review_at: null,
    last_cpf_rules_review_version: null,
    last_investment_review_at: null,
    created_at: "2026-01-01T00:00:00Z",
  };
  const budgetLines: BudgetLineRow[] = [
    {
      id: "needs-rent",
      user_id: "budget-cashflow-client",
      category: "Rent",
      cadence: "monthly",
      amount: "2000",
      calendar_year: null,
      start_year_month: null,
      end_year_month: null,
      source_liability_id: null,
      created_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "wants-dining",
      user_id: "budget-cashflow-client",
      category: "Dining out",
      cadence: "monthly",
      amount: "1000",
      calendar_year: null,
      start_year_month: null,
      end_year_month: null,
      source_liability_id: null,
      created_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "savings-etf",
      user_id: "budget-cashflow-client",
      category: "Savings",
      cadence: "monthly",
      amount: "1500",
      calendar_year: null,
      start_year_month: null,
      end_year_month: null,
      source_liability_id: null,
      created_at: "2026-01-01T00:00:00Z",
    },
    {
      id: "investments-line",
      user_id: "budget-cashflow-client",
      category: "Investments",
      cadence: "monthly",
      amount: "500",
      calendar_year: null,
      start_year_month: null,
      end_year_month: null,
      source_liability_id: null,
      created_at: "2026-01-01T00:00:00Z",
    },
  ];
  return { profile, budgetLines };
});

vi.mock("@/data/supabase/request-context", () => ({
  getCachedProfileById: async () => h.profile,
}));
vi.mock("@/data/repositories/investments", () => ({
  listInvestments: async () => [
    {
      id: "inv-1",
      user_id: "budget-cashflow-client",
      name: "Brokerage",
      current_value: "0",
      monthly_contribution: "500",
      expected_annual_return: "0.06",
      contribution_growth_annual: "0",
      contribution_type: "until_retirement",
      contribution_duration_years: null,
      withdrawal_monthly: "0",
      withdrawal_start_years: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
  ],
}));
vi.mock("@/data/repositories/budget-lines", () => ({
  listBudgetLines: async () => h.budgetLines,
}));
vi.mock("@/data/repositories/goals", () => ({
  listFinancialGoals: async () => [],
}));
vi.mock("@/data/repositories/expenses", () => ({
  listExpensesForMonth: async () => [],
}));
vi.mock("@/data/repositories/cash-accounts", () => ({
  listCashAccounts: async () => [
    {
      id: "cash-1",
      user_id: "budget-cashflow-client",
      name: "Savings",
      balance: "10000",
      purpose: "general" as const,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
  ],
}));
vi.mock("@/data/repositories/liabilities", () => ({
  listLiabilities: async () => [],
}));
vi.mock("@/data/repositories/cpf-balances", () => ({
  getCpfBalanceByUserId: async () => null,
}));
vi.mock("@/data/repositories/cpf-investments", () => ({
  listCpfInvestments: async () => [],
}));
vi.mock("@/data/repositories/housing-loans", () => ({
  listHousingLoans: async () => [],
}));
vi.mock("@/data/repositories/vehicles", () => ({
  listVehicles: async () => [],
}));
vi.mock("@/data/repositories/properties", () => ({
  listProperties: async () => [],
}));
vi.mock("@/data/repositories/income-tax-configs", () => ({
  getIncomeTaxConfig: async () => null,
}));
vi.mock("@/data/repositories/budget-line-overrides", async (orig) => {
  const actual = await orig<
    typeof import("@/data/repositories/budget-line-overrides")
  >();
  return { ...actual, listBudgetLineOverridesForMonth: async () => [] };
});

const { getDashboardPayload } = await import("@/data/dashboard");
const supabase = {} as SupabaseClient;

describe("getDashboardPayload — budget-aligned cash projection", () => {
  it("accrues savings-bucket surplus to cash and avoids double-counting investments", async () => {
    const payload = await getDashboardPayload(
      supabase,
      "budget-cashflow-client",
      "2026-06"
    );
    const points = payload.ageProjection?.points ?? [];
    expect(points.length).toBeGreaterThan(1);

    const first = points[0];
    const second = points[1];
    expect(first?.cash).toBe(10_000);
    // Living spend 3000/mo; savings bucket excluded; 500 to investments → 1500/mo cash accrual.
    expect(second?.cash ?? 0).toBeCloseTo(28_000, -2);
    expect(second?.cash ?? 0).toBeGreaterThan(first?.cash ?? 0);
    expect(first?.requiredLivingOutflow).toBeCloseTo(36_000, 0);
    expect(first?.scheduledInvestmentTransfer).toBeCloseTo(6_000, 0);
  });
});
