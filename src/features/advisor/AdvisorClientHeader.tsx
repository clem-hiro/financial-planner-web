import type { DashboardPayload } from "@/data/dashboard";
import type { ProfileRow } from "@/data/supabase/types";
import { advisorClientWorkspaceSignals } from "@/domain/finance/advisor-client-health";
import { AdvisorBadge } from "@/features/advisor/advisor-workspace-primitives";
import { DEFAULT_BASE_CURRENCY } from "@/lib/currency";
import { formatCurrency } from "@/ui/lib/format";

function onboardingLabel(profile: ProfileRow) {
  if (profile.onboarding_completed_at) return "Complete";
  if (profile.onboarding_required) return "In progress";
  return "—";
}

/** Client summary header + risk/signal badges + metric grid. Shared by the
 * read-only Overview and the editable Compose surfaces. */
export function AdvisorClientHeader({
  profile,
  payload,
  month,
}: {
  profile: ProfileRow;
  payload: DashboardPayload;
  month: string;
}) {
  const currency = profile.base_currency ?? DEFAULT_BASE_CURRENCY;
  const signals = advisorClientWorkspaceSignals(profile, payload);

  return (
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
  );
}
