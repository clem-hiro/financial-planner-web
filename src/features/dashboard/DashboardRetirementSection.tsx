import Link from "next/link";
import type { DashboardPayload } from "@/data/dashboard";
import type { ProfileRow } from "@/data/supabase/types";
import { RetirementRunwayLedgerChart } from "@/features/dashboard/RetirementRunwayLedgerChart";
import { CpfProjectionByAgeChart } from "@/features/dashboard/CpfProjectionByAgeChart";
import { CpfRetirementProjectionPanel } from "@/features/dashboard/CpfRetirementProjectionPanel";
import { CPF_RA_FORMATION_AGE } from "@/domain/finance/cpf-retirement-projection";
import { formatYearMonthLong } from "@/lib/dates";
import { MethodologyOpenLink } from "@/features/help/MethodologyOpenLink";
import { formatCurrency } from "@/ui/lib/format";
import { appEmeraldPanelClass } from "@/ui/surface-classes";
import { appInlineLinkClass } from "@/ui/app-link-styles";

function CpfProjectionMissingInputsBanner({
  payload,
}: {
  payload: DashboardPayload;
}) {
  if (payload.cpfProjectionMissingInputs.length === 0) return null;

  return (
    <div className="mt-5 rounded-lg border border-amber-300/70 bg-amber-50/80 p-3 text-xs text-amber-950 dark:border-amber-300/45 dark:bg-amber-950/45 dark:text-amber-100">
      <h3 className="text-sm font-semibold text-amber-950 dark:text-amber-50">
        Complete CPF projection inputs
      </h3>
      <p className="mt-1 leading-relaxed">
        Add the missing information below before showing contribution-based CPF
        projection.
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-4">
        {payload.cpfProjectionMissingInputs.map((item) => (
          <li key={item.label}>
            <Link href={item.href} className={appInlineLinkClass}>
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DashboardRetirementSection({
  payload,
  profile,
}: {
  payload: DashboardPayload;
  profile: ProfileRow | null;
}) {
  const birthRaw = profile?.birth_date;
  const currentAge =
    birthRaw && typeof birthRaw === "string"
      ? payload.ageProjection?.currentAge ?? null
      : null;
  const cpfAt55Row = payload.cpfProjectionByAge?.find(
    (r) => r.age === CPF_RA_FORMATION_AGE
  );
  const cpfAtAge55 = payload.cpfRaBeforeAt55
    ? payload.cpfRaBeforeAt55
    : cpfAt55Row
      ? { oa: cpfAt55Row.oa, sa: cpfAt55Row.sa }
      : null;
  const hasCpfBalances =
    cpfAtAge55 != null &&
    (cpfAtAge55.oa > 0 || cpfAtAge55.sa > 0 || (payload.cpfProjectionByAge?.length ?? 0) > 0);

  return (
    <div
      className={`${appEmeraldPanelClass} max-w-full p-4 text-emerald-950 dark:text-emerald-100 sm:p-5 md:p-6`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-emerald-950 dark:text-emerald-50">
          Projected wealth
        </h2>
        <MethodologyOpenLink
          topicId="retirement-fv"
          className="text-xs font-medium text-teal-900 underline decoration-teal-300/60 underline-offset-2 hover:text-teal-950 dark:text-teal-200 dark:decoration-teal-300/40 dark:hover:text-teal-100"
        >
          Read more
        </MethodologyOpenLink>
      </div>
      <p className="mt-1 text-[11px] text-emerald-900/80 dark:text-emerald-100/70">
        Illustrative only — not advice.
      </p>
      {payload.ageProjection ? (
        <>
          {payload.investmentSummary.count === 0 && (
            <p className="mt-2 text-xs text-amber-900 dark:text-amber-200">
              You haven&apos;t added any investment accounts yet, so this growth is
              mainly your projected monthly surplus building up as cash minus what
              you owe — it gets more personalised once you add accounts with
              balances and growth assumptions.
            </p>
          )}
          <div className="mt-3">
            <RetirementRunwayLedgerChart
              data={payload.ageProjection.points}
              cashReserveData={payload.ageProjection.cashReservePoints}
              currency={payload.baseCurrency}
            />
          </div>
          <CpfProjectionMissingInputsBanner payload={payload} />
          {payload.cpfProjectionByAge &&
            payload.cpfProjectionByAge.length > 0 && (
              <div className="mt-5 rounded-lg border border-indigo-200/60 bg-white/60 p-3 dark:border-indigo-300/35 dark:bg-slate-950/75">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-indigo-950 dark:text-indigo-50">
                    Projected CPF by age
                  </h3>
                  {payload.cpfHousingLoanCountInProjection > 0 ? (
                    <span
                      className="inline-flex items-center rounded-full bg-indigo-600 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm"
                      title="OA balance in this projection is reduced by your saved housing loan rules (lumps + your instalment share)."
                    >
                      Mortgage from OA included
                    </span>
                  ) : null}
                  <MethodologyOpenLink
                    topicId="cpf-projection"
                    className="ml-auto text-xs font-medium text-indigo-900 underline decoration-indigo-300/60 underline-offset-2 dark:text-indigo-200 dark:decoration-indigo-300/40"
                  >
                    Assumptions →
                  </MethodologyOpenLink>
                </div>
                {payload.cpfYearEndProjection ? (
                  <p className="mt-1 text-xs text-indigo-900/90 dark:text-indigo-100/85">
                    {formatYearMonthLong(payload.cpfYearEndProjection.targetYearMonth)}{" "}
                    total{" "}
                    <span className="font-mono font-semibold tabular-nums">
                      {formatCurrency(
                        payload.cpfYearEndProjection.totalCpf,
                        payload.baseCurrency
                      )}
                    </span>
                  </p>
                ) : null}
                {payload.cpfHousingLoanCountInProjection === 0 ? (
                  <p className="mt-1 text-xs text-indigo-900/80 dark:text-indigo-100/75">
                    No housing loan —{" "}
                    <Link
                      href="/setup?tab=housing"
                      className={appInlineLinkClass}
                    >
                      add under Housing
                    </Link>{" "}
                    to model OA repayments.
                  </p>
                ) : null}
                <div className="mt-3 h-56 min-h-[200px] sm:h-72 sm:min-h-0">
                  <CpfProjectionByAgeChart
                    data={payload.cpfProjectionByAge}
                    currency={payload.baseCurrency}
                    markers={payload.cpfHousingMarkers}
                  />
                </div>
                <CpfRetirementProjectionPanel
                  currency={payload.baseCurrency}
                  currentAge={currentAge}
                  cpfAtAge55={cpfAtAge55}
                  hasCpfBalances={hasCpfBalances}
                />
              </div>
            )}
          {payload.ageProjection &&
            (!payload.cpfProjectionByAge ||
              payload.cpfProjectionByAge.length === 0) && (
              <CpfRetirementProjectionPanel
                currency={payload.baseCurrency}
                currentAge={currentAge}
                cpfAtAge55={cpfAtAge55}
                hasCpfBalances={hasCpfBalances}
              />
            )}
        </>
      ) : (
        <>
          <CpfProjectionMissingInputsBanner payload={payload} />
          <p className="mt-2 text-sm text-emerald-900 dark:text-emerald-100">
            Set your <strong>birth date</strong> in{" "}
            <Link
              href="/setup?tab=profile#profile-assumptions"
              className={appInlineLinkClass}
            >
              Setup
            </Link>{" "}
            to see projected wealth by age and CPF along the path.
          </p>
        </>
      )}
    </div>
  );
}
