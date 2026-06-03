import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProfileRow, PropertyRow } from "@/data/supabase/types";

const h = vi.hoisted(() => {
  const profile: ProfileRow = {
    id: "c-property",
    profile_type: "client",
    advisor_user_id: null,
    display_name: "Property Client",
    monthly_income: "5000",
    salary_frequency: "monthly",
    annual_bonus: "0",
    savings_target_monthly: "0",
    fixed_expenses_monthly: "0",
    debt_obligations_monthly: "0",
    monthly_gross_salary: "5000",
    annual_salary_growth_nominal: null,
    expense_growth_nominal: "0",
    cpf_age_band: "below_55",
    birth_date: "1990-01-01",
    target_retirement_age: 65,
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
  const properties: PropertyRow[] = [
    {
      id: "prop-1",
      user_id: "c-property",
      name: "Home",
      property_type: "hdb",
      purchase_price: "500000",
      purchase_year: 2026,
      current_valuation: "600000",
      ownership_percent: "0.5",
      status: "living_in",
      rental_income_monthly: "0",
      planning_scope: "current",
      display_order: 0,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
  ];
  return {
    profile,
    properties,
    investments: [
      {
        id: "inv1",
        user_id: "c-property",
        name: "Brokerage",
        current_value: "10000",
        monthly_contribution: "0",
        expected_annual_return: "0",
        contribution_growth_annual: "0",
        contribution_type: "until_retirement",
        contribution_duration_years: null,
        withdrawal_monthly: "0",
        withdrawal_start_years: null,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ],
    cashAccounts: [
      {
        id: "cash1",
        user_id: "c-property",
        name: "Cash",
        balance: "1000",
        purpose: "general" as const,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ],
  };
});

vi.mock("@/data/supabase/request-context", () => ({
  getCachedProfileById: async () => h.profile,
}));
vi.mock("@/data/repositories/investments", () => ({
  listInvestments: async () => h.investments,
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
  listCashAccounts: async () => h.cashAccounts,
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
  listProperties: async () => h.properties,
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

describe("getDashboardPayload — property net equity", () => {
  it("includes current property net equity in net worth and projection rows", async () => {
    const payload = await getDashboardPayload(supabase, "c-property", "2026-06");

    expect(payload.netWorthBreakdown.propertiesGrossAsset).toBe(300000);
    expect(payload.netWorthBreakdown.propertiesLoan).toBe(0);
    expect(payload.netWorthBreakdown.propertiesNet).toBe(300000);
    expect(payload.netWorthBreakdown.propertyCount).toBe(1);
    expect(payload.netWorth).toBe(311000);
    expect(payload.netWorthExcludingCpf).toBe(311000);

    const firstPoint = payload.ageProjection?.points[0];
    expect(firstPoint?.propertyNet).toBe(300000);
    expect(firstPoint?.value ?? 0).toBeGreaterThanOrEqual(311000);
  });
});
