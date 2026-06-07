import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CpfBalanceRow, ProfileRow } from "@/data/supabase/types";

const h = vi.hoisted(() => {
  const profile: ProfileRow = {
    id: "retired-cpf",
    profile_type: "client",
    advisor_user_id: null,
    display_name: "Retired CPF Client",
    monthly_income: "0",
    salary_frequency: "monthly",
    annual_bonus: "100000",
    savings_target_monthly: "0",
    fixed_expenses_monthly: "0",
    debt_obligations_monthly: "0",
    monthly_gross_salary: "8000",
    annual_salary_growth_nominal: null,
    expense_growth_nominal: "0",
    cpf_age_band: "above_65_to_70",
    birth_date: "1950-01-01",
    target_retirement_age: 50,
    retirement_monthly_spend_goal: "3000",
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
    last_investment_review_at: null,
    last_cpf_rules_review_at: null,
    last_cpf_rules_review_version: null,
    created_at: "2026-01-01T00:00:00Z",
  };
  const cpf: CpfBalanceRow = {
    user_id: "retired-cpf",
    oa: "0",
    sa: "0",
    ma: "0",
    balance_as_of_month: "2026-05",
    oa_annual_rate: "0",
    sa_annual_rate: "0",
    ma_annual_rate: "0",
    cpfis_monthly_from_oa: "0",
    cpfis_notional_balance: "0",
    cpfis_annual_return: "0",
    updated_at: "2026-01-01T00:00:00Z",
  };
  return { profile, cpf };
});

vi.mock("@/data/supabase/request-context", () => ({
  getCachedProfileById: async () => h.profile,
}));
vi.mock("@/data/repositories/investments", () => ({
  listInvestments: async () => [],
}));
vi.mock("@/data/repositories/budget-lines", () => ({
  listBudgetLines: async () => [],
}));
vi.mock("@/data/repositories/goals", () => ({
  listFinancialGoals: async () => [],
}));
vi.mock("@/data/repositories/expenses", () => ({
  listExpensesForMonth: async () => [],
}));
vi.mock("@/data/repositories/cash-accounts", () => ({
  listCashAccounts: async () => [],
}));
vi.mock("@/data/repositories/liabilities", () => ({
  listLiabilities: async () => [],
}));
vi.mock("@/data/repositories/cpf-balances", () => ({
  getCpfBalanceByUserId: async () => h.cpf,
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

describe("getDashboardPayload — CPF employment stop at retirement", () => {
  it("does not add salary or bonus CPF contributions for an already-retired client", async () => {
    const payload = await getDashboardPayload(supabase, "retired-cpf", "2026-06");

    expect(payload.cpfYearEndProjection).not.toBeNull();
    expect(payload.cpfYearEndProjection?.totalCpf).toBe(0);
  });
});
