import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AdvisorProposalChangeRow,
  IncomeTaxConfigRow,
  InvestmentRow,
  ProfileRow,
} from "@/data/supabase/types";

// Consent-gate Phase 1 + 2 — the D1 viewer discriminator on
// getDashboardPayload. Proves: (1) fail-closed default (no viewer ⇒
// client-self .from() repos), (2) viewer:"advisor" routes EVERY consent-gated
// read through the RPC repos and never the self repo — all 12 surfaces:
// investments + income-tax + the 7 non-windowed tables (asserted with
// p_client=userId via the ROUTED matrix), the client profile (consent-gated
// advisorReadProfile, fail-closed null), and the 2 windowed tables (expenses,
// budget_line_month_overrides — the advisor RPC wrapper is passed the selected
// month so the gated view shows the period, not all-time), (3) C6 — the
// shared overlay mapper composes identically on RPC-sourced canonical
// (source-agnostic; apply-overlay.ts untouched), (4) fail-closed empty when
// the RPC denies (not consented).

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
    last_investment_review_at: null,
    last_cpf_rules_review_at: null,
    last_cpf_rules_review_version: null,
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
      contribution_growth_annual: "0",
      contribution_type: "until_retirement",
      contribution_duration_years: null,
      withdrawal_monthly: "0",
      withdrawal_start_years: null,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
  ];
  const goals = [
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
  ];
  // Each pair returns the SAME fixture so C6 (advisor ≡ self) holds — the
  // mapper is source-agnostic.
  return {
    profile,
    investments,
    // Profile: self = getCachedProfileById (1-arg, no supabase); advisor =
    // advisorReadProfile (consent-gated). Both return the same profile so C6
    // (advisor ≡ self when consented) holds.
    getCachedProfileById: vi.fn(async () => profile),
    advisorReadProfile: vi.fn(async () => profile),
    // Windowed pair (3-arg: supabase, clientId, yearMonth).
    listExpensesForMonth: vi.fn(async () => []),
    advisorReadExpensesForMonth: vi.fn(async () => []),
    listBudgetLineOverridesForMonth: vi.fn(async () => []),
    advisorReadBudgetLineOverridesForMonth: vi.fn(async () => []),
    listInvestments: vi.fn(async () => investments),
    advisorReadInvestments: vi.fn(async () => investments),
    getIncomeTaxConfig: vi.fn(async (): Promise<IncomeTaxConfigRow | null> => null),
    advisorReadIncomeTaxConfig: vi.fn(
      async (): Promise<IncomeTaxConfigRow | null> => null
    ),
    listCashAccounts: vi.fn(async () => []),
    advisorReadCashAccounts: vi.fn(async () => []),
    listLiabilities: vi.fn(async () => []),
    advisorReadLiabilities: vi.fn(async () => []),
    listBudgetLines: vi.fn(async () => []),
    advisorReadBudgetLines: vi.fn(async () => []),
    listFinancialGoals: vi.fn(async () => goals),
    advisorReadGoals: vi.fn(async () => goals),
    getCpfBalanceByUserId: vi.fn(async () => null),
    advisorReadCpfBalances: vi.fn(async () => null),
    listHousingLoans: vi.fn(async () => []),
    advisorReadHousingLoans: vi.fn(async () => []),
    listVehicles: vi.fn(async () => []),
    advisorReadVehicles: vi.fn(async () => []),
  };
});

vi.mock("@/data/supabase/request-context", () => ({
  getCachedProfileById: h.getCachedProfileById,
}));
vi.mock("@/data/repositories/profiles", () => ({
  advisorReadProfile: h.advisorReadProfile,
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
  listBudgetLines: h.listBudgetLines,
  advisorReadBudgetLines: h.advisorReadBudgetLines,
}));
vi.mock("@/data/repositories/goals", () => ({
  listFinancialGoals: h.listFinancialGoals,
  advisorReadGoals: h.advisorReadGoals,
}));
vi.mock("@/data/repositories/expenses", () => ({
  listExpensesForMonth: h.listExpensesForMonth,
  advisorReadExpensesForMonth: h.advisorReadExpensesForMonth,
}));
vi.mock("@/data/repositories/cash-accounts", () => ({
  listCashAccounts: h.listCashAccounts,
  advisorReadCashAccounts: h.advisorReadCashAccounts,
}));
vi.mock("@/data/repositories/liabilities", () => ({
  listLiabilities: h.listLiabilities,
  advisorReadLiabilities: h.advisorReadLiabilities,
}));
vi.mock("@/data/repositories/cpf-balances", () => ({
  getCpfBalanceByUserId: h.getCpfBalanceByUserId,
  advisorReadCpfBalances: h.advisorReadCpfBalances,
}));
vi.mock("@/data/repositories/housing-loans", () => ({
  listHousingLoans: h.listHousingLoans,
  advisorReadHousingLoans: h.advisorReadHousingLoans,
}));
vi.mock("@/data/repositories/vehicles", () => ({
  listVehicles: h.listVehicles,
  advisorReadVehicles: h.advisorReadVehicles,
}));
vi.mock("@/data/repositories/budget-line-overrides", async (orig) => {
  const actual = await orig<
    typeof import("@/data/repositories/budget-line-overrides")
  >();
  return {
    ...actual,
    listBudgetLineOverridesForMonth: h.listBudgetLineOverridesForMonth,
    advisorReadBudgetLineOverridesForMonth:
      h.advisorReadBudgetLineOverridesForMonth,
  };
});

