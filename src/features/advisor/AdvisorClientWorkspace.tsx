import Link from "next/link";
import type { DashboardPayload } from "@/data/dashboard";
import { num } from "@/data/mappers";
import type { BudgetLineRow, FinancialGoalRow, InvestmentRow } from "@/data/supabase/types";
import type { ProfileRow } from "@/data/supabase/types";
import { advisorClientWorkspaceSignals } from "@/domain/finance/advisor-client-health";
import { AdvisorBadge, AdvisorComingSoonPanel, AdvisorSection } from "@/features/advisor/advisor-workspace-primitives";
import { AdvisorProposalDraftPanel } from "@/features/advisor/AdvisorProposalDraftPanel";
import { DashboardRetirementSection } from "@/features/dashboard/DashboardRetirementSection";
import { ProposalProjectionCompare } from "@/features/proposals/ProposalProjectionCompare";
import type { AdvisorProposalChangeRow } from "@/data/supabase/types";
import { AdvisorSuggestionModeBanner } from "@/features/advisor/AdvisorSuggestionModeBanner";
import { AdvisorBudgetLineAmountForm } from "@/features/advisor/forms/AdvisorBudgetLineAmountForm";
import { AdvisorGoalContributionForm } from "@/features/advisor/forms/AdvisorGoalContributionForm";
import { AdvisorProfilePatchForm } from "@/features/advisor/forms/AdvisorProfilePatchForm";
import {
  InvestmentBalancesList,
} from "@/features/goals/InvestmentBalancesList";
import { investmentRowToBalanceRow } from "@/features/goals/investment-balance-row";
import { InvestmentForm } from "@/features/goals/InvestmentForm";
import { DEFAULT_BASE_CURRENCY } from "@/lib/currency";
import { birthDateIsValidPast } from "@/lib/validation";
import { appInlineLinkClass } from "@/ui/app-link-styles";
import { formatCurrency } from "@/ui/lib/format";

function onboardingLabel(profile: ProfileRow) {
  if (profile.onboarding_completed_at) return "Complete";
  if (profile.onboarding_required) return "In progress";
  return "—";
}

