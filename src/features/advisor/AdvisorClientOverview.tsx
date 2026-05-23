import Link from "next/link";
import type { DashboardPayload } from "@/data/dashboard";
import { num } from "@/data/mappers";
import type { BudgetLineRow, FinancialGoalRow, InvestmentRow } from "@/data/supabase/types";
import type { ProfileRow } from "@/data/supabase/types";
import { advisorClientWorkspaceSignals } from "@/domain/finance/advisor-client-health";
import { AdvisorBadge, AdvisorComingSoonPanel, AdvisorSection } from "@/features/advisor/advisor-workspace-primitives";
import { AdvisorClientHeader } from "@/features/advisor/AdvisorClientHeader";
import { AdvisorConsentRequired } from "@/features/advisor/AdvisorConsentRequired";
import { DashboardRetirementSection } from "@/features/dashboard/DashboardRetirementSection";
import { ProposalProjectionCompare } from "@/features/proposals/ProposalProjectionCompare";
import { DEFAULT_BASE_CURRENCY } from "@/lib/currency";
import { CollapsiblePane, CollapsiblePaneRail } from "@/ui/CollapsiblePaneRail";
import { formatCurrency } from "@/ui/lib/format";

/** Read-only analysis surface. Authoring lives on `?view=compose`; the
 * "Compose proposal" button on the projection toggle row is the entry point. */
export function AdvisorClientOverview({
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
  draftChangeCount,
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
  draftChangeCount: number;
}) {
  if (!consentGranted) {
    return <AdvisorConsentRequired profile={profile} />;
  }

  const currency = profile.base_currency ?? DEFAULT_BASE_CURRENCY;
  const signals = advisorClientWorkspaceSignals(profile, payload);
  const monthlyBudgetLines = budgetLines.filter((b) => b.cadence === "monthly");

  const composeHref = `/advisor/client/${clientId}?view=compose`;
  const composeButton = (
    <Link
      href={composeHref}
      scroll={false}
      className="inline-flex shrink-0 items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
    >
      Compose proposal
    </Link>
  );

  return (
    <div className="space-y-8 lg:space-y-10">
      <AdvisorClientHeader profile={profile} payload={payload} month={month} />

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start xl:gap-10">
        <div className="space-y-8">
          <AdvisorSection
            id="projection"
            eyebrow="Projection"
            title="Retirement & net-worth outlook"
            description="Toggle between the client's current plan and the projection with their draft proposal applied."
            aside={
              hasOverlay ? (
                <AdvisorBadge tone="positive">Proposal preview</AdvisorBadge>
              ) : undefined
            }
          >
            <ProposalProjectionCompare
              hasOverlay={hasOverlay}
              action={composeButton}
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
                <p className="mt-2 text-sm font-semibold text-slate-800">Work in Progress</p>
                <p className="mt-1 text-xs text-slate-500">Rules engine coming soon.</p>
              </div>
            </div>
          </AdvisorSection>

          <AdvisorSection
            id="goals"
            title="Goals & priorities"
            description="Planned monthly contributions for this client. Compose a proposal to suggest changes."
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
                        <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                          {formatCurrency(num(g.monthly_contribution), currency)}
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
            description="Monthly cadence lines for the active profile. Compose a proposal to suggest changes."
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
                        <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                          {formatCurrency(num(line.amount), currency)}
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
          </AdvisorSection>

          <AdvisorSection
            id="investments"
            title="Investments & savings"
            description="Client investment accounts. Compose a proposal to add, edit, or remove accounts."
          >
            {investments.length === 0 ? (
              <p className="text-sm text-slate-600">No investment accounts.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50/90 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Account</th>
                      <th className="px-4 py-3 text-right">Current value</th>
                      <th className="px-4 py-3 text-right">Monthly</th>
                      <th className="px-4 py-3 text-right">Return</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {investments.map((inv) => (
                      <tr key={inv.id} className="text-slate-800">
                        <td className="px-4 py-3 font-medium text-slate-900">{inv.name}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                          {formatCurrency(num(inv.current_value), currency)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                          {formatCurrency(num(inv.monthly_contribution), currency)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                          {(num(inv.expected_annual_return) * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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

        <CollapsiblePaneRail>
          {draftChangeCount > 0 ? (
            <CollapsiblePane title="Draft in progress" defaultOpen>
              <p className="text-sm leading-relaxed text-slate-600">
                {draftChangeCount} suggested {draftChangeCount === 1 ? "change" : "changes"}{" "}
                queued.{" "}
                <Link href={composeHref} scroll={false} className="font-semibold text-slate-900 underline decoration-slate-300/80 underline-offset-2 transition-colors hover:text-emerald-800 hover:decoration-emerald-300/70">
                  Continue composing →
                </Link>
              </p>
            </CollapsiblePane>
          ) : null}
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
    </div>
  );
}
