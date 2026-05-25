"use client";

import { useRouter } from "next/navigation";
import { useActionState, useRef, useState } from "react";
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

const initial = { error: null as string | null };

export function InvestmentForm(
  props: {
    advisorClientId?: string;
    advisorSuggestionDisabled?: boolean;
    planningContext?: InvestmentPlanningContext | null;
  } = {}
) {
  const {
    advisorClientId,
    advisorSuggestionDisabled = false,
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

  const fieldClass =
    "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/25";

  return (
    <>
      <BlockingSubmitOverlay active={pending} message="Saving account…" />
      <form
        action={formAction}
        {...(pending ? { inert: true } : {})}
        className="space-y-5"
      >
      {advisorClientId ? (
        <input type="hidden" name="client_id" value={advisorClientId} />
      ) : null}
      <InvestmentAssumptionBanner className="mb-1" />
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Add an account</h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Capture fund value, monthly premiums or contributions, and when they stop.
          ILPs (e.g. PruVantage) belong here for wealth projections—use the question
          below if the plan also includes insurance cover.
        </p>
      </div>

      <InvestmentPlanGuidancePanel
        planNature={planNature}
        onPlanNatureChange={setPlanNature}
      />
      {state.error ? (
        <p className="text-sm text-red-600" role="alert">
          {typeof state.error === "string"
            ? state.error
            : "Could not save this account."}
        </p>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-800">What is this?</span>
          <input
            name="name"
            type="text"
            required
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-emerald-500/0 transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/25"
            placeholder="e.g. Brokerage, SRS, endowment, ILP"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm sm:col-span-1">
          <span className="mb-1 block font-medium text-slate-800">
            Current invested amount
          </span>
          <input
            name="current_value"
            type="number"
            min={0}
            step="0.01"
            defaultValue={0}
            required
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums text-slate-900 shadow-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/25"
          />
        </label>
        <label className="block text-sm sm:col-span-1">
          <span className="mb-1 block font-medium text-slate-800">
            Monthly contribution
          </span>
          <input
            name="monthly_contribution"
            type="number"
            min={0}
            step="0.01"
            defaultValue={0}
            required
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums text-slate-900 shadow-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/25"
          />
        </label>
      </div>

      <InvestmentContributionScheduleFields
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

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-800">
          Expected yearly growth
        </span>
        <span className="mb-1 block text-xs text-slate-500">
          Long-run nominal return as a decimal (e.g. <code className="text-slate-700">0.07</code>{" "}
          for 7%). Used for illustrations only.
        </span>
        <input
          name="expected_annual_return"
          type="number"
          min={0}
          max={1}
          step="0.001"
          defaultValue={0.07}
          required
          className="mt-1 w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums text-slate-900 shadow-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/25"
        />
      </label>

      <details className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-600">
        <summary className="cursor-pointer select-none font-medium text-slate-700">
          Advanced planning
        </summary>
        <p className="mt-2 leading-relaxed">
          Optional planning assumptions for step-up savings plans and future drawdown.
          Leave blank or zero when this account has a flat contribution path.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
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
              defaultValue={0}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums text-slate-900 shadow-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/25"
            />
            <span className="mt-1 block text-[11px] text-slate-500">
              Decimal format, e.g. 0.03 for 3% yearly.
            </span>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">
              Monthly withdrawal
            </span>
            <input
              name="withdrawal_monthly"
              type="number"
              min={0}
              step="0.01"
              defaultValue={0}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums text-slate-900 shadow-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/25"
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
                currentAge != null
                  ? String(planningContext?.targetRetirementAge ?? 65)
                  : "Years from today"
              }
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums text-slate-900 shadow-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/25"
            />
            <span className="mt-1 block text-[11px] text-slate-500">
              {currentAge != null
                ? "Age. Blank uses profile retirement age when available."
                : "Years from today. Blank uses profile retirement age when available."}
            </span>
          </label>
        </div>
      </details>

      <div className="flex justify-end pt-1">
        <button
          type="submit"
          disabled={pending || advisorSuggestionDisabled}
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Saving…" : advisorClientId ? "Suggest account" : "Save account"}
        </button>
      </div>
    </form>
    </>
  );
}