export function AdvisorClientWorkspace({
  clientId,
  consentGranted,
  profile,
  payload,
  payloadProposed,
  hasOverlay,
  goals,
  budgetLines,
  investments,
  month,
  draftProposalId,
  draftChanges,
  hasPendingProposal,
}: {
  clientId: string;
  consentGranted: boolean;
  profile: ProfileRow;
  payload: DashboardPayload;
  payloadProposed: DashboardPayload;
  hasOverlay: boolean;
  goals: FinancialGoalRow[];
  budgetLines: BudgetLineRow[];
  investments: InvestmentRow[];
  month: string;
  draftProposalId: string | null;
  draftChanges: AdvisorProposalChangeRow[];
  hasPendingProposal: boolean;
}) {
  // Consent-first (P-ORDER): a linked-but-non-consented advisor cannot author
  // proposals. Server-side enforcement is the trust boundary (the proposal
  // create/save actions reject); this is the explicit gated state — NOT an
  // empty workspace — so the advisor sees why authoring is unavailable.
  if (!consentGranted) {
    return (
      <div className="space-y-8 lg:space-y-10">
        <p className="text-sm">
          <Link href="/advisor/clients" className={appInlineLinkClass}>
            ← Clients
          </Link>
        </p>
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              {profile.display_name?.trim() || "Client"}
            </h1>
            <AdvisorBadge tone="warning">Consent required</AdvisorBadge>
          </div>
        </header>
        <AdvisorComingSoonPanel
          title="Consent required"
          body="This client has not granted you consent to view their financial data or receive plan suggestions. Proposal authoring unlocks once they grant consent. No client data is shown until then."
        />
      </div>
    );
  }

  const draftChangeCount = draftChanges.length;
  const currency = profile.base_currency ?? DEFAULT_BASE_CURRENCY;
  const investmentBalanceRows = investments.map(investmentRowToBalanceRow);
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
  const signals = advisorClientWorkspaceSignals(profile, payload);
  const monthlyBudgetLines = budgetLines.filter((b) => b.cadence === "monthly");

  return (
    <div className="space-y-8 lg:space-y-10">
      <p className="text-sm">
        <Link href="/advisor/clients" className={appInlineLinkClass}>
          ← Clients
        </Link>
      </p>

      <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                {profile.display_name?.trim() || "Client"}
              </h1>
              <AdvisorBadge tone="slate">Workspace</AdvisorBadge>
              {signals.riskBand === "high" ? (
                <AdvisorBadge tone="risk">Risk: high</AdvisorBadge>
              ) : signals.riskBand === "medium" ? (
                <AdvisorBadge tone="warning">Risk: medium</AdvisorBadge>
              ) : (
                <AdvisorBadge tone="positive">Risk: low</AdvisorBadge>
              )}
            </div>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
              {signals.financialHealthHeadline}. Suggested edits are reviewed by your client before
              their plan updates.
            </p>
            <div className="flex flex-wrap gap-2">
              {signals.tags.slice(0, 5).map((t) => (
                <AdvisorBadge key={t} tone="neutral">
                  {t}
                </AdvisorBadge>
              ))}
            </div>
          </div>
          <div className="grid w-full max-w-md shrink-0 grid-cols-2 gap-3 sm:grid-cols-3 xl:max-w-lg">
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Onboarding
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{onboardingLabel(profile)}</p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Savings rate
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {signals.savingsRatePercent != null
                  ? `${signals.savingsRatePercent}%`
                  : "—"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Month surplus
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {signals.monthlySurplus != null
                  ? formatCurrency(signals.monthlySurplus, currency)
                  : "—"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Net worth
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {formatCurrency(payload.netWorth, currency)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Budget ({month})
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {signals.budgetOnTrack == null
                  ? "—"
                  : signals.budgetOnTrack
                    ? "On track"
                    : "Over plan"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Next action
              </p>
              <p className="mt-1 text-xs font-medium leading-snug text-slate-700">
                {signals.nextActionHint}
              </p>
            </div>
          </div>
        </div>
      </header>

      <AdvisorSuggestionModeBanner
        changeCount={draftChangeCount}
        hasPendingProposal={hasPendingProposal}
      />

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start xl:gap-10">
        <div className="space-y-8">
          <AdvisorSection
            id="projection"
            eyebrow="Projection"
            title="Retirement & net-worth outlook"
            description="Toggle between the client's current plan and the projection with your draft proposal applied."
            aside={
              hasOverlay ? (
                <AdvisorBadge tone="positive">Proposal preview</AdvisorBadge>
              ) : (
                <AdvisorBadge tone="neutral">Canonical</AdvisorBadge>
              )
            }
          >
            <ProposalProjectionCompare
              hasOverlay={hasOverlay}
              actual={
                <DashboardRetirementSection payload={payload} profile={profile} />
              }
              proposed={
                <DashboardRetirementSection
                  payload={payloadProposed}
                  profile={profile}
                />
              }
            />
          </AdvisorSection>

          <AdvisorSection
            id="profile"
            eyebrow="Operational"
            title="Profile & assumptions"
            description="Fast edits — income and targets drive projections on the client app."
            aside={
              <AdvisorBadge tone="neutral">Suggestion mode</AdvisorBadge>
            }
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
            id="health"
            eyebrow="Signals"
            title="Financial health overview"
            description="Lightweight heuristics for triage. Deeper scoring and anomaly detection ship later."
          >
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Savings health
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {signals.savingsHealthLabel}
                </p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Spending / budget
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {signals.budgetHealthLabel}
                </p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Emergency readiness
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-800">
                  Work in Progress
                </p>
                <p className="mt-1 text-xs text-slate-500">Rules engine coming soon.</p>
              </div>
            </div>
          </AdvisorSection>

          <AdvisorSection
            id="goals"
            title="Goals & priorities"
            description="Adjust planned monthly contributions. Full goal editor remains on the client Planning flow."
          >
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </AdvisorSection>

          <AdvisorSection
            id="budget"
            title="Budget management"
            description="Monthly cadence lines for the active profile. Annual lines stay on the client Budget page for now."
          >
            {monthlyBudgetLines.length === 0 ? (
              <p className="text-sm text-slate-600">No monthly budget lines.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50/90 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3 text-right">Planned / mo</th>
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </AdvisorSection>

          <AdvisorSection
            id="cashflow"
            title="Expenses & cashflow"
            description={`Dashboard month ${month}: spend vs plan at a glance.`}
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
                <p className="text-xs font-semibold uppercase text-slate-500">Logged spend</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
                  {formatCurrency(payload.monthlyExpensesLoggedTotal, currency)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
                <p className="text-xs font-semibold uppercase text-slate-500">Planned budget</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
                  {formatCurrency(payload.monthlyPlannedMonthlyBudgetTotal, currency)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
                <p className="text-xs font-semibold uppercase text-slate-500">Spend basis</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
                  {formatCurrency(payload.monthlyExpensesTotal, currency)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
                <p className="text-xs font-semibold uppercase text-slate-500">Overspend</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900">
                  {formatCurrency(payload.monthlyBudgetAggregate.overBy, currency)}
                </p>
              </div>
            </div>
            <p className="mt-4 text-xs text-slate-500">
              Line-item expense editing from the advisor shell is{" "}
              <span className="font-semibold text-slate-700">Work in Progress</span> — clients
              continue to use Spending as the source of truth for receipts-level detail.
            </p>
          </AdvisorSection>

          <AdvisorSection
            id="investments"
            title="Investments & savings"
            description="Add, edit, or remove investment accounts — saved as suggestions until the client accepts."
          >
            <div className="overflow-hidden rounded-xl border border-slate-100 bg-white divide-y divide-slate-100">
              <div className="p-4 sm:p-5">
                <InvestmentForm
                  advisorClientId={clientId}
                  advisorSuggestionDisabled={hasPendingProposal}
                />
              </div>
              {investmentBalanceRows.length > 0 ? (
                <div className="p-4 sm:p-5">
                  <InvestmentBalancesList
                    items={investmentBalanceRows}
                    currencyCode={currency}
                    planningContext={investmentPlanningContext}
                    advisorClientId={clientId}
                    advisorSuggestionDisabled={hasPendingProposal}
                    accountsHeading="Client accounts"
                  />
                </div>
              ) : null}
            </div>
          </AdvisorSection>

          <AdvisorSection
            id="actions"
            eyebrow="Workflow"
            title="Advisor actions"
            description="Operational shortcuts. CRM-style tasks and meeting prep land here next."
          >
            <AdvisorComingSoonPanel
              title="Coming Soon"
              body="Tasks, reminders, meeting agendas, and pre-call briefs will plug into this rail without crowding financial data."
            />
          </AdvisorSection>

          <AdvisorSection id="activity" title="Activity & history">
            <AdvisorComingSoonPanel
              title="Work in Progress"
              body="Unified activity timeline (edits, logins, milestones) is planned. For now rely on client-facing activity pages."
            />
          </AdvisorSection>

          <AdvisorSection id="notes" title="Notes & recommendations">
            <AdvisorComingSoonPanel
              title="Advisor notes — Coming Soon"
              body="Structured notes, follow-ups, and recommendation templates will sync here. Placeholder only in this phase."
            />
          </AdvisorSection>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24">
          <AdvisorProposalDraftPanel
            proposalId={draftProposalId}
            changes={draftChanges}
            currencyCode={currency}
            disabled={hasPendingProposal}
          />
          <div className="rounded-2xl border border-slate-200 bg-slate-900 p-5 text-slate-50 shadow-lg">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Session assist
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-200">
              Use this column during reviews: health signals above, quick profile edits, and
              budget tweaks without leaving the client context.
            </p>
            <ul className="mt-4 space-y-2 text-xs text-slate-300">
              <li>• Client retains full ownership of their login.</li>
              <li>• Changes apply only after the client accepts your proposal.</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-5 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">Opportunity detection</p>
            <p className="mt-2 leading-relaxed">
              Insurance, CPF, and product opportunity scoring —{" "}
              <span className="font-medium text-slate-800">Opportunity Detection Coming</span>.
            </p>
          </div>
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-5 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">AI insights</p>
            <p className="mt-2 leading-relaxed">
              Narrative briefs and anomaly explanations —{" "}
              <span className="font-medium text-slate-800">AI Insights Coming</span>.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
