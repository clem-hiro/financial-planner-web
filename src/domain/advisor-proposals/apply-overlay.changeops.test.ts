import { describe, expect, it } from "vitest";
import { applyProposalChanges, type OverlayInputs } from "./apply-overlay";
import type {
  AdvisorProposalChangeRow,
  BudgetLineRow,
  FinancialGoalRow,
  InvestmentRow,
  ProfileRow,
} from "@/data/supabase/types";

function bl(over: Partial<BudgetLineRow> = {}): BudgetLineRow {
  return {
    id: "bl1",
    user_id: "c1",
    category: "food",
    cadence: "monthly",
    amount: "800",
    calendar_year: null,
    created_at: "2025-01-01T00:00:00Z",
    ...over,
  };
}
function gl(over: Partial<FinancialGoalRow> = {}): FinancialGoalRow {
  return {
    id: "g1",
    user_id: "c1",
    title: "House",
    target_amount: "100000",
    target_date: null,
    linked_investment_id: null,
    current_amount: "5000",
    monthly_contribution: "300",
    expected_annual_return: "0.04",
    display_order: 0,
    created_at: "2025-01-01T00:00:00Z",
    ...over,
  };
}
function inv(over: Partial<InvestmentRow> = {}): InvestmentRow {
  return {
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
    ...over,
  };
}
function prof(over: Partial<ProfileRow> = {}): ProfileRow {
  return {
    id: "c1",
    profile_type: "client",
    advisor_user_id: "a1",
    display_name: "Old",
    monthly_income: "5000",
    salary_frequency: "monthly",
    annual_bonus: "0",
    savings_target_monthly: "1000",
    fixed_expenses_monthly: "2000",
    debt_obligations_monthly: "0",
    monthly_gross_salary: "6000",
    annual_salary_growth_nominal: "0.02",
    expense_growth_nominal: "0.02",
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
    ...over,
  };
}

function ch(
  o: Partial<AdvisorProposalChangeRow> &
    Pick<AdvisorProposalChangeRow, "entity_type" | "field_key" | "new_value">
): AdvisorProposalChangeRow {
  return {
    id: `c-${o.field_key}-${o.entity_id ?? o.draft_entity_key ?? "p"}`,
    proposal_id: "p1",
    section: o.section ?? "cash_flow",
    entity_id: o.entity_id ?? null,
    field_label: o.field_key,
    old_value: o.old_value ?? null,
    explanation: null,
    sort_order: 0,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    ...o,
  };
}

function base(): OverlayInputs {
  return {
    profile: prof(),
    investments: [inv()],
    budgetLines: [bl()],
    goals: [gl()],
  };
}

