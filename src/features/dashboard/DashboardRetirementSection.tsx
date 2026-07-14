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
import { InfoTooltip } from "@/ui/InfoTooltip";
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
        Illustrative only.
      </p>
      {payload.ageProjection ? (
        <>
          {payload.investmentSummary.count === 0 && (
            <p className="mt-2 text-xs text-amber-900 dark:text-amber-200">
              You have no investment rows yet — growth is mainly projected cash
              (surplus) minus debts until you add accounts with value and assumptions.
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
                    Projected CPF by age (OA / SA / MA / RA)
                  </h3>
                  {payload.cpfHousingLoanCountInProjection > 0 ? (
                    <span
                      className="inline-flex items-center rounded-full bg-indigo-600 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm"
                      title="OA balance in this projection is reduced by your saved housing loan rules (lumps + your instalment share)."
                    >
                      Mortgage from OA included
                    </span>
                  ) : null}
                  <InfoTooltip
                    variant="zinc"
                    ariaLabel="Open methodology: CPF projection"
                    methodologyTopicId="cpf-projection"
                  >
                    <span className="sr-only">CPF projection methodology</span>
                  </InfoTooltip>
                  <MethodologyOpenLink
                    topicId="cpf-projection"
                    className="text-xs font-medium text-indigo-900 underline decoration-indigo-300/60 underline-offset-2 dark:text-indigo-200 dark:decoration-indigo-300/40"
                  >
                    Assumptions →
                  </MethodologyOpenLink>
                </div>
                {payload.cpfYearEndProjection ? (
                  <p className="mt-1 text-xs text-indigo-900/90 dark:text-indigo-100/85">
                    Projected{" "}
                    {formatYearMonthLong(payload.cpfYearEndProjection.targetYearMonth)}{" "}
                    total:{" "}
                    <span className="font-mono font-semibold tabular-nums">
                      {formatCurrency(
                        payload.cpfYearEndProjection.totalCpf,
                        payload.baseCurrency
                      )}
                    </span>
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-indigo-900/85 dark:text-indigo-100/80 sm:hidden">
                  One line per bucket + total; dashed markers = housing milestones.
                  Housing OA only if saved under{" "}
                  <Link
                    href="/setup?tab=housing"
                    className={appInlineLinkClass}
                  >
                    Setup → Housing
                  </Link>
                  . Full rules: <strong>Assumptions →</strong>
                </p>
                <p className="mt-1 hidden text-xs text-indigo-900/85 dark:text-indigo-100/80 sm:block">
                  Separate trend lines per account, plus total. Vertical markers
                  show keys / repayment start from your housing loan rows. Uses
                  gross salary, CPF Investments, and{" "}
                  <strong>OA for housing</strong> only when you have loan rows
                  under{" "}
                  <Link
                    href="/setup?tab=housing"
                    className={appInlineLinkClass}
                  >
                    Setup → Housing
                  </Link>
                  .
                </p>
                {payload.cpfHousingLoanCountInProjection > 0 ? (
                  <>
                    <p className="mt-2 text-xs text-indigo-900/90 dark:text-indigo-100/85 sm:hidden">
                      <strong>OA includes your loan(s):</strong> instalment share
                      + OA lumps in the completion month (see methodology).
                    </p>
                    <p className="mt-2 hidden text-xs text-indigo-900/90 dark:text-indigo-100/85 sm:block">
                      <strong>Yes — OA here reflects your loan(s):</strong> each
                      month the model subtracts your configured share of the
                      amortized instalment from OA (and any OA downpayment / fees
                      in the completion month). Your spouse&apos;s OA share is not
                      modeled if you set less than 100%.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-xs text-indigo-900/90 dark:text-indigo-100/85 sm:hidden">
                      <strong>No housing loan in this run</strong> — add one under{" "}
                      <Link
                        href="/setup?tab=housing"
                        className={appInlineLinkClass}
                      >
                        Setup → Housing
                      </Link>{" "}
                      to model OA after instalments.
                    </p>
                    <p className="mt-2 hidden text-xs text-indigo-900/90 dark:text-indigo-100/85 sm:block">
                      <strong>No housing loan in this run</strong> — the OA line
                      does not include mortgage payments yet. Add or enable a loan
                      under{" "}
                      <Link
                        href="/setup?tab=housing"
                        className={appInlineLinkClass}
                      >
                        Setup → Housing
                      </Link>{" "}
                      to project OA after CPF-funded instalments.
                    </p>
                  </>
                )}
                <div className="mt-2 h-56 min-h-[200px] sm:h-72 sm:min-h-0">
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
