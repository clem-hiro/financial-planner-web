"use client";

import { useActionState } from "react";
import { useAdvisorProposalRefresh } from "@/features/advisor/use-advisor-proposal-refresh";
import { patchAdvisorClientGoalMonthlyContributionAction } from "@/server/advisor-client-actions";
import { BlockingSubmitOverlay } from "@/ui/BlockingSubmitOverlay";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-slate-300/40 focus:ring-2";

export function AdvisorGoalContributionForm({
  clientId,
  goalId,
  defaultTitle,
  defaultTargetAmount,
  defaultMonthly,
  disabled = false,
}: {
  clientId: string;
  goalId: string;
  defaultTitle: string;
  defaultTargetAmount: number;
  defaultMonthly: number;
  disabled?: boolean;
}) {
  const [state, action, pending] = useActionState(
    patchAdvisorClientGoalMonthlyContributionAction,
    { error: null as string | null, proposalRecorded: undefined as boolean | undefined }
  );

  useAdvisorProposalRefresh(state.proposalRecorded, state.error);

  return (
    <form
      action={action}
      className="space-y-3"
      {...(pending ? { inert: true } : {})}
    >
      <BlockingSubmitOverlay active={pending} message="Recording suggestion…" />
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="goal_id" value={goalId} />
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm sm:col-span-3">
          <span className="font-medium text-slate-700">Goal name</span>
          <input
            name="title"
            type="text"
            required
            defaultValue={defaultTitle}
            className={inputClass}
            disabled={pending || disabled}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Target amount</span>
          <input
            name="target_amount"
            type="number"
            min={0}
            step="0.01"
            required
            defaultValue={defaultTargetAmount}
            className={inputClass}
            disabled={pending || disabled}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Monthly contribution</span>
          <input
            name="monthly_contribution"
            type="number"
            min={0}
            step="0.01"
            required
            defaultValue={defaultMonthly}
            className={inputClass}
            disabled={pending || disabled}
          />
        </label>
      </div>
      {state.error ? (
        <p className="text-xs font-medium text-rose-700" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending || disabled}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
