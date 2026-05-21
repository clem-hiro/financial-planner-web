import { describe, expect, it } from "vitest";
import {
  applyProposalChanges,
  type OverlayInputs,
} from "./apply-overlay";
import type {
  AdvisorProposalChangeRow,
  BudgetLineRow,
  FinancialGoalRow,
  InvestmentRow,
  ProfileRow,
} from "@/data/supabase/types";

function profile(over: Partial<ProfileRow> = {}): ProfileRow {
  return {
    id: "c1",
    profile_type: "client",
    advisor_user_id: "a1",
    display_name: "Old Name",
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

function investment(over: Partial<InvestmentRow> = {}): InvestmentRow {
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

function budgetLine(over: Partial<BudgetLineRow> = {}): BudgetLineRow {
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

function goal(over: Partial<FinancialGoalRow> = {}): FinancialGoalRow {
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
    created_at: "2025-01-01T00:00:00Z",
    ...over,
  };
}

function change(
  over: Partial<AdvisorProposalChangeRow> &
    Pick<AdvisorProposalChangeRow, "entity_type" | "field_key" | "new_value">
): AdvisorProposalChangeRow {
  return {
    id: `ch-${over.field_key}-${over.entity_id ?? "p"}`,
    proposal_id: "prop1",
    section: "profile_assumptions",
    entity_id: null,
    field_label: over.field_key,
    old_value: null,
    explanation: null,
    sort_order: 0,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    ...over,
  };
}

function baseInputs(): OverlayInputs {
  return {
    profile: profile(),
    investments: [investment()],
    budgetLines: [budgetLine()],
    goals: [goal()],
  };
}

describe("applyProposalChanges — scenario matrix", () => {
  it("empty change-set is identity (same reference, no clone)", () => {
    const inputs = baseInputs();
    const out = applyProposalChanges(inputs, []);
    expect(out).toBe(inputs);
  });

  it("display_name + target_retirement_age", () => {
    const out = applyProposalChanges(baseInputs(), [
      change({ entity_type: "profile", field_key: "display_name", new_value: "New Name" }),
      change({
        entity_type: "profile",
        field_key: "target_retirement_age",
        new_value: "60",
      }),
    ]);
    expect(out.profile?.display_name).toBe("New Name");
    expect(out.profile?.target_retirement_age).toBe(60);
  });

  it.each([
    ["monthly_income", "7000"],
    ["monthly_gross_salary", "8000"],
    ["savings_target_monthly", "1500"],
    ["fixed_expenses_monthly", "2500"],
    ["retirement_monthly_spend_goal", "3500"],
    // the three fields the legacy accept path silently dropped:
    ["retirement_dividend_yield_annual", "0.05"],
    ["retirement_withdrawal_rate_annual", "0.035"],
    ["annual_salary_growth_nominal", "0.04"],
  ])("profile field %s applies as canonical string", (field, value) => {
    const out = applyProposalChanges(baseInputs(), [
      change({ entity_type: "profile", field_key: field, new_value: value }),
    ]);
    expect((out.profile as Record<string, unknown>)[field]).toBe(
      String(Number(value))
    );
  });

  it("budget_line amount", () => {
    const out = applyProposalChanges(baseInputs(), [
      change({
        entity_type: "budget_line",
        entity_id: "bl1",
        field_key: "amount",
        new_value: "950",
        section: "cash_flow",
      }),
    ]);
    expect(out.budgetLines[0].amount).toBe("950");
  });

  it("goal monthly_contribution", () => {
    const out = applyProposalChanges(baseInputs(), [
      change({
        entity_type: "goal",
        entity_id: "g1",
        field_key: "monthly_contribution",
        new_value: "750",
        section: "goals",
      }),
    ]);
    expect(out.goals[0].monthly_contribution).toBe("750");
  });

  it("investment partial edit MERGES onto canonical (no clobber of unchanged fields)", () => {
    const out = applyProposalChanges(baseInputs(), [
      change({
        entity_type: "investment",
        entity_id: "inv1",
        field_key: "monthly_contribution",
        new_value: "900",
        old_value: "500",
        section: "investments",
      }),
    ]);
    const inv = out.investments[0];
    expect(inv.monthly_contribution).toBe("900");
    // unchanged fields retained from canonical — the legacy clobber bug fix
    expect(inv.name).toBe("Brokerage");
    expect(inv.current_value).toBe("10000");
    expect(inv.expected_annual_return).toBe("0.06");
  });

  it("investment insert (all old_value empty)", () => {
    const out = applyProposalChanges(baseInputs(), [
      change({ entity_type: "investment", entity_id: "new1", field_key: "name", new_value: "Robo", old_value: null, section: "investments" }),
      change({ entity_type: "investment", entity_id: "new1", field_key: "current_value", new_value: "2000", old_value: null, section: "investments" }),
      change({ entity_type: "investment", entity_id: "new1", field_key: "monthly_contribution", new_value: "250", old_value: "", section: "investments" }),
    ]);
    expect(out.investments).toHaveLength(2);
    const added = out.investments.find((i) => i.id === "new1");
    expect(added).toMatchObject({
      name: "Robo",
      current_value: "2000",
      monthly_contribution: "250",
      expected_annual_return: "0",
    });
  });

  it("investment delete", () => {
    const out = applyProposalChanges(baseInputs(), [
      change({
        entity_type: "investment",
        entity_id: "inv1",
        field_key: "_deleted",
        new_value: "true",
        section: "investments",
      }),
    ]);
    expect(out.investments).toHaveLength(0);
  });

  it("multi-entity change-set composes independently", () => {
    const out = applyProposalChanges(baseInputs(), [
      change({ entity_type: "profile", field_key: "monthly_income", new_value: "9000" }),
      change({ entity_type: "goal", entity_id: "g1", field_key: "monthly_contribution", new_value: "400", section: "goals" }),
      change({ entity_type: "budget_line", entity_id: "bl1", field_key: "amount", new_value: "700", section: "cash_flow" }),
    ]);
    expect(out.profile?.monthly_income).toBe("9000");
    expect(out.goals[0].monthly_contribution).toBe("400");
    expect(out.budgetLines[0].amount).toBe("700");
  });

  it("unknown field_key is ignored", () => {
    const out = applyProposalChanges(baseInputs(), [
      change({ entity_type: "profile", field_key: "not_a_real_field", new_value: "x" }),
    ]);
    expect(out.profile).toEqual(baseInputs().profile);
  });

  it("never mutates inputs (incl. the request-cached profile object)", () => {
    const inputs = baseInputs();
    const snapshot = structuredClone(inputs);
    applyProposalChanges(inputs, [
      change({ entity_type: "profile", field_key: "monthly_income", new_value: "9999" }),
      change({ entity_type: "investment", entity_id: "inv1", field_key: "name", new_value: "X", old_value: "Brokerage", section: "investments" }),
      change({ entity_type: "goal", entity_id: "g1", field_key: "monthly_contribution", new_value: "1", section: "goals" }),
      change({ entity_type: "budget_line", entity_id: "bl1", field_key: "amount", new_value: "1", section: "cash_flow" }),
    ]);
    expect(inputs).toEqual(snapshot);
  });
});
