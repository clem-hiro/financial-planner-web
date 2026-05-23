import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { DashboardPayload } from "@/data/dashboard";
import type {
  BudgetLineRow,
  FinancialGoalRow,
  InvestmentRow,
  ProfileRow,
} from "@/data/supabase/types";
import { AdvisorClientOverview } from "@/features/advisor/AdvisorClientOverview";
import { AdvisorClientDetailShell } from "@/features/advisor/AdvisorClientDetailShell";
import { MethodologyProvider } from "@/features/help/methodology-context";
import { ProposalProjectionCompare } from "@/features/proposals/ProposalProjectionCompare";

function profile(): ProfileRow {
  return {
    id: "client-1",
    profile_type: "client",
    advisor_user_id: null,
    display_name: "Jane Client",
    monthly_income: "8000",
    salary_frequency: null,
    annual_bonus: null,
    savings_target_monthly: "2000",
    fixed_expenses_monthly: "3000",
    debt_obligations_monthly: null,
    monthly_gross_salary: "9000",
    annual_salary_growth_nominal: null,
    expense_growth_nominal: null,
    cpf_age_band: null,
    birth_date: null,
    target_retirement_age: null,
    retirement_monthly_spend_goal: null,
    retirement_dividend_yield_annual: null,
    retirement_withdrawal_rate_annual: null,
    onboarding_required: false,
    onboarding_step: null,
    onboarding_completed_at: "2026-01-01T00:00:00Z",
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
}

function payload(): DashboardPayload {
  // Minimal shape: the overview reads netWorth, the four cashflow totals, and
  // the aggregate. Cast covers fields the read-only surface never touches.
  return {
    netWorth: 120000,
    monthlyExpensesLoggedTotal: 2500,
    monthlyPlannedMonthlyBudgetTotal: 3000,
    monthlyExpensesTotal: 2800,
    monthlyBudgetAggregate: { overBy: 0 },
  } as unknown as DashboardPayload;
}

const goals: FinancialGoalRow[] = [
  {
    id: "goal-1",
    title: "House downpayment",
    target_amount: "100000",
    monthly_contribution: "1500",
  } as unknown as FinancialGoalRow,
];

const budgetLines: BudgetLineRow[] = [
  {
    id: "bl-1",
    category: "groceries",
    amount: "600",
    cadence: "monthly",
  } as unknown as BudgetLineRow,
];

const investments: InvestmentRow[] = [
  {
    id: "inv-1",
    name: "Index fund",
    current_value: "40000",
    monthly_contribution: "500",
    expected_annual_return: "0.06",
    contribution_growth_annual: "0",
    contribution_type: null,
    contribution_duration_years: null,
    withdrawal_monthly: "0",
    withdrawal_start_years: null,
  } as unknown as InvestmentRow,
];

function renderOverview(extra?: { hasOverlay?: boolean; draftChangeCount?: number }) {
  // DashboardRetirementSection (in the projection panes) reaches for the
  // methodology context, so wrap the read-only overview to render it.
  return renderToStaticMarkup(
    <MethodologyProvider>
      <AdvisorClientOverview
        clientId="client-1"
        consentGranted
        profile={profile()}
        payload={payload()}
        payloadProposed={payload()}
        hasOverlay={extra?.hasOverlay ?? false}
        goals={goals}
        budgetLines={budgetLines}
        investments={investments}
        month="2026-05"
        draftChangeCount={extra?.draftChangeCount ?? 0}
      />
    </MethodologyProvider>
  );
}

describe("Advisor overview/compose split", () => {
  it("overview renders no authoring forms or per-row controls", () => {
    const html = renderOverview();
    // Authoring affordances live only on Compose.
    expect(html).not.toContain("Suggest changes");
    expect(html).not.toContain("Add goal");
    expect(html).not.toContain("Submit proposal");
    expect(html).not.toContain("Submit for client review");
    // Read-only tables drop the Remove column header.
    expect(html).not.toContain(">Remove<");
    // Read-only data is still shown.
    expect(html).toContain("House downpayment");
    expect(html).toContain("Index fund");
  });

  it("overview projection panel: no overlay ⇒ Compose link + locked tablist (Actual active, With proposal disabled)", () => {
    const html = renderOverview({ hasOverlay: false });
    expect(html).toContain("Compose proposal");
    expect(html).toContain("/advisor/client/client-1?view=compose");
    // Canonical state still shows the tablist — locked on "Actual", "With
    // proposal" disabled until a draft exists.
    expect(html).toContain("Actual");
    expect(html).toContain("With proposal");
    expect(html).toContain('aria-disabled="true"');
    // The disabled control is a real <button disabled>, not interactive.
    expect(html).toMatch(/<button[^>]*disabled[^>]*>With proposal<\/button>/);
  });

  it("overview projection panel renders the Compose-proposal link (with overlay)", () => {
    const html = renderOverview({ hasOverlay: true });
    expect(html).toContain("Compose proposal");
    expect(html).toContain("/advisor/client/client-1?view=compose");
    // Overlay ⇒ the toggle tablist is present alongside the button.
    expect(html).toContain("With proposal");
  });

  it("overview shows a 'Continue composing' rail pointer only when a draft exists", () => {
    expect(renderOverview({ draftChangeCount: 0 })).not.toContain("Continue composing");
    const withDraft = renderOverview({ draftChangeCount: 2 });
    expect(withDraft).toContain("Continue composing");
    expect(withDraft).toContain("2 suggested changes");
  });

  it("ProjectionCompare stays backward-compatible: no action + no overlay ⇒ canonical only", () => {
    const html = renderToStaticMarkup(
      <ProposalProjectionCompare
        hasOverlay={false}
        actual={<div>ACTUAL_PANE</div>}
        proposed={<div>PROPOSED_PANE</div>}
      />
    );
    expect(html).toContain("ACTUAL_PANE");
    expect(html).not.toContain("PROPOSED_PANE");
    expect(html).not.toContain("With proposal");
  });

  it("shell renders Overview | Compose | Proposals with Compose active on ?view=compose", () => {
    const html = renderToStaticMarkup(
      <AdvisorClientDetailShell
        clientId="client-1"
        activeView="compose"
        compose={<div>COMPOSE_BODY</div>}
      />
    );
    for (const label of ["Overview", "Compose", "Proposals"]) {
      expect(html).toContain(`>${label}<`);
    }
    expect(html).toContain("COMPOSE_BODY");
    // Active tab carries aria-current=page and points at ?view=compose.
    expect(html).toContain('aria-current="page"');
    expect(html).toContain("/advisor/client/client-1?view=compose");
  });
});