// input (entity, op, change rows) -> expected overlay effect.
describe("apply-overlay change_op matrix — create/update/delete per entity", () => {
  it("budget_line CREATE (draft_entity_key) appends a new line", () => {
    const out = applyProposalChanges(base(), [
      ch({ entity_type: "budget_line", field_key: "category", new_value: "transport", change_op: "create", draft_entity_key: "nb" }),
      ch({ entity_type: "budget_line", field_key: "amount", new_value: "120", change_op: "create", draft_entity_key: "nb" }),
    ]);
    expect(out.budgetLines).toHaveLength(2);
    const created = out.budgetLines.find((b) => b.id === "nb");
    expect(created?.category).toBe("transport");
    expect(created?.amount).toBe("120");
  });

  it("budget_line UPDATE mutates only the targeted field", () => {
    const out = applyProposalChanges(base(), [
      ch({ entity_type: "budget_line", entity_id: "bl1", field_key: "amount", new_value: "950", old_value: "800", change_op: "update" }),
    ]);
    expect(out.budgetLines).toHaveLength(1);
    expect(out.budgetLines[0].amount).toBe("950");
    expect(out.budgetLines[0].category).toBe("food");
  });

  it("budget_line DELETE removes the row", () => {
    const out = applyProposalChanges(base(), [
      ch({ entity_type: "budget_line", entity_id: "bl1", field_key: "amount", new_value: "0", old_value: "800", change_op: "delete" }),
    ]);
    expect(out.budgetLines).toHaveLength(0);
  });

  it("goal CREATE (draft_entity_key) appends a new goal", () => {
    const out = applyProposalChanges(base(), [
      ch({ entity_type: "goal", field_key: "title", new_value: "Car", change_op: "create", draft_entity_key: "ng" }),
      ch({ entity_type: "goal", field_key: "monthly_contribution", new_value: "250", change_op: "create", draft_entity_key: "ng" }),
    ]);
    expect(out.goals).toHaveLength(2);
    const created = out.goals.find((g) => g.id === "ng");
    expect(created?.title).toBe("Car");
    expect(created?.monthly_contribution).toBe("250");
  });

  it("goal UPDATE mutates only the targeted field", () => {
    const out = applyProposalChanges(base(), [
      ch({ entity_type: "goal", entity_id: "g1", field_key: "monthly_contribution", new_value: "750", old_value: "300", change_op: "update" }),
    ]);
    expect(out.goals[0].monthly_contribution).toBe("750");
    expect(out.goals[0].title).toBe("House");
  });

  it("goal DELETE removes the row", () => {
    const out = applyProposalChanges(base(), [
      ch({ entity_type: "goal", entity_id: "g1", field_key: "monthly_contribution", new_value: "0", old_value: "300", change_op: "delete" }),
    ]);
    expect(out.goals).toHaveLength(0);
  });

  it("investment EXPLICIT create (change_op) appends, distinct from legacy all-null path", () => {
    const out = applyProposalChanges(base(), [
      ch({ entity_type: "investment", field_key: "name", new_value: "Robo", change_op: "create", draft_entity_key: "ni", section: "investments" }),
      ch({ entity_type: "investment", field_key: "current_value", new_value: "2000", change_op: "create", draft_entity_key: "ni", section: "investments" }),
    ]);
    expect(out.investments).toHaveLength(2);
    const created = out.investments.find((i) => i.id === "ni");
    expect(created?.name).toBe("Robo");
    expect(created?.current_value).toBe("2000");
  });

  it("investment EXPLICIT delete (change_op) removes, distinct from legacy _deleted marker", () => {
    const out = applyProposalChanges(base(), [
      ch({ entity_type: "investment", entity_id: "inv1", field_key: "name", new_value: "x", old_value: "Brokerage", change_op: "delete", section: "investments" }),
    ]);
    expect(out.investments).toHaveLength(0);
  });

  it("investment UPDATE merges without clobbering untouched fields", () => {
    const out = applyProposalChanges(base(), [
      ch({ entity_type: "investment", entity_id: "inv1", field_key: "monthly_contribution", new_value: "900", old_value: "500", change_op: "update", section: "investments" }),
    ]);
    expect(out.investments[0].monthly_contribution).toBe("900");
    expect(out.investments[0].name).toBe("Brokerage");
    expect(out.investments[0].current_value).toBe("10000");
  });

  it("draft_entity_key groups distinct new entities of the same type independently", () => {
    const out = applyProposalChanges(
      { profile: null, investments: [], budgetLines: [], goals: [] },
      [
        ch({ entity_type: "budget_line", field_key: "category", new_value: "a", change_op: "create", draft_entity_key: "k1" }),
        ch({ entity_type: "budget_line", field_key: "category", new_value: "b", change_op: "create", draft_entity_key: "k2" }),
      ]
    );
    expect(out.budgetLines.map((b) => b.category).sort()).toEqual(["a", "b"]);
    expect(new Set(out.budgetLines.map((b) => b.id)).size).toBe(2);
  });

  it("profile is edit-only: a 'delete' change_op still only applies field edits, never removes the profile", () => {
    const out = applyProposalChanges(base(), [
      ch({ entity_type: "profile", field_key: "display_name", new_value: "New", old_value: "Old", change_op: "delete", section: "profile_assumptions" }),
    ]);
    expect(out.profile).toBeTruthy();
    expect(out.profile?.display_name).toBe("New");
  });

  it("legacy fallback intact: investment _deleted marker without change_op still deletes", () => {
    const out = applyProposalChanges(base(), [
      ch({ entity_type: "investment", entity_id: "inv1", field_key: "_deleted", new_value: "true", section: "investments" }),
    ]);
    expect(out.investments).toHaveLength(0);
  });
});
