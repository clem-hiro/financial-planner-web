import type { DashboardPayload } from "@/data/dashboard";
import { num } from "@/data/mappers";
import type {
  BudgetLineRow,
  CashAccountRow,
  FinancialGoalRow,
  InvestmentRow,
  LiabilityRow,
  VehicleRow,
} from "@/data/supabase/types";
import type { ProfileRow } from "@/data/supabase/types";
import type { AdvisorProposalChangeRow } from "@/data/supabase/types";
import {
  AdvisorClientCashSection,
  type AdvisorCashRow,
} from "@/features/advisor/AdvisorClientCashSection";
import {
  AdvisorClientLiabilitySection,
  type AdvisorLiabilityRow,
} from "@/features/advisor/AdvisorClientLiabilitySection";
import {
  AdvisorClientVehicleSection,
  type AdvisorVehicleRow,
} from "@/features/advisor/AdvisorClientVehicleSection";
import { AdvisorBadge, AdvisorSection } from "@/features/advisor/advisor-workspace-primitives";
import { AdvisorClientHeader } from "@/features/advisor/AdvisorClientHeader";
import { AdvisorConsentRequired } from "@/features/advisor/AdvisorConsentRequired";
import {
  DraftSummaryPanel,
  SubmitProposalBar,
} from "@/features/advisor/AdvisorProposalDraftPanel";
import { AdvisorProposeRemovalButton } from "@/features/advisor/AdvisorProposeRemovalButton";
import { AdvisorSuggestionModeBanner } from "@/features/advisor/AdvisorSuggestionModeBanner";
import { AdvisorBudgetLineAmountForm } from "@/features/advisor/forms/AdvisorBudgetLineAmountForm";
import { AdvisorGoalContributionForm } from "@/features/advisor/forms/AdvisorGoalContributionForm";
import { AdvisorNewBudgetLineForm } from "@/features/advisor/forms/AdvisorNewBudgetLineForm";
import { AdvisorNewGoalForm } from "@/features/advisor/forms/AdvisorNewGoalForm";
import { AdvisorProfilePatchForm } from "@/features/advisor/forms/AdvisorProfilePatchForm";
import { InvestmentAssumptionBanner } from "@/features/goals/InvestmentAssumptionBanner";
import {
  InvestmentBalancesList,
  type InvestmentBalanceRow,
} from "@/features/goals/InvestmentBalancesList";
import { InvestmentForm } from "@/features/goals/InvestmentForm";
import {
  deleteAdvisorClientBudgetLineAction,
  deleteAdvisorClientGoalAction,
} from "@/server/advisor-client-actions";
import { DEFAULT_BASE_CURRENCY } from "@/lib/currency";
import { birthDateIsValidPast } from "@/lib/validation";
import { CollapsiblePane, CollapsiblePaneRail } from "@/ui/CollapsiblePaneRail";
import { formatCurrency } from "@/ui/lib/format";

/** Dedicated proposal-authoring surface. Mirrors the consent gate and pending-
 * proposal lockout of the read-only Overview; all forms/actions are reused
 * unchanged. The projection panel stays on the Overview. */
