import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AdvisorProposalChangeRow,
  IncomeTaxConfigRow,
  InvestmentRow,
  ProfileRow,
} from "@/data/supabase/types";

// Consent-gate Phase 1 — the D1 viewer discriminator on getDashboardPayload.
// Proves: (1) fail-closed default (no viewer ⇒ client-self .from() repos),
// (2) viewer:"advisor" routes the two consent-gated reads through the RPC
// repos with userId as p_client, (3) C6 — the shared overlay mapper composes
// identically on RPC-sourced canonical (source-agnostic; apply-overlay.ts
// untouched), (4) fail-closed empty when the RPC denies (not consented).

const h = vi.hoisted(() => {
  const profile: ProfileRow = {
    id: "c1",
    profile_type: "client",
    advisor_user_id: "a1",
    display_name: "Client",
    monthly_income: "5000",
    salary_frequency: "monthly",
    annual_bonus: "0",
    savings_target_monthly: "1000",
    fixed_expenses_monthly: "0",
    debt_obligations_monthly: "0",
    monthly_gross_salary: "6000",
    annual_salary_growth_nominal: null,
    expense_growth_nominal: "0",
    cpf_age_band: "below_55",
    birth_date: "1990-01-01",
    target_retirement_age: 65,
    retirement_monthly_spend_goal: "3000",
    retirement_dividend_yield_annual: "0.03",
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
    created_at: "2025-01-01T00:00:00Z",
  };
  const investments: InvestmentRow[] = [
    {
      id: "inv1",
      user_id: "c1",
      name: "Brokerage",
      current_value: "10000",
      monthly_contribution: "500",
      expected_annual_return: "0.06",
      contribution_type: "until_retirement",
      contribution_duration_years: null,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
  ];
  const listInvestments = vi.fn(async () => investments);
  const advisorReadInvestments = vi.fn(async () => investments);
  const getIncomeTaxConfig = vi.fn(async (): Promise<IncomeTaxConfigRow | null> => null);
  const advisorReadIncomeTaxConfig = vi.fn(
    async (): Promise<IncomeTaxConfigRow | null> => null
  );
  return {
    profile,
    investments,
    listInvestments,
    advisorReadInvestments,
    getIncomeTaxConfig,
    advisorReadIncomeTaxConfig,
  };
});

vi.mock("@/data/supabase/request-context", () => ({
  getCachedProfileById: async () => h.profile,
}));
vi.mock("@/data/repositories/investments", () => ({
  listInvestments: h.listInvestments,
  advisorReadInvestments: h.advisorReadInvestments,
}));
vi.mock("@/data/repositories/income-tax-configs", () => ({
  getIncomeTaxConfig: h.getIncomeTaxConfig,
  advisorReadIncomeTaxConfig: h.advisorReadIncomeTaxConfig,
}));
vi.mock("@/data/repositories/budget-lines", () => ({
  listBudgetLines: async () => [],
}));
vi.mock("@/data/repositories/goals", () => ({
  listFinancialGoals: async () => [
    {
      id: "g1",
      user_id: "c1",
      title: "House",
      target_amount: "100000",
      target_date: null,
      linked_investment_id: null,
      current_amount: "0",
      monthly_contribution: "300",
      expected_annual_return: "0.04",
      created_at: "2025-01-01T00:00:00Z",
    },
  ],
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
vi.mock("@/data/repositories/housing-loans", () => ({
  listHousingLoans: async () => [],
}));
vi.mock("@/data/repositories/vehicles", () => ({
  listVehicles: async () => [],
}));
vi.mock("@/data/repositories/budget-line-overrides", async (orig) => {
  const actual = await orig<
    typeof import("@/data/repositories/budget-line-overrides")
  >();
  return { ...actual, listBudgetLineOverridesForMonth: async () => [] };
});

const { getDashboardPayload } = await import("@/data/dashboard");

const supabase = {} as SupabaseClient;
const MONTH = "2026-05";

beforeEach(() => {
  h.listInvestments.mockClear();
  h.advisorReadInvestments.mockClear();
  h.getIncomeTaxConfig.mockClear();
  h.advisorReadIncomeTaxConfig.mockClear();
  h.advisorReadInvestments.mockResolvedValue(h.investments);
  h.advisorReadIncomeTaxConfig.mockResolvedValue(null);
});

describe("getDashboardPayload — viewer discriminator (D1)", () => {
  it("no viewer opt ⇒ fail-closed: client-self repos only (C8 path untouched)", async () => {
    await getDashboardPayload(supabase, "c1", MONTH);
    expect(h.listInvestments).toHaveBeenCalledTimes(1);
    expect(h.getIncomeTaxConfig).toHaveBeenCalledTimes(1);
    expect(h.advisorReadInvestments).not.toHaveBeenCalled();
    expect(h.advisorReadIncomeTaxConfig).not.toHaveBeenCalled();
  });

  it("viewer:'advisor' ⇒ both consent-gated reads route through the RPC repos, p_client=userId", async () => {
    await getDashboardPayload(supabase, "c1", MONTH, { viewer: "advisor" });
    expect(h.advisorReadInvestments).toHaveBeenCalledTimes(1);
    expect(h.advisorReadInvestments).toHaveBeenCalledWith(supabase, "c1");
    expect(h.advisorReadIncomeTaxConfig).toHaveBeenCalledTimes(1);
    expect(h.advisorReadIncomeTaxConfig).toHaveBeenCalledWith(supabase, "c1");
    expect(h.listInvestments).not.toHaveBeenCalled();
    expect(h.getIncomeTaxConfig).not.toHaveBeenCalled();
  });
});

describe("getDashboardPayload — C6: overlay composes on RPC-sourced canonical", () => {
  const overlay: AdvisorProposalChangeRow[] = [
    {
      id: "ov1",
      proposal_id: "p1",
      section: "goals",
      entity_type: "goal",
      entity_id: "g1",
      field_key: "monthly_contribution",
      field_label: "Monthly contribution",
      old_value: "300",
      new_value: "800",
      explanation: null,
      sort_order: 0,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
  ];

  it("advisor (RPC) canonical ≡ self (.from) canonical when rows are identical", async () => {
    const self = await getDashboardPayload(supabase, "c1", MONTH);
    const advisor = await getDashboardPayload(supabase, "c1", MONTH, {
      viewer: "advisor",
    });
    // Source-agnostic: the mapper/derivation does not depend on whether the
    // canonical rows came from `.from()` or `.rpc()`.
    expect(advisor).toEqual(self);
  });

  it("advisor overlay ≡ self overlay (shared mapper, source-agnostic) and ≠ canonical", async () => {
    const selfOverlay = await getDashboardPayload(supabase, "c1", MONTH, {
      proposalOverlay: overlay,
    });
    const advisorOverlay = await getDashboardPayload(supabase, "c1", MONTH, {
      proposalOverlay: overlay,
      viewer: "advisor",
    });
    const advisorCanonical = await getDashboardPayload(supabase, "c1", MONTH, {
      viewer: "advisor",
    });
    // C6: preview is computed by the ONE shared mapper on RPC-sourced
    // canonical — identical to the self-sourced overlay result.
    expect(advisorOverlay).toEqual(selfOverlay);
    // The overlay demonstrably re-shapes the projection (not a no-op).
    expect(advisorOverlay.totalPlannedGoalContributionsMonthly).toBe(800);
    expect(advisorCanonical.totalPlannedGoalContributionsMonthly).toBe(300);
  });
});

describe("getDashboardPayload — advisor fail-closed when RPC denies", () => {
  it("RPC returns 0 rows ⇒ empty investments, lower net worth (not consented)", async () => {
    const consented = await getDashboardPayload(supabase, "c1", MONTH, {
      viewer: "advisor",
    });
    h.advisorReadInvestments.mockResolvedValueOnce([]);
    h.advisorReadIncomeTaxConfig.mockResolvedValueOnce(null);
    const denied = await getDashboardPayload(supabase, "c1", MONTH, {
      viewer: "advisor",
    });
    expect(denied.investmentSummary.count).toBe(0);
    expect(denied.investmentSummary.totalValue).toBe(0);
    expect(consented.investmentSummary.count).toBe(1);
    expect(denied.netWorth).toBeLessThan(consented.netWorth);
  });
});
