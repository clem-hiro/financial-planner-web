import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  BudgetLineRow,
  LiabilityRow,
  ProfileRow,
} from "@/data/supabase/types";

const h = vi.hoisted(() => {
  const profile: ProfileRow = {
    id: "debt-ledger-client",
    profile_type: "client",
    advisor_user_id: null,
    display_name: "Debt Ledger Client",
    monthly_income: "1000",
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
  const liability: LiabilityRow = {
    id: "liability-1",
    user_id: "debt-ledger-client",
    name: "Personal loan",
    balance: "1000",
    category: "personal",
    loan_type: "amortized",
    interest_rate_annual: "0",
    remaining_tenure_months: 10,
    monthly_repayment: "100",
    repayment_override: true,
    start_date: "2026-06-01",
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
  };
  const budgetLine: BudgetLineRow = {
    id: "budget-linked-liability",
    user_id: "debt-ledger-client",
    category: "debt repayments - personal loan",
    cadence: "monthly",
    amount: "100",
    calendar_year: null,
    start_year_month: "2026-06",
    end_year_month: "2027-03",
    source_liability_id: "liability-1",
    created_at: "2026-01-01T00:00:00Z",
  };
  return { profile, liability, budgetLine };
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
  listLiabilities: async () => [h.liability],
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

describe("getDashboardPayload - unified debt ledger", () => {
  it("keeps source-liability budget rows in month budgeting but excludes them from projection expenses", async () => {
    const payload = await getDashboardPayload(
      supabase,
      "debt-ledger-client",
      "2026-06"
    );

    expect(payload.monthlyPlannedMonthlyBudgetTotal).toBe(100);

    const firstPoint = payload.ageProjection?.points[0];
    expect(firstPoint).toBeDefined();
    expect(firstPoint?.requiredDebtRepayment).toBe(1_200);
    expect(firstPoint?.requiredLivingOutflow).toBe(0);
    expect(firstPoint?.requiredOutflow).toBeCloseTo(1_200, 5);
  });
});
