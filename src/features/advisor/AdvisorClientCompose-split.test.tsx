import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { DashboardPayload } from "@/data/dashboard";
import type {
  BudgetLineRow,
  FinancialGoalRow,
  InvestmentRow,
  ProfileRow,
} from "@/data/supabase/types";
import { AdvisorClientCompose } from "@/features/advisor/AdvisorClientCompose";
import { AdvisorClientOverview } from "@/features/advisor/AdvisorClientOverview";
import { AdvisorClientDetailShell } from "@/features/advisor/AdvisorClientDetailShell";
import { MethodologyProvider } from "@/features/help/methodology-context";
import { ProposalProjectionCompare } from "@/features/proposals/ProposalProjectionCompare";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {} }),
}));

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
    cpfProjectionMissingInputs: [],
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

function renderCompose(extra?: { hasPendingProposal?: boolean }) {
  return renderToStaticMarkup(
    <MethodologyProvider>
      <AdvisorClientCompose
        clientId="client-1"
        consentGranted
        profile={{
          ...profile(),
          annual_salary_growth_nominal: "0.02",
          expense_growth_nominal: "0.025",
          target_retirement_age: 65,
          retirement_monthly_spend_goal: "4500",
          retirement_dividend_yield_annual: "0.03",
          retirement_withdrawal_rate_annual: "0.04",
        }}
        payload={payload()}
        goals={goals}
        budgetLines={budgetLines}
        investments={investments}
        cashAccounts={[]}
        cashVisible={false}
        liabilities={[]}
        liabilitiesVisible={false}
        vehicles={[]}
        vehiclesVisible={false}
        properties={[]}
        propertiesVisible={false}
        housingLoans={[]}
        housingLoansVisible={false}
        month="2026-05"
        draftProposalId={null}
        draftChanges={[]}
        hasPendingProposal={extra?.hasPendingProposal ?? false}
      />
    </MethodologyProvider>
  );
}

function inputTag(html: string, name: string): string {
  return html.match(new RegExp(`<input[^>]*name="${name}"[^>]*>`))?.[0] ?? "";
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

  it("hides the Overview/Proposals tab rail on activeView=compose; compose body still renders", () => {
    const html = renderToStaticMarkup(
      <AdvisorClientDetailShell
        clientId="client-1"
        activeView="compose"
        compose={<div>COMPOSE_BODY</div>}
      />
    );
    // Tab rail is hidden on compose (reached via projection panel, not a tab).
    expect(html).not.toContain('role="tablist"');
    // Compose is reached via the projection-panel button, not a tab.
    expect(html).not.toContain(">Compose<");
    // The compose slot still renders when activeView is "compose".
    expect(html).toContain("COMPOSE_BODY");
    // No tab is highlighted in the compose view — that's acceptable.
    expect(html).not.toContain('aria-current="page"');
  });

  it("compose exposes editable controls for all default-visible proposal fields", () => {
    const html = renderCompose();
    const editableNames = [
      "display_name",
      "monthly_income",
      "monthly_gross_salary",
      "annual_salary_growth_percent",
      "savings_target_monthly",
      "fixed_expenses_monthly",
      "expense_growth_percent",
      "target_retirement_age",
      "retirement_monthly_spend_goal",
      "retirement_dividend_yield_percent",
      "retirement_withdrawal_rate_percent",
      "title",
      "target_amount",
      "monthly_contribution",
      "category",
      "amount",
      "expected_annual_return",
    ];

    for (const name of editableNames) {
      const tag = inputTag(html, name);
      expect(tag, `missing input ${name}`).not.toBe("");
      expect(tag, `input ${name} should be editable`).not.toContain("disabled");
    }
    expect(inputTag(html, "annual_salary_growth_percent")).toContain('value="2"');
    expect(inputTag(html, "expense_growth_percent")).toContain('value="2.5"');
    expect(inputTag(html, "retirement_dividend_yield_percent")).toContain(
      'value="3"'
    );
    expect(inputTag(html, "retirement_withdrawal_rate_percent")).toContain(
      'value="4"'
    );
  });

  it("compose keeps authoring controls editable while another proposal is pending", () => {
    const html = renderCompose({ hasPendingProposal: true });
    expect(html).toContain("Client review in progress");
    expect(inputTag(html, "display_name")).not.toContain("disabled");
    expect(inputTag(html, "target_amount")).not.toContain("disabled");
    expect(inputTag(html, "category")).not.toContain("disabled");
  });

  it("breadcrumb hierarchy: overview/proposals → Clients, compose → Overview, detail → Proposals", () => {
    const breadcrumbOf = (activeView: "overview" | "compose" | "proposals" | "proposalDetail") =>
      renderToStaticMarkup(
        <AdvisorClientDetailShell
          clientId="client-1"
          activeView={activeView}
          overview={<div>B</div>}
          compose={<div>B</div>}
          proposals={<div>B</div>}
          proposalDetail={<div>B</div>}
        />
      );

    // Overview & Proposals are sibling tabs → up to the roster.
    const overview = breadcrumbOf("overview");
    expect(overview).toContain("← Clients");
    expect(overview).toContain("/advisor/clients");
    expect(overview).not.toContain("← Overview");
    expect(overview).not.toContain("← Proposals");

    const proposals = breadcrumbOf("proposals");
    expect(proposals).toContain("← Clients");
    expect(proposals).not.toContain("← Overview");
    expect(proposals).not.toContain("← Proposals");

    // Compose is launched from overview → back to Overview.
    const compose = breadcrumbOf("compose");
    expect(compose).toContain("← Overview");
    expect(compose).not.toContain("← Clients");
    expect(compose).not.toContain("← Proposals");

    // Detail is a child of the list → back to Proposals.
    const detail = breadcrumbOf("proposalDetail");
    expect(detail).toContain("← Proposals");
    expect(detail).not.toContain("← Clients");
    expect(detail).not.toContain("← Overview");
  });
});
