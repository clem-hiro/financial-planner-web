import Link from "next/link";
import type { DashboardPayload } from "@/data/dashboard";
import type { ProfileRow } from "@/data/supabase/types";
import { AgeCombinedAssetsProjectionChart } from "@/features/dashboard/AgeCombinedAssetsProjectionChart";
import { CpfProjectionByAgeChart } from "@/features/dashboard/CpfProjectionByAgeChart";
import { MethodologyOpenLink } from "@/features/help/MethodologyOpenLink";
import { formatCurrency, formatPercent } from "@/ui/lib/format";
import { appEmeraldPanelClass } from "@/ui/surface-classes";
import { InfoTooltip } from "@/ui/InfoTooltip";
import { appInlineLinkClass } from "@/ui/app-link-styles";

export function DashboardRetirementSection({
  payload,
  profile,
}: {
  payload: DashboardPayload;
  profile: ProfileRow | null;
}) {
  return (
    <div
      className={`${appEmeraldPanelClass} max-w-full p-4 text-emerald-950 sm:p-5 md:p-6`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <h2 className="text-base font-semibold text-emerald-950">
            Projected wealth
          </h2>
          <InfoTooltip
            variant="emerald"
            ariaLabel="Open methodology: retirement projection"
            methodologyTopicId="retirement-fv"
          >
            <span className="sr-only">Open methodology for retirement path</span>
          </InfoTooltip>
        </div>
        <MethodologyOpenLink
          topicId="retirement-fv"
          className="text-xs font-medium text-teal-900 underline decoration-teal-300/60 underline-offset-2 hover:text-teal-950"
        >
          Read more
        </MethodologyOpenLink>
      </div>
      <p className="mt-1 text-[11px] text-emerald-900/80">
        Illustrative only.
      </p>
      {payload.ageProjection ? (
        <>
          {payload.investmentSummary.count === 0 && (
            <p className="mt-2 text-xs text-amber-900">
              You have no investment rows yet — growth is mainly projected cash
              (surplus) minus debts until you add accounts with value and assumptions.
            </p>
          )}
          <div className="mt-3 space-y-2">
            <h3 className="text-sm font-semibold text-emerald-900">
              Combined assets by age
            </h3>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-emerald-200/60 bg-white/85 px-3 py-2 text-xs leading-snug text-emerald-900 shadow-sm">
              <span className="text-emerald-900/95">
                Stacked investments, cash, CPF (same as blue chart), and vehicles; net
                line subtracts <strong>Cash &amp; liabilities</strong> debts only (not
                housing loans).
              </span>
              <InfoTooltip
                variant="emerald"
                ariaLabel="Open methodology: projection"
                methodologyTopicId="retirement-fv"
              >
                <span className="sr-only">Projection methodology</span>
              </InfoTooltip>
              <MethodologyOpenLink
                topicId="retirement-fv"
                className="shrink-0 text-xs font-medium text-emerald-900 underline decoration-emerald-400/60 underline-offset-2"
              >
                Full detail →
              </MethodologyOpenLink>
            </p>
          </div>
          <div className="mt-3">
            <AgeCombinedAssetsProjectionChart
              data={payload.ageProjection.points}
              currency={payload.baseCurrency}
              budgetMonth={payload.month}
            />
          </div>
          {payload.cpfProjectionByAge &&
            payload.cpfProjectionByAge.length > 0 && (
              <div className="mt-5 rounded-lg border border-indigo-200/60 bg-white/60 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-indigo-950">
                    Projected CPF by age (OA / SA / MA)
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
                    className="text-xs font-medium text-indigo-900 underline decoration-indigo-300/60 underline-offset-2"
                  >
                    Assumptions →
                  </MethodologyOpenLink>
                </div>
                <p className="mt-1 text-xs text-indigo-900/85 sm:hidden">
                  One line per bucket + total; dashed markers = housing milestones.
                  Housing OA only if saved under{" "}
                  <Link
                    href="/balances#housing-loans"
                    className={appInlineLinkClass}
                  >
                    Balances → Housing loans
                  </Link>
                  . Full rules: <strong>Assumptions →</strong>
                </p>
                <p className="mt-1 hidden text-xs text-indigo-900/85 sm:block">
                  Separate trend lines per account, plus total. Vertical markers
                  show keys / repayment start from your housing loan rows. Uses
                  gross salary, optional CPFIS, and{" "}
                  <strong>OA for housing</strong> only when you have loan rows
                  under{" "}
                  <Link
                    href="/balances#housing-loans"
                    className={appInlineLinkClass}
                  >
                    Balances → Housing loans
                  </Link>
                  .
                </p>
                {payload.cpfHousingLoanCountInProjection > 0 ? (
                  <>
                    <p className="mt-2 text-xs text-indigo-900/90 sm:hidden">
                      <strong>OA includes your loan(s):</strong> instalment share
                      + OA lumps in the completion month (see methodology).
                    </p>
                    <p className="mt-2 hidden text-xs text-indigo-900/90 sm:block">
                      <strong>Yes — OA here reflects your loan(s):</strong> each
                      month the model subtracts your configured share of the
                      amortized instalment from OA (and any OA downpayment / fees
                      in the completion month). Your spouse&apos;s OA share is not
                      modeled if you set less than 100%.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mt-2 text-xs text-indigo-900/90 sm:hidden">
                      <strong>No housing loan in this run</strong> — add one under{" "}
                      <Link
                        href="/balances#housing-loans"
                        className={appInlineLinkClass}
                      >
                        Balances → Housing loans
                      </Link>{" "}
                      to model OA after instalments.
                    </p>
                    <p className="mt-2 hidden text-xs text-indigo-900/90 sm:block">
                      <strong>No housing loan in this run</strong> — the OA line
                      does not include mortgage payments yet. Add or enable a loan
                      under{" "}
                      <Link
                        href="/balances#housing-loans"
                        className={appInlineLinkClass}
                      >
                        Balances → Housing loans
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
              </div>
            )}
          <div className="mt-3 rounded-md border border-emerald-300/60 bg-white/55 p-4 text-emerald-950 shadow-sm">
            <div className="flex flex-col gap-3 border-b border-emerald-200/70 pb-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-emerald-900">
                  Monthly income at retirement (dividend view)
                </h3>
                <p className="mt-1 text-xs leading-relaxed wrap-break-word text-emerald-900/85">
                  {payload.ageProjection.currentAge >=
                  payload.ageProjection.targetRetirementAge ? (
                    <>
                      Your target retirement age (
                      {payload.ageProjection.targetRetirementAge}) is at or
                      before your current age — the model uses today&apos;s
                      balances only. Simplified net worth:{" "}
                      <span className="font-semibold tabular-nums">
                        {formatCurrency(
                          payload.ageProjection.projectedAtRetirement,
                          payload.baseCurrency
                        )}
                      </span>
                      .
                    </>
                  ) : (
                    <>
                      At age{" "}
                      <span className="font-semibold tabular-nums">
                        {payload.ageProjection.targetRetirementAge}
                      </span>{" "}
                      (
                      {profile?.target_retirement_age != null
                        ? "from your profile"
                        : "default 65 — set in Retirement targets above"}
                      ), this simplified path projects about{" "}
                      <span className="font-semibold tabular-nums">
                        {formatCurrency(
                          payload.ageProjection.projectedAtRetirement,
                          payload.baseCurrency
                        )}
                      </span>{" "}
                      total net worth.
                    </>
                  )}
                </p>
                {payload.ageProjection.cpfBucketsAtTargetRetirement && (
                  <div className="mt-3 rounded-md border border-indigo-200/70 bg-indigo-50/50 px-3 py-2.5 text-xs text-indigo-950">
                    <p className="font-semibold text-indigo-950">
                      Projected CPF at age{" "}
                      {payload.ageProjection.cpfBucketsAtTargetRetirement.age}
                      {payload.ageProjection.currentAge >=
                      payload.ageProjection.targetRetirementAge
                        ? " (you are at or past target — shown for today&apos;s row in the path)"
                        : ""}
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-indigo-900/90">
                      Not withdrawal-ready amounts; rules differ by use.{" "}
                      <strong>OA</strong> is usually what you can direct toward
                      housing first (within limits).
                    </p>
                    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-xs tabular-nums sm:text-[11px]">
                      <dt className="text-indigo-800/90">OA</dt>
                      <dd className="text-right font-semibold text-indigo-950">
                        {formatCurrency(
                          payload.ageProjection.cpfBucketsAtTargetRetirement.oa,
                          payload.baseCurrency
                        )}
                      </dd>
                      <dt className="text-indigo-800/90">SA</dt>
                      <dd className="text-right font-semibold text-indigo-950">
                        {formatCurrency(
                          payload.ageProjection.cpfBucketsAtTargetRetirement.sa,
                          payload.baseCurrency
                        )}
                      </dd>
                      <dt className="text-indigo-800/90">MA</dt>
                      <dd className="text-right font-semibold text-indigo-950">
                        {formatCurrency(
                          payload.ageProjection.cpfBucketsAtTargetRetirement.ma,
                          payload.baseCurrency
                        )}
                      </dd>
                      {payload.ageProjection.cpfBucketsAtTargetRetirement.cpfis >
                        0.5 && (
                        <>
                          <dt className="text-indigo-800/90">CPFIS</dt>
                          <dd className="text-right font-semibold text-indigo-950">
                            {formatCurrency(
                              payload.ageProjection.cpfBucketsAtTargetRetirement
                                .cpfis,
                              payload.baseCurrency
                            )}
                          </dd>
                        </>
                      )}
                      <dt className="border-t border-indigo-200/80 pt-1 font-semibold text-indigo-900">
                        Total
                      </dt>
                      <dd className="border-t border-indigo-200/80 pt-1 text-right font-semibold text-indigo-950">
                        {formatCurrency(
                          payload.ageProjection.cpfBucketsAtTargetRetirement
                            .totalCpf,
                          payload.baseCurrency
                        )}
                      </dd>
                    </dl>
                  </div>
                )}
              </div>
              <Link
                href="/dashboard#retirement-inputs"
                className={`inline-flex min-h-10 shrink-0 items-center text-xs font-medium touch-manipulation ${appInlineLinkClass} sm:min-h-0`}
              >
                Edit targets →
              </Link>
            </div>

            <div className="mt-4 rounded-lg border border-emerald-200/80 bg-emerald-50/40 px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-800/90">
                Estimated passive income from investments
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-emerald-950 sm:text-3xl">
                {formatCurrency(
                  payload.ageProjection.spendCheck.dividendPlan
                    .monthlyDividendIncome,
                  payload.baseCurrency
                )}
                <span className="text-base font-semibold text-emerald-800">
                  {" "}
                  / month
                </span>
              </p>
              <p className="mt-2 text-xs leading-relaxed text-emerald-900/85">
                No salary after retirement in this model. Uses{" "}
                {formatPercent(
                  payload.ageProjection.spendCheck.dividendPlan
                    .dividendYieldAnnual
                )}{" "}
                per year on your{" "}
                <strong>projected investment balance only</strong> (
                {formatCurrency(
                  payload.ageProjection.spendCheck.dividendPlan
                    .projectedInvestmentsAtRetirement,
                  payload.baseCurrency
                )}{" "}
                at that age; cash earns 0% here).
                {profile?.retirement_dividend_yield_annual != null &&
                String(profile.retirement_dividend_yield_annual).trim() !== ""
                  ? " Yield comes from your profile."
                  : " Yield defaults to 2% until you save one in your profile."}
              </p>
            </div>

            {payload.ageProjection.spendCheck.dividendPlan.monthlySpendGoal !=
              null &&
            payload.ageProjection.spendCheck.dividendPlan.monthlySpendGoal >
              0 && (
              <div className="mt-3 space-y-2 text-sm text-emerald-950">
                <p>
                  <span className="text-emerald-900/80">Your spend goal:</span>{" "}
                  <span className="font-semibold tabular-nums">
                    {formatCurrency(
                      payload.ageProjection.spendCheck.dividendPlan
                        .monthlySpendGoal,
                      payload.baseCurrency
                    )}
                    /month
                  </span>
                  {payload.ageProjection.spendCheck.dividendPlan
                    .requiredInvestedForDividendGoal != null && (
                    <>
                      {" "}
                      <span className="text-emerald-900/80">
                        · Invested balance needed for dividends alone to match
                        goal (rough):{" "}
                      </span>
                      <span className="font-semibold tabular-nums">
                        {formatCurrency(
                          payload.ageProjection.spendCheck.dividendPlan
                            .requiredInvestedForDividendGoal,
                          payload.baseCurrency
                        )}
                      </span>
                    </>
                  )}
                </p>
                {payload.ageProjection.spendCheck.dividendPlan
                  .dividendsCoverGoal ? (
                  <p className="text-xs text-emerald-800">
                    Dividends meet or exceed that goal in this simplified model.
                    Yields are nominal; inflation and extra tax on withdrawals or
                    dividends aren&apos;t calculated here—log tax outflows as
                    expenses if you want them in spend and surplus.
                  </p>
                ) : (
                  <div className="space-y-1">
                    <p className="font-medium text-amber-950">
                      Gap from cash (after dividends): about{" "}
                      {formatCurrency(
                        payload.ageProjection.spendCheck.dividendPlan
                          .monthlyCashSupplementNeeded ?? 0,
                        payload.baseCurrency
                      )}
                      /month
                    </p>
                    {payload.ageProjection.spendCheck.dividendPlan
                      .cashRunwayMonthsAtSupplement != null && (
                      <p className="text-xs text-emerald-900/90">
                        Today&apos;s cash (
                        {formatCurrency(
                          payload.ageProjection.spendCheck.dividendPlan
                            .currentCashTotal,
                          payload.baseCurrency
                        )}
                        ) could cover ~{" "}
                        {Math.floor(
                          payload.ageProjection.spendCheck.dividendPlan
                            .cashRunwayMonthsAtSupplement
                        )}{" "}
                        months of that extra draw if nothing else changed.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {(!payload.ageProjection.spendCheck.dividendPlan.monthlySpendGoal ||
              payload.ageProjection.spendCheck.dividendPlan.monthlySpendGoal <=
                0) && (
              <p className="mt-3 text-xs text-emerald-900">
                Add a <strong>monthly spend in retirement</strong> in{" "}
                <Link
                  href="/dashboard#retirement-inputs"
                  className={appInlineLinkClass}
                >
                  Retirement targets
                </Link>{" "}
                to compare this dividend estimate to the lifestyle you want.
              </p>
            )}
          </div>

          <details className="mt-3 overflow-x-auto rounded-md border border-emerald-200/80 bg-white/60 p-3 text-emerald-950">
            <summary className="cursor-pointer text-sm font-medium text-emerald-900 hover:underline">
              Net worth by age (table)
            </summary>
            <p className="mt-2 text-xs leading-relaxed text-emerald-900/90">
              Same numbers as the chart: investments (growing), cash (balances +
              monthly surplus × months + vehicle proceeds when modeled), vehicles, CPF
              when projected, debts subtracted in the Net column.
            </p>
            <table className="mt-3 min-w-full text-left text-xs">
              <thead>
                <tr className="border-b border-emerald-200 bg-emerald-100/50">
                  <th className="sticky left-0 bg-emerald-100/95 px-2 py-2 font-medium">
                    <span className="inline-flex items-center gap-1">
                      Age
                      <InfoTooltip
                        variant="emerald"
                        ariaLabel="Open methodology: projection"
                        methodologyTopicId="retirement-fv"
                      >
                        <span className="sr-only">Age rows</span>
                      </InfoTooltip>
                    </span>
                  </th>
                  <th className="px-2 py-2 font-medium text-right">Inv.</th>
                  <th className="px-2 py-2 font-medium text-right">Cash</th>
                  <th className="px-2 py-2 font-medium text-right">CPF</th>
                  <th className="px-2 py-2 font-medium text-right">Veh.</th>
                  <th className="px-2 py-2 font-medium text-right text-rose-800">
                    Debts
                  </th>
                  <th className="px-2 py-2 font-medium text-right">
                    <span className="inline-flex items-center gap-1">
                      Net
                      <InfoTooltip
                        variant="emerald"
                        ariaLabel="Net after debts"
                        methodologyTopicId="retirement-fv"
                      >
                        <span className="sr-only">Net column</span>
                      </InfoTooltip>
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {payload.ageProjection.points.map((row) => (
                  <tr
                    key={row.age}
                    className="border-b border-emerald-100/80 last:border-0"
                  >
                    <td className="sticky left-0 bg-white/90 px-2 py-1.5 font-medium backdrop-blur-sm">
                      {row.age}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {formatCurrency(row.investments, payload.baseCurrency)}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {formatCurrency(row.cash, payload.baseCurrency)}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {formatCurrency(row.cpf, payload.baseCurrency)}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {formatCurrency(row.vehiclesNet, payload.baseCurrency)}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-rose-800">
                      −{formatCurrency(row.liabilities, payload.baseCurrency)}
                    </td>
                    <td className="px-2 py-1.5 text-right font-medium tabular-nums">
                      {formatCurrency(row.value, payload.baseCurrency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      ) : (
        <p className="mt-2 text-sm text-emerald-900">
          Set your <strong>birth date</strong> in{" "}
          <Link
            href="/dashboard#retirement-inputs"
            className={appInlineLinkClass}
          >
            Income &amp; retirement → Retirement targets
          </Link>{" "}
          to see projected net worth by age and monthly dividend estimates.
        </p>
      )}
    </div>
  );
}
