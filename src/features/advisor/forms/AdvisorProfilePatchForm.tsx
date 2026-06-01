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
    savings_target_monthly: string;
    fixed_expenses_monthly: string;
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
