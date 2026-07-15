import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BudgetLineRow,
  ProfileRow,
  VehicleRow,
} from "@/data/supabase/types";

const h = vi.hoisted(() => {
  const profile: ProfileRow = {
    id: "debt-vehicle-client",
    profile_type: "client",
    advisor_user_id: null,
    display_name: "Debt Vehicle Client",
    monthly_income: "2000",
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
  const vehicle: VehicleRow = {
    id: "vehicle-1",
    user_id: "debt-vehicle-client",
    label: "Family car",
    vehicle_status: "active",
    first_registration_ym: null,
    on_the_road_paid: "0",
    arf_for_parf: null,
    body_open_market_at_purchase: null,
    body_depreciation_years: 10,
    loan_balance: "1200",
    loan_monthly_payment: "100",
    loan_months_remaining: 12,
    loan_end_ym: "2027-05",
    loan_annual_nominal_rate: "0",
    display_order: 0,
    created_at: "2026-01-01T00:00:00Z",
  };
  const budgetLine: BudgetLineRow = {
    id: "budget-vehicle-loan",
    user_id: "debt-vehicle-client",
    category: "debt repayments - Family car",
    cadence: "monthly",
    amount: "100",
    calendar_year: null,
    start_year_month: "2026-06",
    end_year_month: "2027-05",
    source_liability_id: null,
    source_vehicle_id: "vehicle-1",
    vehicle_budget_slot: "loan_repayment",
    created_at: "2026-01-01T00:00:00Z",
  };
  return { profile, vehicle, budgetLine };
});

vi.mock("@/data/supabase/request-context", () => ({
  getCachedProfileById: async () => h.profile,
}));
vi.mock("@/data/repositories/investments", () => ({
  listInvestments: async () => [],
}));
vi.mock("@/data/repositories/budget-lines", () => ({
  listBudgetLines: async () => [h.budgetLine],
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
  getCpfBalanceByUserId: async () => null,
}));
vi.mock("@/data/repositories/cpf-investments", () => ({
  listCpfInvestments: async () => [],
}));
vi.mock("@/data/repositories/housing-loans", () => ({
  listHousingLoans: async () => [],
}));
vi.mock("@/data/repositories/vehicles", () => ({
  listVehicles: async () => [h.vehicle],
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

describe("getDashboardPayload — vehicle debt ledger", () => {
  it("schedules vehicle loan repayments and reduces projected vehiclesNet", async () => {
    const payload = await getDashboardPayload(
      supabase,
      "debt-vehicle-client",
      "2026-06"
    );

    expect(payload.monthlyPlannedMonthlyBudgetTotal).toBe(100);

    const points = payload.ageProjection?.points ?? [];
    expect(points.length).toBeGreaterThan(1);

    const first = points[0];
    expect(first?.requiredDebtRepayment).toBe(1_200);
    expect(first?.requiredLivingOutflow).toBe(0);
    expect(first?.vehiclesNet).toBe(-1_200);
    expect(first?.liabilities).toBe(0);

    const second = points[1];
    expect(second?.vehiclesNet ?? 0).toBeGreaterThan(first?.vehiclesNet ?? 0);
    expect(second?.vehiclesNet ?? 0).toBeLessThanOrEqual(0);
  });
});
