"use client";

import { useActionState } from "react";
import { useAdvisorProposalRefresh } from "@/features/advisor/use-advisor-proposal-refresh";
import { patchAdvisorClientGoalMonthlyContributionAction } from "@/server/advisor-client-actions";
import { BlockingSubmitOverlay } from "@/ui/BlockingSubmitOverlay";

const inputClass =
  "w-28 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-right text-sm tabular-nums text-slate-900 shadow-sm outline-none ring-slate-300/40 focus:ring-2";

export function AdvisorGoalContributionForm({
  clientId,
  goalId,
  defaultMonthly,
  disabled = false,
}: {
  clientId: string;
  goalId: string;
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
      className="inline-flex flex-col items-end gap-1"
      {...(pending ? { inert: true } : {})}
    >
      <BlockingSubmitOverlay active={pending} message="Recording suggestion…" />
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="goal_id" value={goalId} />
      <input
        name="monthly_contribution"
        type="number"
        min={0}
        step="0.01"
        defaultValue={defaultMonthly}
        className={inputClass}
        disabled={pending || disabled}
      />
      {state.error ? (
        <span className="text-xs font-medium text-rose-700">{state.error}</span>
      ) : null}
      <button
        type="submit"
        disabled={pending || disabled}
        className="text-xs font-semibold text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
