"use client";

import { useActionState } from "react";
import { useAdvisorProposalRefresh } from "@/features/advisor/use-advisor-proposal-refresh";
import { patchAdvisorClientProfileAction } from "@/server/advisor-client-actions";
import { BlockingSubmitOverlay } from "@/ui/BlockingSubmitOverlay";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-slate-300/40 focus:ring-2";

export function AdvisorProfilePatchForm({
  clientId,
  defaults,
  disabled = false,
}: {
  clientId: string;
  disabled?: boolean;
  defaults: {
    display_name: string;
    monthly_income: string;
    monthly_gross_salary: string;
    annual_salary_growth_percent: string;
    savings_target_monthly: string;
    fixed_expenses_monthly: string;
    expense_growth_percent: string;
    target_retirement_age: string;
    retirement_monthly_spend_goal: string;
    retirement_dividend_yield_percent: string;
    retirement_withdrawal_rate_percent: string;
  };
}) {
  const [state, action, pending] = useActionState(patchAdvisorClientProfileAction, {
    error: null as string | null,
    proposalRecorded: undefined as boolean | undefined,
  });

  useAdvisorProposalRefresh(state.proposalRecorded, state.error);

  return (
    <form
      action={action}
      className="space-y-4"
      {...(pending ? { inert: true } : {})}
    >
      <BlockingSubmitOverlay active={pending} message="Recording suggestion…" />
      <input type="hidden" name="client_id" value={clientId} />
      {state.error ? (
        <p className="text-sm font-medium text-rose-700" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Display name</span>
          <input
            className={inputClass}
            name="display_name"
            defaultValue={defaults.display_name}
            autoComplete="off"
            disabled={pending || disabled}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Monthly income (take-home)</span>
          <input
            className={inputClass}
            name="monthly_income"
            type="number"
            min={0}
            step="0.01"
            defaultValue={defaults.monthly_income}
            disabled={pending || disabled}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Monthly gross salary</span>
          <input
            className={inputClass}
            name="monthly_gross_salary"
            type="number"
            min={0}
            step="0.01"
            defaultValue={defaults.monthly_gross_salary}
            disabled={pending || disabled}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">
            Annual salary growth (%)
          </span>
          <input
            className={inputClass}
            name="annual_salary_growth_percent"
            type="number"
            min={0}
            max={25}
            step="0.1"
            defaultValue={defaults.annual_salary_growth_percent}
            disabled={pending || disabled}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Monthly savings target</span>
          <input
            className={inputClass}
            name="savings_target_monthly"
            type="number"
            min={0}
            step="0.01"
            defaultValue={defaults.savings_target_monthly}
            disabled={pending || disabled}
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="font-medium text-slate-700">Fixed expenses (monthly)</span>
          <input
            className={inputClass}
            name="fixed_expenses_monthly"
            type="number"
            min={0}
            step="0.01"
            defaultValue={defaults.fixed_expenses_monthly}
            disabled={pending || disabled}
          />
        </label>
      </div>
      <div className="grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-slate-700">
            Target retirement age
          </span>
          <input
            className={inputClass}
            name="target_retirement_age"
            type="number"
            min={50}
            max={80}
            step={1}
            defaultValue={defaults.target_retirement_age}
            disabled={pending || disabled}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">
            Monthly retirement spend
          </span>
          <input
            className={inputClass}
            name="retirement_monthly_spend_goal"
            type="number"
            min={0}
            max={1_000_000}
            step="0.01"
            defaultValue={defaults.retirement_monthly_spend_goal}
            disabled={pending || disabled}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">
            Expense growth (%)
          </span>
          <input
            className={inputClass}
            name="expense_growth_percent"
            type="number"
            min={0}
            max={25}
            step="0.1"
            defaultValue={defaults.expense_growth_percent}
            disabled={pending || disabled}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">
            Dividend yield (%)
          </span>
          <input
            className={inputClass}
            name="retirement_dividend_yield_percent"
            type="number"
            min={0}
            max={25}
            step="0.1"
            defaultValue={defaults.retirement_dividend_yield_percent}
            disabled={pending || disabled}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">
            Withdrawal rate (%)
          </span>
          <input
            className={inputClass}
            name="retirement_withdrawal_rate_percent"
            type="number"
            min={0}
            max={20}
            step="0.1"
            defaultValue={defaults.retirement_withdrawal_rate_percent}
            disabled={pending || disabled}
          />
        </label>
      </div>
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending || disabled}
          className="inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
