import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProfileRow } from "@/data/supabase/types";

// Repro of _dev_client3: birthday-aligned age samples can land off annual
// retirement-spend lumps. Per-age flow fields must therefore be summed over the
// sample's calendar year, not point-sampled. Transition years are split by phase
// so the retired row does not inherit pre-retirement salary from the same year.
const h = vi.hoisted(() => {
  const profile: ProfileRow = {
    id: "c3",
    profile_type: "client",
    advisor_user_id: "a1",
    display_name: "Client 3",
    monthly_income: "8000",
    salary_frequency: "monthly",
    annual_bonus: "0",
    savings_target_monthly: "0",
    fixed_expenses_monthly: "0",
    debt_obligations_monthly: "0",
    monthly_gross_salary: "8000",
    annual_salary_growth_nominal: null,
    expense_growth_nominal: "0",
    cpf_age_band: "below_55",
    birth_date: "1995-09-15",
    target_retirement_age: 50,
    retirement_monthly_spend_goal: "10000",
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
    created_at: "2025-01-01T00:00:00Z",
  };
  return {
    profile,
    investments: [
      {
        id: "inv1",
        user_id: "c3",
        name: "Brokerage",
        current_value: "50000",
        monthly_contribution: "500",
        expected_annual_return: "0.06",
        contribution_growth_annual: "0",
        contribution_type: "until_retirement",
        contribution_duration_years: null,
        withdrawal_monthly: "0",
        withdrawal_start_years: null,
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
      },
    ],
    cashAccounts: [
      {
        id: "ca1",
        user_id: "c3",
        name: "Savings",
        balance: "40000",
        purpose: "general" as const,
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
      },
    ],
    cpf: {
      user_id: "c3",
      oa: "100000",
      sa: "30000",
      ma: "10000",
      balance_as_of_month: "2026-05",
      oa_annual_rate: null,
      sa_annual_rate: null,
      ma_annual_rate: null,
      cpfis_monthly_from_oa: "0",
      cpfis_notional_balance: "0",
      cpfis_annual_return: "0",
      updated_at: "2025-01-01T00:00:00Z",
    },
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

describe("getDashboardPayload — per-age annual flow projection", () => {
  it("post-retirement points carry spend without transition-year salary bleed", async () => {
    const payload = await getDashboardPayload(supabase, "c3", "2026-06");
    const points = payload.ageProjection?.points ?? [];
    expect(points.length).toBeGreaterThan(0);

    const postRetirement = points.filter((p) => p.phase === "post_retirement");
    expect(postRetirement.length).toBeGreaterThan(0);

    const retirementPoint = postRetirement.find((p) => p.age === 50);
    expect(retirementPoint).toBeDefined();
    expect(retirementPoint?.employmentInflow ?? 0).toBe(0);
    expect(retirementPoint?.requiredOutflow ?? 0).toBeGreaterThan(119_000);
    expect(retirementPoint?.requiredOutflow ?? 0).toBeLessThan(121_000);

    // A fully post-retirement calendar year sums the Jan lump (10k×12), so
    // requiredOutflow is ~120k — not 0 as it was when point-sampled off-month.
    const fullyPost = postRetirement.find((p) => (p.age ?? 0) >= 55);
    expect(fullyPost).toBeDefined();
    expect(fullyPost?.requiredOutflow ?? 0).toBeGreaterThan(100_000);
    expect(fullyPost?.requiredOutflow ?? 0).toBeLessThan(160_000);

    // Assets (≈$40k cash + ~$400k invested at retirement + CPF) cannot fund 20+
    // years at $120k/yr, so a shortfall must surface and accumulate.
    expect(postRetirement.some((p) => (p.goalsGap ?? 0) > 0)).toBe(true);
    const last = points[points.length - 1];
    expect(last.cumulativeGoalsGap ?? 0).toBeGreaterThan(0);

    const cashReservePoints = payload.ageProjection?.cashReservePoints ?? [];
    expect(cashReservePoints.length).toBe(points.length);
    const defaultShortfallPoint = postRetirement.find(
      (p) => (p.goalsGap ?? 0) > 0
    );
    expect(defaultShortfallPoint).toBeDefined();
    const cashReservePoint = cashReservePoints.find(
      (p) => p.age === defaultShortfallPoint?.age
    );
    expect(cashReservePoint).toBeDefined();
    expect(cashReservePoint?.cashReserveDrawdown ?? 0).toBeGreaterThan(0);
    expect(cashReservePoint?.goalsGap ?? 0).toBeLessThan(
      defaultShortfallPoint?.goalsGap ?? 0
    );
    expect(cashReservePoint?.cash ?? 0).toBeLessThan(
      defaultShortfallPoint?.cash ?? 0
    );
  });
});
