import Link from "next/link";
import type { DashboardPayload } from "@/data/dashboard";
import type { ProfileRow } from "@/data/supabase/types";
import { RetirementRunwayLedgerChart } from "@/features/dashboard/RetirementRunwayLedgerChart";
import { CpfProjectionByAgeChart } from "@/features/dashboard/CpfProjectionByAgeChart";
import {
  buildCpfRetirementProjection,
  CPF_RA_FORMATION_AGE,
} from "@/domain/finance/cpf-retirement-projection";
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
  const retirementSums =
    currentAge != null
      ? buildCpfRetirementProjection({ currentAge })
      : null;
  const retirementSumTargets = retirementSums
    ? {
        brs: retirementSums.estimatedBrsAt55,
        frs: retirementSums.estimatedFrsAt55,
        ers: retirementSums.estimatedErsAt55,
      }
    : null;
  const raAt55 = payload.cpfProjectionByAge?.find(
    (r) => r.age === CPF_RA_FORMATION_AGE
  )?.ra;
  const frsGap =
    retirementSums != null && raAt55 != null
      ? raAt55 - retirementSums.estimatedFrsAt55
      : null;

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
                    retirementSumTargets={retirementSumTargets}
                    raFormationAge={CPF_RA_FORMATION_AGE}
                  />
                </div>
                {retirementSums ? (
                  <div className="mt-3 space-y-1.5 border-t border-indigo-100/80 pt-3 dark:border-indigo-300/20">
                    <p className="text-xs leading-relaxed text-indigo-900/90 dark:text-indigo-100/85">
                      Est. retirement sums at {CPF_RA_FORMATION_AGE} — BRS{" "}
                      <span className="font-mono font-semibold tabular-nums">
                        {formatCurrency(
                          retirementSums.estimatedBrsAt55,
                          payload.baseCurrency
                        )}
                      </span>
                      {" · "}FRS{" "}
                      <span className="font-mono font-semibold tabular-nums">
                        {formatCurrency(
                          retirementSums.estimatedFrsAt55,
                          payload.baseCurrency
                        )}
                      </span>
                      {" · "}ERS{" "}
                      <span className="font-mono font-semibold tabular-nums">
                        {formatCurrency(
                          retirementSums.estimatedErsAt55,
                          payload.baseCurrency
                        )}
                      </span>
                      {retirementSums.yearsToAge55 > 0 ? (
                        <>
                          {" "}
                          ({retirementSums.yearsToAge55}{" "}
                          {retirementSums.yearsToAge55 === 1 ? "year" : "years"}{" "}
                          out; FRS grown from today&apos;s published figure).
                        </>
                      ) : (
                        <> (using today&apos;s published FRS).</>
                      )}
                    </p>
                    {frsGap != null && raAt55 != null ? (
                      <p className="text-xs leading-relaxed text-indigo-900/80 dark:text-indigo-100/75">
                        Projected RA at {CPF_RA_FORMATION_AGE}:{" "}
                        <span className="font-mono font-semibold tabular-nums">
                          {formatCurrency(raAt55, payload.baseCurrency)}
                        </span>
                        {frsGap >= 0 ? (
                          <>
                            {" "}
                            — about{" "}
                            <span className="font-mono tabular-nums">
                              {formatCurrency(frsGap, payload.baseCurrency)}
                            </span>{" "}
                            above estimated FRS.
                          </>
                        ) : (
                          <>
                            {" "}
                            — about{" "}
                            <span className="font-mono tabular-nums">
                              {formatCurrency(-frsGap, payload.baseCurrency)}
                            </span>{" "}
                            below estimated FRS.
                          </>
                        )}
                      </p>
                    ) : null}
                    <p className="text-[11px] leading-relaxed text-indigo-900/70 dark:text-indigo-100/65">
                      Guides on the chart are illustrative BRS / FRS / ERS
                      targets —{" "}
                      <MethodologyOpenLink
                        topicId="cpf-retirement-projection"
                        className={appInlineLinkClass}
                      >
                        how retirement sums work
                      </MethodologyOpenLink>
                      .
                    </p>
                  </div>
                ) : null}
              </div>
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
