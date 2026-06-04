import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CpfBalanceRow, ProfileRow } from "@/data/supabase/types";

const h = vi.hoisted(() => {
  const profile: ProfileRow = {
    id: "zero-cpf",
    profile_type: "client",
    advisor_user_id: null,
    display_name: "Zero CPF Client",
    monthly_income: "6400",
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
  const savedZeroCpf: CpfBalanceRow = {
    user_id: "zero-cpf",
    oa: "0",
    sa: "0",
    ma: "0",
    balance_as_of_month: "2026-05",
    oa_annual_rate: null,
    sa_annual_rate: null,
    ma_annual_rate: null,
    cpfis_monthly_from_oa: "0",
    cpfis_notional_balance: "0",
    cpfis_annual_return: "0",
    updated_at: "2026-01-01T00:00:00Z",
  };
  return { profile, savedZeroCpf, cpf: null as CpfBalanceRow | null };
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

function expectSalaryCpfProjection(
  payload: Awaited<ReturnType<typeof getDashboardPayload>>
) {
  expect(payload.cpfProjectionMissingInputs).toEqual([]);
  expect(payload.netWorthBreakdown.cpf).toBe(0);

  expect(payload.cpfYearEndProjection).not.toBeNull();
  expect(payload.cpfYearEndProjection?.totalCpf ?? 0).toBeGreaterThan(0);
  expect(payload.cpfYearEndProjection?.oa ?? 0).toBeGreaterThan(0);
  expect(payload.cpfYearEndProjection?.sa ?? 0).toBeGreaterThan(0);
  expect(payload.cpfYearEndProjection?.ma ?? 0).toBeGreaterThan(0);

  const cpfRows = payload.cpfProjectionByAge ?? [];
  expect(cpfRows.length).toBeGreaterThan(1);
  expect(cpfRows[0]?.totalCpf ?? 0).toBeGreaterThan(0);
  expect(cpfRows.at(-1)?.totalCpf ?? 0).toBeGreaterThan(
    cpfRows[0]?.totalCpf ?? 0
  );

  const agePoints = payload.ageProjection?.points ?? [];
  expect(agePoints.length).toBeGreaterThan(1);
  expect(agePoints.some((point) => point.cpf > 0)).toBe(true);
  expect(agePoints.some((point) => point.cpfOa > 0)).toBe(true);
  expect(agePoints.some((point) => point.cpfSa > 0)).toBe(true);
  expect(agePoints.some((point) => point.cpfMa > 0)).toBe(true);
}

describe("getDashboardPayload — zero CPF balance projection", () => {
  beforeEach(() => {
    h.cpf = null;
  });

  it("projects salary CPF inflows from virtual zero balances when no CPF row exists", async () => {
    const payload = await getDashboardPayload(supabase, "zero-cpf", "2026-06");

    expect(payload.hasCpfBalanceRecord).toBe(false);
    expect(payload.cpfYearEndProjection?.balanceAsOfMonth).toBe("2026-06");
    expect(payload.cpfYearEndProjection?.startYearMonth).toBe("2026-07");
    expectSalaryCpfProjection(payload);
  });

  it("keeps a saved all-zero CPF row as a saved balance record", async () => {
    h.cpf = h.savedZeroCpf;

    const payload = await getDashboardPayload(supabase, "zero-cpf", "2026-06");

    expect(payload.hasCpfBalanceRecord).toBe(true);
    expect(payload.cpfYearEndProjection?.balanceAsOfMonth).toBe("2026-05");
    expect(payload.cpfYearEndProjection?.startYearMonth).toBe("2026-06");
    expectSalaryCpfProjection(payload);
  });
});
