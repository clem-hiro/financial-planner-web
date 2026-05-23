import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AdvisorProposalChangeRow,
  ProfileRow,
} from "@/data/supabase/types";

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
    annual_salary_growth_nominal: null, // gI = 0
    expense_growth_nominal: "0", // explicit 0 ⇒ gE = 0
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
  return {
    profile,
    investments: [
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
    ],
    budgetLines: [
      {
        id: "bl1",
        user_id: "c1",
        category: "food",
        cadence: "monthly",
        amount: "800",
        calendar_year: null,
        created_at: "2025-01-01T00:00:00Z",
      },
    ],
    goals: [
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
        display_order: 0,
        created_at: "2025-01-01T00:00:00Z",
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
  listBudgetLines: async () => h.budgetLines,
}));
vi.mock("@/data/repositories/goals", () => ({
  listFinancialGoals: async () => h.goals,
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
const MONTH = "2026-05";

describe("getDashboardPayload — C8 no-overlay byte-identical regression", () => {
  it("no opts ≡ {} ≡ { proposalOverlay: [] }", async () => {
    const a = await getDashboardPayload(supabase, "c1", MONTH);
    const b = await getDashboardPayload(supabase, "c1", MONTH, {});
    const c = await getDashboardPayload(supabase, "c1", MONTH, {
      proposalOverlay: [],
    });
    expect(b).toEqual(a);
    expect(c).toEqual(a);
    // gE=0 ∧ gI=0 surplus path produces a finite, stable retirement figure.
    expect(a.ageProjection?.projectedAtRetirement).toBeTypeOf("number");
    expect(Number.isFinite(a.ageProjection?.projectedAtRetirement)).toBe(true);
    expect(b.ageProjection?.projectedAtRetirement).toBe(
      a.ageProjection?.projectedAtRetirement
    );
  });
});

describe("getDashboardPayload — functional projection under overlay", () => {
  it("moves projected numbers in the expected direction AND magnitude", async () => {
    const overlay: AdvisorProposalChangeRow[] = [
      {
        id: "c1",
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
      {
        id: "c2",
        proposal_id: "p1",
        section: "retirement_planning",
        entity_type: "profile",
        entity_id: null,
        field_key: "retirement_withdrawal_rate_annual",
        field_label: "Retirement withdrawal rate",
        old_value: "0.04",
        new_value: "0.05",
        explanation: null,
        sort_order: 0,
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
      },
      ...["name", "current_value", "monthly_contribution", "expected_annual_return"].map(
        (f, i) => ({
          id: `c3-${i}`,
          proposal_id: "p1",
          section: "investments",
          entity_type: "investment" as const,
          entity_id: "new1",
          field_key: f,
          field_label: f,
          old_value: null,
          new_value: { name: "Robo", current_value: "4000", monthly_contribution: "200", expected_annual_return: "0.05" }[f]!,
          explanation: null,
          sort_order: 0,
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
        })
      ),
    ];

    const without = await getDashboardPayload(supabase, "c1", MONTH);
    const withOv = await getDashboardPayload(supabase, "c1", MONTH, {
      proposalOverlay: overlay,
    });

    // Goal contribution raised 300 → 800 (exact magnitude).
    expect(without.totalPlannedGoalContributionsMonthly).toBe(300);
    expect(withOv.totalPlannedGoalContributionsMonthly).toBe(800);

    // Discretionary after goals drops by exactly the +500 goal delta.
    expect(withOv.discretionaryAfterGoals).toBe(
      (without.discretionaryAfterGoals as number) - 500
    );

    // New investment: +1 account, +4000 to current value and net worth.
    expect(withOv.investmentSummary.count).toBe(
      without.investmentSummary.count + 1
    );
    expect(withOv.investmentSummary.totalValue).toBe(
      without.investmentSummary.totalValue + 4000
    );
    expect(withOv.netWorth).toBe(without.netWorth + 4000);

    // Withdrawal-rate lever changed 0.04 → 0.05 (direction).
    const wRate = withOv.ageProjection?.spendCheck.assumedAnnualWithdrawalRate;
    const woRate = without.ageProjection?.spendCheck.assumedAnnualWithdrawalRate;
    expect(woRate).toBe(0.04);
    expect(wRate).toBe(0.05);

    // The overlay demonstrably re-shapes the headline projection.
    expect(withOv.ageProjection?.projectedAtRetirement).not.toBe(
      without.ageProjection?.projectedAtRetirement
    );
  });

  it("isolated levers move the retirement projection in the model-correct direction", async () => {
    const without = await getDashboardPayload(supabase, "c1", MONTH);
    const base = without.ageProjection?.projectedAtRetirement as number;

    // Lever A — add a funded investment account: more compounding assets ⇒
    // strictly higher projected retirement balance.
    const addInvestment: AdvisorProposalChangeRow[] = [
      "name",
      "current_value",
      "monthly_contribution",
      "expected_annual_return",
    ].map((f, i) => ({
      id: `a-${i}`,
      proposal_id: "p1",
      section: "investments",
      entity_type: "investment",
      entity_id: "new1",
      field_key: f,
      field_label: f,
      old_value: null,
      new_value: {
        name: "Robo",
        current_value: "4000",
        monthly_contribution: "200",
        expected_annual_return: "0.05",
        contribution_growth_annual: "0",
        withdrawal_monthly: "0",
        withdrawal_start_years: null,
      }[f]!,
      explanation: null,
      sort_order: 0,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    }));
    const withInvestment = await getDashboardPayload(supabase, "c1", MONTH, {
      proposalOverlay: addInvestment,
    });
    expect(
      withInvestment.ageProjection?.projectedAtRetirement as number
    ).toBeGreaterThan(base);

    // Lever B — raise a goal contribution: cash is diverted into the goal,
    // which this headline model accrues as projected cash rather than re-adding
    // as an asset, so the projected balance strictly decreases. Pinning this
    // documents the real model semantics as a regression guard.
    const raiseGoal: AdvisorProposalChangeRow[] = [
      {
        id: "b1",
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
    const withGoal = await getDashboardPayload(supabase, "c1", MONTH, {
      proposalOverlay: raiseGoal,
    });
    expect(
      withGoal.ageProjection?.projectedAtRetirement as number
    ).toBeLessThan(base);
  });
});
