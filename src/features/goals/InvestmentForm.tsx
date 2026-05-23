"use client";

import { useRouter } from "next/navigation";
import { useActionState, useRef, useState } from "react";
import { createAdvisorClientInvestmentAction } from "@/server/advisor-client-actions";
import { createInvestmentAction } from "@/server/actions";
import { InvestmentAssumptionBanner } from "@/features/goals/InvestmentAssumptionBanner";
import { BlockingSubmitOverlay } from "@/ui/BlockingSubmitOverlay";

const initial = { error: null as string | null };

export function InvestmentForm(
  props: { advisorClientId?: string; advisorSuggestionDisabled?: boolean } = {}
) {
  const { advisorClientId, advisorSuggestionDisabled = false } = props;
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
  const [contributionMode, setContributionMode] = useState<
    "until_retirement" | "fixed_duration"
  >("until_retirement");

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
          Capture how much you invest today, what you add each month, and how long
          those monthly deposits continue. Growth can keep running after contributions
          stop—closer to real policies and plans.
        </p>
      </div>
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

      <fieldset className="rounded-xl border border-slate-200 bg-white p-4">
        <legend className="text-sm font-medium text-slate-800">
          How long will you contribute monthly?
        </legend>
        <p className="mt-1 text-xs text-slate-500">
          After this phase, we still grow what you already built—we only stop adding new
          monthly deposits.
        </p>
        <div className="mt-3 space-y-2.5">
          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-700">
            <input
              type="radio"
              name="contribution_type"
              value="until_retirement"
              className="mt-0.5"
              checked={contributionMode === "until_retirement"}
              onChange={() => setContributionMode("until_retirement")}
            />
            <span>
              <span className="font-medium text-slate-900">Until retirement</span>
              <span className="mt-0.5 block text-xs font-normal text-slate-500">
                Uses your profile retirement age when set; otherwise the full projection
                window.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-700">
            <input
              type="radio"
              name="contribution_type"
              value="fixed_duration"
              className="mt-0.5"
              checked={contributionMode === "fixed_duration"}
              onChange={() => setContributionMode("fixed_duration")}
            />
            <span>
              <span className="font-medium text-slate-900">Fixed duration</span>
              <span className="mt-0.5 block text-xs font-normal text-slate-500">
                For plans that stop premiums after a set period (e.g. education plans,
                some ILPs or endowments).
              </span>
            </span>
          </label>
        </div>
        {contributionMode === "fixed_duration" ? (
          <label className="mt-4 block text-sm">
            <span className="mb-1 block font-medium text-slate-800">
              Contribution duration (years)
            </span>
            <input
              name="contribution_duration_years"
              type="number"
              min={0.25}
              max={80}
              step={0.25}
              required={contributionMode === "fixed_duration"}
              className="mt-1 w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums text-slate-900 shadow-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/25"
            />
          </label>
        ) : null}
      </fieldset>

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
              Withdrawal starts after
            </span>
            <input
              name="withdrawal_start_years"
              type="number"
              min={0}
              max={100}
              step={0.25}
              placeholder="Retirement age"
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums text-slate-900 shadow-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/25"
            />
            <span className="mt-1 block text-[11px] text-slate-500">
              Years from today. Blank uses profile retirement age when available.
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
