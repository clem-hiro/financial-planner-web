"use client";

import { useRouter } from "next/navigation";
import { useActionState, useMemo, useRef, useState } from "react";
import { createAdvisorClientInvestmentAction } from "@/server/advisor-client-actions";
import { createInvestmentAction } from "@/server/actions";
import { InvestmentAssumptionBanner } from "@/features/goals/InvestmentAssumptionBanner";
import {
  InvestmentContributionScheduleFields,
  type ContributionMode,
  type FixedScheduleMode,
} from "@/features/goals/InvestmentContributionScheduleFields";
import { InvestmentPlanGuidancePanel } from "@/features/goals/InvestmentPlanGuidancePanel";
import type { InvestmentPlanningContext } from "@/features/goals/InvestmentBalancesList";
import { ageCompletedOnDate } from "@/domain/finance";
import type { InvestmentPlanNature } from "@/lib/investment-plan-nature";
import { BlockingSubmitOverlay } from "@/ui/BlockingSubmitOverlay";
import {
  fpInputClass,
  fpInputNarrowClass,
  fpPrimaryButtonClass,
} from "@/ui/input-classes";

const initial = { error: null as string | null };

function nonNegative(raw: string): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function percentDecimal(raw: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n)) / 100;
}

function yearsUntilDate(isoDate: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const target = new Date(`${isoDate}T12:00:00.000Z`);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date();
  const months =
    (target.getFullYear() - today.getFullYear()) * 12 +
    (target.getMonth() - today.getMonth()) -
    (target.getDate() < today.getDate() ? 1 : 0);
  return Math.max(0, months) / 12;
}

function ilpMaturityAge(
  currentAge: number | null,
  startDateRaw: string,
  durationYearsRaw: string
): number | null {
  if (currentAge == null) return null;
  const duration = nonNegative(durationYearsRaw);
  const startOffset = yearsUntilDate(startDateRaw);
  if (duration == null || duration <= 0 || startOffset == null) return null;
  return currentAge + startOffset + duration;
}