const { getDashboardPayload } = await import("@/data/dashboard");

const supabase = {} as SupabaseClient;
const MONTH = "2026-05";

// (self repo spy, advisor RPC repo spy) for every consent-gated table the
// dashboard routes under viewer:"advisor". Investments + income-tax are
// Phase 1; the rest are the Phase-2 non-windowed surfaces.
const ROUTED: Array<[keyof typeof h, keyof typeof h]> = [
  ["listInvestments", "advisorReadInvestments"],
  ["getIncomeTaxConfig", "advisorReadIncomeTaxConfig"],
  ["listCashAccounts", "advisorReadCashAccounts"],
  ["listLiabilities", "advisorReadLiabilities"],
  ["listBudgetLines", "advisorReadBudgetLines"],
  ["listFinancialGoals", "advisorReadGoals"],
  ["getCpfBalanceByUserId", "advisorReadCpfBalances"],
  ["listHousingLoans", "advisorReadHousingLoans"],
  ["listVehicles", "advisorReadVehicles"],
];

// Profile + the 2 windowed reads are also routed but with non-uniform call
// shapes (profile self has no supabase arg; windowed are 3-arg) so they get
// explicit assertions rather than the (supabase, clientId) ROUTED matrix.
const EXTRA_SPIES = [
  "getCachedProfileById",
  "advisorReadProfile",
  "listExpensesForMonth",
  "advisorReadExpensesForMonth",
  "listBudgetLineOverridesForMonth",
  "advisorReadBudgetLineOverridesForMonth",
] as const;

beforeEach(() => {
  for (const [self, adv] of ROUTED) {
    (h[self] as ReturnType<typeof vi.fn>).mockClear();
    (h[adv] as ReturnType<typeof vi.fn>).mockClear();
  }
  for (const k of EXTRA_SPIES) {
    (h[k] as ReturnType<typeof vi.fn>).mockClear();
  }
  h.advisorReadInvestments.mockResolvedValue(h.investments);
  h.advisorReadIncomeTaxConfig.mockResolvedValue(null);
  h.advisorReadProfile.mockResolvedValue(h.profile);
});

describe("getDashboardPayload — viewer discriminator (D1)", () => {
  it("no viewer opt ⇒ fail-closed: every consent-gated read uses the self repo", async () => {
    await getDashboardPayload(supabase, "c1", MONTH);
    for (const [self, adv] of ROUTED) {
      expect(h[self] as ReturnType<typeof vi.fn>).toHaveBeenCalledTimes(1);
      expect(h[adv] as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
    }
    // Profile + windowed: self path only.
    expect(h.getCachedProfileById).toHaveBeenCalledTimes(1);
    expect(h.advisorReadProfile).not.toHaveBeenCalled();
    expect(h.listExpensesForMonth).toHaveBeenCalledTimes(1);
    expect(h.advisorReadExpensesForMonth).not.toHaveBeenCalled();
    expect(h.listBudgetLineOverridesForMonth).toHaveBeenCalledTimes(1);
    expect(h.advisorReadBudgetLineOverridesForMonth).not.toHaveBeenCalled();
  });

  it("viewer:'advisor' ⇒ every consent-gated read routes through the RPC repo, p_client=userId, never the self repo", async () => {
    await getDashboardPayload(supabase, "c1", MONTH, { viewer: "advisor" });
    for (const [self, adv] of ROUTED) {
      const advSpy = h[adv] as ReturnType<typeof vi.fn>;
      expect(advSpy).toHaveBeenCalledTimes(1);
      expect(advSpy).toHaveBeenCalledWith(supabase, "c1");
      expect(h[self] as ReturnType<typeof vi.fn>).not.toHaveBeenCalled();
    }
    // Profile: consent-gated advisorReadProfile(supabase, clientId); never the
    // self cached read.
    expect(h.advisorReadProfile).toHaveBeenCalledTimes(1);
    expect(h.advisorReadProfile).toHaveBeenCalledWith(supabase, "c1");
    expect(h.getCachedProfileById).not.toHaveBeenCalled();
    // Windowed: the advisor RPC wrappers are passed the selected month so the
    // gated view shows the period (not all-time); never the self repo.
    expect(h.advisorReadExpensesForMonth).toHaveBeenCalledTimes(1);
    expect(h.advisorReadExpensesForMonth).toHaveBeenCalledWith(
      supabase,
      "c1",
      MONTH
    );
    expect(h.listExpensesForMonth).not.toHaveBeenCalled();
    expect(h.advisorReadBudgetLineOverridesForMonth).toHaveBeenCalledTimes(1);
    expect(h.advisorReadBudgetLineOverridesForMonth).toHaveBeenCalledWith(
      supabase,
      "c1",
      MONTH
    );
    expect(h.listBudgetLineOverridesForMonth).not.toHaveBeenCalled();
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