export function AdvisorClientCompose({
  clientId,
  consentGranted,
  profile,
  payload,
  goals,
  budgetLines,
  investments,
  cashAccounts,
  cashVisible,
  liabilities,
  liabilitiesVisible,
  vehicles,
  vehiclesVisible,
  month,
  draftProposalId,
  draftChanges,
  hasPendingProposal,
}: {
  clientId: string;
  consentGranted: boolean;
  profile: ProfileRow;
  payload: DashboardPayload;
  goals: FinancialGoalRow[];
  budgetLines: BudgetLineRow[];
  investments: InvestmentRow[];
  cashAccounts: CashAccountRow[];
  /** Whether the client has shared the cash_accounts category (Phase 1 toggle). */
  cashVisible: boolean;
  liabilities: LiabilityRow[];
  /** Whether the client has shared the liabilities category (Phase 1 toggle). */
  liabilitiesVisible: boolean;
  vehicles: VehicleRow[];
  /** Whether the client has shared the vehicles category (Phase 1 toggle). */
  vehiclesVisible: boolean;
  month: string;
  draftProposalId: string | null;
  draftChanges: AdvisorProposalChangeRow[];
  hasPendingProposal: boolean;
}) {
  if (!consentGranted) {
    return <AdvisorConsentRequired profile={profile} />;
  }

  const draftChangeCount = draftChanges.length;
  const currency = profile.base_currency ?? DEFAULT_BASE_CURRENCY;
  const investmentBalanceRows: InvestmentBalanceRow[] = investments.map((i) => ({
    id: i.id,
    name: i.name,
    current_value: num(i.current_value),
    monthly_contribution: num(i.monthly_contribution),
    expected_annual_return: num(i.expected_annual_return),
    contribution_growth_annual: num(i.contribution_growth_annual),
    contribution_type: i.contribution_type ?? null,
    contribution_duration_years:
      i.contribution_duration_years != null &&
      String(i.contribution_duration_years).trim() !== ""
        ? num(i.contribution_duration_years as string)
        : null,
    withdrawal_monthly: num(i.withdrawal_monthly),
    withdrawal_start_years:
      i.withdrawal_start_years != null &&
      String(i.withdrawal_start_years).trim() !== ""
        ? num(i.withdrawal_start_years)
        : null,
  }));
  const investmentPlanningContext =
    profile.birth_date &&
    typeof profile.birth_date === "string" &&
    birthDateIsValidPast(profile.birth_date) &&
    profile.target_retirement_age != null
      ? {
          birthDate: profile.birth_date,
          targetRetirementAge: Number(profile.target_retirement_age),
        }
      : null;
  const monthlyBudgetLines = budgetLines.filter((b) => b.cadence === "monthly");
  const cashRows: AdvisorCashRow[] = cashAccounts.map((c) => ({
    id: c.id,
    name: c.name,
    balance: num(c.balance),
    purpose: c.purpose,
  }));
  const liabilityRows: AdvisorLiabilityRow[] = liabilities.map((l) => ({
    id: l.id,
    name: l.name,
    balance: num(l.balance),
    category: l.category ?? null,
    interestRatePercent:
      l.interest_rate_annual != null && String(l.interest_rate_annual).trim() !== ""
        ? num(l.interest_rate_annual) * 100
        : null,
    remainingTenureYears:
      l.remaining_tenure_months != null
        ? Math.round((l.remaining_tenure_months / 12) * 10) / 10
        : null,
    monthlyRepayment:
      l.monthly_repayment != null && String(l.monthly_repayment).trim() !== ""
        ? num(l.monthly_repayment)
        : null,
  }));
  const vehicleRows: AdvisorVehicleRow[] = vehicles.map((v) => ({
    id: v.id,
    label: v.label,
    status: v.vehicle_status,
    marketValue:
      v.current_market_value != null &&
      String(v.current_market_value).trim() !== ""
        ? num(v.current_market_value)
        : null,
    onTheRoadPaid:
      v.on_the_road_paid != null && String(v.on_the_road_paid).trim() !== ""
        ? num(v.on_the_road_paid)
        : null,
    loanBalance:
      v.loan_balance != null && String(v.loan_balance).trim() !== ""
        ? num(v.loan_balance)
        : null,
    loanMonthlyPayment:
      v.loan_monthly_payment != null &&
      String(v.loan_monthly_payment).trim() !== ""
        ? num(v.loan_monthly_payment)
        : null,
    loanMonthsRemaining: v.loan_months_remaining ?? null,
  }));

  // Frozen submit bar is fixed to the viewport bottom; pad the page so the last
  // section isn't occluded. Only shows while a draft exists and not locked.
  const showSubmitBar = !hasPendingProposal && !!draftProposalId;

  return (
    <div className={`space-y-8 lg:space-y-10 ${showSubmitBar ? "pb-44" : ""}`}>
      <AdvisorClientHeader profile={profile} payload={payload} month={month} />

      <AdvisorSuggestionModeBanner
        changeCount={draftChangeCount}
        hasPendingProposal={hasPendingProposal}
      />

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start xl:gap-10">
        <div id="advisor-compose-left" className="space-y-8">
          <AdvisorSection
            id="profile"
            eyebrow="Operational"
            title="Profile & assumptions"
            description="Fast edits — income and targets drive projections on the client app."
            aside={<AdvisorBadge tone="neutral">Suggestion mode</AdvisorBadge>}
          >
            <AdvisorProfilePatchForm
              clientId={clientId}
              disabled={hasPendingProposal}
              defaults={{
                display_name: profile.display_name ?? "",
                monthly_income: profile.monthly_income ?? "",
                monthly_gross_salary: profile.monthly_gross_salary ?? "",
                savings_target_monthly: profile.savings_target_monthly ?? "",
                fixed_expenses_monthly: profile.fixed_expenses_monthly ?? "",
              }}
            />
          </AdvisorSection>

          <AdvisorSection
            id="goals"
            title="Goals & priorities"
            description="Adjust planned monthly contributions. Full goal editor remains on the client Planning flow."
          >
            <div className="space-y-4">
              {goals.length === 0 ? (
                <p className="text-sm text-slate-600">No goals yet.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-100">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-slate-100 bg-slate-50/90 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Goal</th>
                        <th className="px-4 py-3">Target</th>
                        <th className="px-4 py-3 text-right">Monthly plan</th>
                        <th className="px-4 py-3 text-right">Remove</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {goals.map((g) => (
                        <tr key={g.id} className="text-slate-800">
                          <td className="px-4 py-3 font-medium text-slate-900">{g.title}</td>
                          <td className="px-4 py-3 tabular-nums text-slate-600">
                            {formatCurrency(num(g.target_amount), currency)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <AdvisorGoalContributionForm
                              clientId={clientId}
                              goalId={g.id}
                              defaultMonthly={num(g.monthly_contribution)}
                              disabled={hasPendingProposal}
                            />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <AdvisorProposeRemovalButton
                              action={deleteAdvisorClientGoalAction}
                              clientId={clientId}
                              entityId={g.id}
                              entityName={g.title}
                              disabled={hasPendingProposal}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 sm:p-5">
                <AdvisorNewGoalForm clientId={clientId} disabled={hasPendingProposal} />
              </div>
            </div>
          </AdvisorSection>

          <AdvisorSection
            id="budget"
            title="Budget management"
            description="Monthly cadence lines for the active profile. Annual lines stay on the client Budget page for now."
          >
            <div className="space-y-4">
              {monthlyBudgetLines.length === 0 ? (
                <p className="text-sm text-slate-600">No monthly budget lines.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-100">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-slate-100 bg-slate-50/90 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3 text-right">Planned / mo</th>
                        <th className="px-4 py-3 text-right">Remove</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {monthlyBudgetLines.map((line) => (
                        <tr key={line.id}>
                          <td className="px-4 py-3 font-medium capitalize text-slate-900">
                            {line.category}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <AdvisorBudgetLineAmountForm
                              clientId={clientId}
                              lineId={line.id}
                              defaultAmount={num(line.amount)}
                              disabled={hasPendingProposal}
                            />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <AdvisorProposeRemovalButton
                              action={deleteAdvisorClientBudgetLineAction}
                              clientId={clientId}
                              entityId={line.id}
                              entityName={line.category}
                              disabled={hasPendingProposal}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 sm:p-5">
                <AdvisorNewBudgetLineForm clientId={clientId} disabled={hasPendingProposal} />
              </div>
            </div>
          </AdvisorSection>

          <AdvisorSection
            id="investments"
            title="Investments & savings"
            description="Add, edit, or remove investment accounts — saved as suggestions until the client accepts."
          >
            <InvestmentAssumptionBanner className="mb-4" />
            <div className="overflow-hidden rounded-xl border border-slate-100 bg-white divide-y divide-slate-100">
              {investmentBalanceRows.length > 0 ? (
                <div className="p-4 sm:p-5">
                  <InvestmentBalancesList
                    items={investmentBalanceRows}
                    currencyCode={currency}
                    planningContext={investmentPlanningContext}
                    advisorClientId={clientId}
                    advisorSuggestionDisabled={hasPendingProposal}
                    accountsHeading="Client accounts"
                    showAssumptionBanner={false}
                  />
                </div>
              ) : null}
              <div className="p-4 sm:p-5">
                <InvestmentForm
                  advisorClientId={clientId}
                  advisorSuggestionDisabled={hasPendingProposal}
                  showAssumptionBanner={false}
                />
              </div>
            </div>
          </AdvisorSection>

          <AdvisorSection
            id="cash-accounts"
            title="Cash accounts"
            description="Bank and savings balances — saved as suggestions until the client accepts."
          >
            {cashVisible ? (
              <AdvisorClientCashSection
                clientId={clientId}
                accounts={cashRows}
                currencyCode={currency}
                disabled={hasPendingProposal}
              />
            ) : (
              <LockedCategoryCard label="Cash accounts" />
            )}
          </AdvisorSection>

          <AdvisorSection
            id="liabilities"
            title="Liabilities"
            description="Loans and debts — saved as suggestions until the client accepts."
          >
            {liabilitiesVisible ? (
              <AdvisorClientLiabilitySection
                clientId={clientId}
                liabilities={liabilityRows}
                currencyCode={currency}
                disabled={hasPendingProposal}
              />
            ) : (
              <LockedCategoryCard label="Liabilities" />
            )}
          </AdvisorSection>

          <AdvisorSection
            id="vehicles"
            title="Vehicles"
            description="Cars and other vehicles — saved as suggestions until the client accepts."
          >
            {vehiclesVisible ? (
              <AdvisorClientVehicleSection
                clientId={clientId}
                vehicles={vehicleRows}
                currencyCode={currency}
                disabled={hasPendingProposal}
              />
            ) : (
              <LockedCategoryCard label="Vehicles" />
            )}
          </AdvisorSection>
        </div>

        <CollapsiblePaneRail>
          <CollapsiblePane title="Suggested Plans Consolidation" defaultOpen>
            <div className="space-y-4">
              <DraftSummaryPanel
                proposalId={draftProposalId}
                changes={draftChanges}
                currencyCode={currency}
                disabled={hasPendingProposal}
              />
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3 text-xs leading-relaxed text-slate-600">
                <p className="font-semibold text-slate-700">Session assist</p>
                <ul className="mt-1.5 space-y-1">
                  <li>• Client retains full ownership of their login.</li>
                  <li>• Changes apply only after the client accepts your proposal.</li>
                </ul>
              </div>
            </div>
          </CollapsiblePane>
          <CollapsiblePane title="Opportunity Detection">
            <p className="text-sm leading-relaxed text-slate-600">
              Insurance, CPF, and product opportunity scoring —{" "}
              <span className="font-medium text-slate-800">Opportunity Detection Coming</span>.
            </p>
          </CollapsiblePane>
          <CollapsiblePane title="AI Insights">
            <p className="text-sm leading-relaxed text-slate-600">
              Narrative briefs and anomaly explanations —{" "}
              <span className="font-medium text-slate-800">AI Insights Coming</span>.
            </p>
          </CollapsiblePane>
        </CollapsiblePaneRail>
      </div>

      <SubmitProposalBar
        proposalId={draftProposalId}
        changeCount={draftChangeCount}
        disabled={hasPendingProposal}
        alignToId="advisor-compose-left"
      />
    </div>
  );
}

/** Shown when a sensitive category is private (client hasn't opted in): a
 * neutral locked card, no data fetched/displayed. The category name is omitted
 * here — the parent AdvisorSection header already shows it; `label` only feeds
 * the aria-label for screen readers. */
function LockedCategoryCard({ label }: { label: string }) {
  return (
    <div
      aria-label={`${label} — private`}
      className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5"
    >
      <span aria-hidden className="mt-0.5 text-slate-400">
        🔒
      </span>
      <div className="space-y-1">
        <span className="inline-flex rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600">
          Private
        </span>
        <p className="text-xs text-slate-500">
          Client chose not to share this category. Ask them to enable it under
          Privacy &amp; Advisor Access to view or propose changes.
        </p>
      </div>
    </div>
  );
}
