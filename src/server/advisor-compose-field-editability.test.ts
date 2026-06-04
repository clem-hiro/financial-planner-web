import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  getUser: vi.fn(async () => ({ data: { user: { id: "advisor-1" } } })),
  advisorReadProfile: vi.fn(),
  advisorReadGoals: vi.fn(),
  advisorReadBudgetLines: vi.fn(),
  recordAdvisorProposalChanges: vi.fn(async () => ({ proposalId: "proposal-1" })),
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/data/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: m.getUser },
  }),
}));
vi.mock("@/lib/profile-role", () => ({
  isAdvisor: () => true,
}));
vi.mock("@/server/advisor-consent", () => ({
  assertConsent: async () => ({ ok: true }),
}));
vi.mock("@/data/repositories/profiles", () => ({
  getProfileById: async () => ({ id: "advisor-1", profile_type: "advisor" }),
  advisorReadProfile: m.advisorReadProfile,
}));
vi.mock("@/data/repositories/advisor-clients", () => ({
  getClientProfileForAdvisor: async () => ({ id: "client-1" }),
}));
vi.mock("@/data/repositories/goals", () => ({
  advisorReadGoals: m.advisorReadGoals,
}));
vi.mock("@/data/repositories/budget-lines", () => ({
  advisorReadBudgetLines: m.advisorReadBudgetLines,
}));
vi.mock("@/server/advisor-proposal-recording", () => ({
  recordAdvisorProposalChanges: m.recordAdvisorProposalChanges,
}));

const {
  patchAdvisorClientBudgetLineAmountAction,
  patchAdvisorClientGoalMonthlyContributionAction,
  patchAdvisorClientProfileAction,
} = await import("@/server/advisor-client-actions");

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

beforeEach(() => {
  m.getUser.mockClear();
  m.advisorReadProfile.mockReset();
  m.advisorReadGoals.mockReset();
  m.advisorReadBudgetLines.mockReset();
  m.recordAdvisorProposalChanges.mockClear();
});

describe("advisor compose editable fields", () => {
  it("profile suggestions record income, salary, and retirement assumptions", async () => {
    m.advisorReadProfile.mockResolvedValue({
      id: "client-1",
      display_name: "Jane Client",
      monthly_income: "8000",
      monthly_gross_salary: "9000",
      annual_salary_growth_nominal: "0.02",
      savings_target_monthly: "2000",
      fixed_expenses_monthly: "3000",
      expense_growth_nominal: "0.02",
      target_retirement_age: 65,
      retirement_monthly_spend_goal: "4500",
      retirement_dividend_yield_annual: "0.03",
      retirement_withdrawal_rate_annual: "0.04",
      updated_at: "profile-v1",
    });

    const res = await patchAdvisorClientProfileAction(
      { error: null },
      fd({
        client_id: "client-1",
        display_name: "Jane Updated",
        monthly_income: "8200",
        monthly_gross_salary: "9400",
        annual_salary_growth_percent: "3",
        savings_target_monthly: "2300",
        fixed_expenses_monthly: "3200",
        expense_growth_percent: "2.5",
        target_retirement_age: "62",
        retirement_monthly_spend_goal: "5000",
        retirement_dividend_yield_percent: "3.5",
        retirement_withdrawal_rate_percent: "4.5",
      })
    );

    expect(res.error).toBeNull();
    const changes = m.recordAdvisorProposalChanges.mock.calls[0][3];
    expect(changes.map((c: { fieldKey: string }) => c.fieldKey)).toEqual([
      "display_name",
      "monthly_income",
      "monthly_gross_salary",
      "savings_target_monthly",
      "fixed_expenses_monthly",
      "retirement_monthly_spend_goal",
      "target_retirement_age",
      "annual_salary_growth_nominal",
      "expense_growth_nominal",
      "retirement_dividend_yield_annual",
      "retirement_withdrawal_rate_annual",
    ]);
    expect(
      changes.find(
        (c: { fieldKey: string }) => c.fieldKey === "annual_salary_growth_nominal"
      )?.newValue
    ).toBe(0.03);
    expect(
      changes.find((c: { fieldKey: string }) => c.fieldKey === "expense_growth_nominal")
        ?.newValue
    ).toBe(0.025);
    expect(changes.every((c: { baseVersion: string | null }) => c.baseVersion === "profile-v1")).toBe(
      true
    );
  });

  it("goal suggestions record title, target amount, and monthly contribution", async () => {
    m.advisorReadGoals.mockResolvedValue([
      {
        id: "goal-1",
        title: "House downpayment",
        target_amount: "100000",
        monthly_contribution: "1500",
        updated_at: "goal-v1",
      },
    ]);

    const res = await patchAdvisorClientGoalMonthlyContributionAction(
      { error: null },
      fd({
        client_id: "client-1",
        goal_id: "goal-1",
        title: "Home deposit",
        target_amount: "120000",
        monthly_contribution: "1800",
      })
    );

    expect(res.error).toBeNull();
    const changes = m.recordAdvisorProposalChanges.mock.calls[0][3];
    expect(changes).toMatchObject([
      { fieldKey: "title", newValue: "Home deposit", baseVersion: "goal-v1" },
      { fieldKey: "target_amount", newValue: 120000, baseVersion: "goal-v1" },
      {
        fieldKey: "monthly_contribution",
        newValue: 1800,
        baseVersion: "goal-v1",
      },
    ]);
  });

  it("budget suggestions record category and amount", async () => {
    m.advisorReadBudgetLines.mockResolvedValue([
      {
        id: "budget-1",
        category: "groceries",
        amount: "600",
        cadence: "monthly",
        updated_at: "budget-v1",
      },
    ]);

    const res = await patchAdvisorClientBudgetLineAmountAction(
      { error: null },
      fd({
        client_id: "client-1",
        id: "budget-1",
        category: "food",
        amount: "700",
      })
    );

    expect(res.error).toBeNull();
    const changes = m.recordAdvisorProposalChanges.mock.calls[0][3];
    expect(changes).toMatchObject([
      { fieldKey: "category", newValue: "food", baseVersion: "budget-v1" },
      { fieldKey: "amount", newValue: 700, baseVersion: "budget-v1" },
    ]);
  });
});