export function InvestmentForm(
  props: {
    advisorClientId?: string;
    advisorSuggestionDisabled?: boolean;
    showAssumptionBanner?: boolean;
    planningContext?: InvestmentPlanningContext | null;
  } = {}
) {
  const {
    advisorClientId,
    advisorSuggestionDisabled = false,
    showAssumptionBanner = true,
    planningContext = null,
  } = props;
  const router = useRouter();
  const submitLockRef = useRef(false);
  const saveAction = advisorClientId
    ? createAdvisorClientInvestmentAction
    : createInvestmentAction;
  const wrapped = async (
    prev: typeof initial,
    fd: FormData
  ): Promise<typeof initial> => {
    if (submitLockRef.current) return prev;
    submitLockRef.current = true;
    try {
      const res = await saveAction(prev, fd);
      if (res.error === null) router.refresh();
      return res;
    } finally {
      submitLockRef.current = false;
    }
  };
  const [state, formAction, pending] = useActionState(wrapped, initial);
  const [planNature, setPlanNature] = useState<InvestmentPlanNature | "">("");
  const [name, setName] = useState("");
  const [currentValueRaw, setCurrentValueRaw] = useState("0");
  const [monthlyRaw, setMonthlyRaw] = useState("0");
  const [returnPctRaw, setReturnPctRaw] = useState("7");
  const [incomeRatePctRaw, setIncomeRatePctRaw] = useState("0");
  const [contributionGrowthRaw, setContributionGrowthRaw] = useState("0");
  const [withdrawalAnnualRaw, setWithdrawalAnnualRaw] = useState("0");
  const [withdrawalStartRaw, setWithdrawalStartRaw] = useState("");
  const [contributionMode, setContributionMode] =
    useState<ContributionMode>("until_retirement");
  const [fixedScheduleMode, setFixedScheduleMode] =
    useState<FixedScheduleMode>("duration_years");
  const [durationYearsRaw, setDurationYearsRaw] = useState("15");
  const [startDateRaw, setStartDateRaw] = useState("");
  const [endDateRaw, setEndDateRaw] = useState("");
  const currentAge =
    planningContext != null
      ? ageCompletedOnDate(planningContext.birthDate, new Date())
      : null;
  const withdrawalStartName =
    currentAge != null ? "withdrawal_start_age" : "withdrawal_start_years";
  const maturityAge = useMemo(
    () => ilpMaturityAge(currentAge, startDateRaw, durationYearsRaw),
    [currentAge, startDateRaw, durationYearsRaw]
  );
  const withdrawalAnnual = nonNegative(withdrawalAnnualRaw) ?? 0;
  const withdrawalStart = nonNegative(withdrawalStartRaw);
  const withdrawalStartBeforeMaturity =
    planNature === "includes_insurance_coverage" &&
    withdrawalAnnual > 0 &&
    maturityAge != null &&
    withdrawalStart != null &&
    currentAge != null &&
    withdrawalStart < maturityAge;
  const planComplete = planNature !== "";
  const basicsComplete =
    planComplete &&
    name.trim() !== "" &&
    nonNegative(currentValueRaw) != null &&
    nonNegative(monthlyRaw) != null;
  const scheduleComplete =
    basicsComplete &&
    (planNature === "includes_insurance_coverage"
      ? startDateRaw !== "" && (nonNegative(durationYearsRaw) ?? 0) > 0
      : contributionMode === "until_retirement" ||
        (fixedScheduleMode === "duration_years"
          ? (nonNegative(durationYearsRaw) ?? 0) > 0
          : endDateRaw !== ""));
  const returnsComplete =
    scheduleComplete &&
    nonNegative(returnPctRaw) != null &&
    nonNegative(incomeRatePctRaw) != null;
  const formReady = returnsComplete && !withdrawalStartBeforeMaturity;
  const expectedReturnDecimal = percentDecimal(returnPctRaw);
  const incomeRateDecimal = percentDecimal(incomeRatePctRaw);

  const fieldClass = `${fpInputClass} mt-1`;

  const handlePlanNatureChange = (value: InvestmentPlanNature | "") => {
    setPlanNature(value);
    if (value === "includes_insurance_coverage") {
      setContributionMode("fixed_duration");
      setFixedScheduleMode("duration_years");
    }
  };

  return (
    <>
      <BlockingSubmitOverlay active={pending} message="Saving account..." />
      <form
        action={formAction}
        {...(pending ? { inert: true } : {})}
        className="space-y-4"
      >
        {advisorClientId ? (
          <input type="hidden" name="client_id" value={advisorClientId} />
        ) : null}
        {showAssumptionBanner ? (
          <InvestmentAssumptionBanner className="mb-1" />
        ) : null}
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Add an account</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Capture investment value, premiums, growth, cash income, and future
            withdrawal timing in one account.
          </p>
        </div>

        <details open className="rounded-xl border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer select-none text-sm font-medium text-slate-800">
            Plan type
          </summary>
          <div className="mt-3">
            <InvestmentPlanGuidancePanel
              planNature={planNature}
              onPlanNatureChange={handlePlanNatureChange}
            />
          </div>
        </details>

        {state.error ? (
          <p className="text-sm text-red-600" role="alert">
            {typeof state.error === "string"
              ? state.error
              : "Could not save this account."}
          </p>
        ) : null}

        <details
          open={planComplete}
          className="rounded-xl border border-slate-200 bg-white p-4"
        >
          <summary className="cursor-pointer select-none text-sm font-medium text-slate-800">
            Account basics
          </summary>
          <fieldset disabled={!planComplete} className="mt-3 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-slate-800">
                What is this?
              </span>
              <input
                name="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={fieldClass}
                placeholder="e.g. Brokerage, SRS, endowment, ILP"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-800">
              Current balance
              </span>
              <input
                name="current_value"
                type="number"
                min={0}
                step="0.01"
                value={currentValueRaw}
                onChange={(e) => setCurrentValueRaw(e.target.value)}
                required
                className={fieldClass}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-800">
                Monthly contribution
              </span>
              <input
                name="monthly_contribution"
                type="number"
                min={0}
                step="0.01"
                value={monthlyRaw}
                onChange={(e) => setMonthlyRaw(e.target.value)}
                required
                className={fieldClass}
              />
            </label>
          </fieldset>
        </details>

        <details
          open={basicsComplete}
          className="rounded-xl border border-slate-200 bg-white p-4"
        >
          <summary className="cursor-pointer select-none text-sm font-medium text-slate-800">
            Contribution schedule
          </summary>
          <fieldset disabled={!basicsComplete} className="mt-3">
            <InvestmentContributionScheduleFields
              planNature={planNature}
              contributionMode={contributionMode}
              onContributionModeChange={setContributionMode}
              fixedScheduleMode={fixedScheduleMode}
              onFixedScheduleModeChange={setFixedScheduleMode}
              durationYearsRaw={durationYearsRaw}
              onDurationYearsChange={setDurationYearsRaw}
              startDateRaw={startDateRaw}
              onStartDateChange={setStartDateRaw}
              endDateRaw={endDateRaw}
              onEndDateChange={setEndDateRaw}
              inputClassName={fieldClass}
            />
          </fieldset>
        </details>

        <details
          open={scheduleComplete}
          className="rounded-xl border border-slate-200 bg-white p-4"
        >
          <summary className="cursor-pointer select-none text-sm font-medium text-slate-800">
            Growth and income
          </summary>
          <fieldset
            disabled={!scheduleComplete}
            className="mt-3 grid gap-4 sm:grid-cols-2"
          >
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-800">
                Expected yearly growth
              </span>
              <div className="relative max-w-40">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  value={returnPctRaw}
                  onChange={(e) => setReturnPctRaw(e.target.value)}
                  required
                  className={`${fpInputNarrowClass} mt-1 pr-10`}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-medium text-slate-400">
                  %
                </span>
              </div>
              <input
                type="hidden"
                name="expected_annual_return"
                value={expectedReturnDecimal.toString()}
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-800">
                {planNature === "includes_insurance_coverage"
                  ? "Post-maturity income rate"
                  : "Expected dividend yield"}
              </span>
              <div className="relative max-w-40">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  value={incomeRatePctRaw}
                  onChange={(e) => setIncomeRatePctRaw(e.target.value)}
                  className={`${fpInputNarrowClass} mt-1 pr-10`}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-medium text-slate-400">
                  %
                </span>
              </div>
              <input
                type="hidden"
                name="investment_income_rate_annual"
                value={incomeRateDecimal.toString()}
              />
              <span className="mt-1 block text-[11px] text-slate-500">
                Counted as cash inflow in December; asset growth stays in the
                investment balance.
              </span>
            </label>
          </fieldset>
        </details>

        <details
          open={returnsComplete}
          className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-3 py-2 text-xs text-slate-600"
        >
          <summary className="cursor-pointer select-none font-medium text-slate-700">
            Advanced planning
          </summary>
          <fieldset
            disabled={!returnsComplete}
            className="mt-3 grid gap-3 sm:grid-cols-3"
          >
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">
                Annual contribution step-up
              </span>
              <input
                name="contribution_growth_annual"
                type="number"
                min={0}
                max={1}
                step="0.001"
                value={contributionGrowthRaw}
                onChange={(e) => setContributionGrowthRaw(e.target.value)}
                className={fieldClass}
              />
              <span className="mt-1 block text-[11px] text-slate-500">
                Decimal format, e.g. 0.03 for 3% yearly.
              </span>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">
                Yearly withdrawal
              </span>
              <input
                name="withdrawal_annual"
                type="number"
                min={0}
                step="0.01"
                value={withdrawalAnnualRaw}
                onChange={(e) => setWithdrawalAnnualRaw(e.target.value)}
                className={fieldClass}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">
                {currentAge != null ? "Withdrawal starts at age" : "Withdrawal starts after"}
              </span>
              {currentAge != null ? (
                <input
                  type="hidden"
                  name="withdrawal_current_age"
                  value={currentAge}
                />
              ) : null}
              <input
                name={withdrawalStartName}
                type="number"
                min={0}
                max={currentAge != null ? 120 : 100}
                step={0.25}
                placeholder={
                  maturityAge != null
                    ? maturityAge.toFixed(1)
                    : currentAge != null
                      ? String(planningContext?.targetRetirementAge ?? 65)
                      : "Years from today"
                }
                value={withdrawalStartRaw}
                onChange={(e) => setWithdrawalStartRaw(e.target.value)}
                className={fieldClass}
              />
              {withdrawalStartBeforeMaturity ? (
                <span className="mt-1 block text-[11px] font-medium text-red-600">
                  ILP yearly withdrawal cannot start before plan maturity.
                </span>
              ) : (
                <span className="mt-1 block text-[11px] text-slate-500">
                  Blank starts at maturity for ILP withdrawals.
                </span>
              )}
            </label>
          </fieldset>
        </details>

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={pending || advisorSuggestionDisabled || !formReady}
            className={`${fpPrimaryButtonClass} disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {pending ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </>
  );
}
