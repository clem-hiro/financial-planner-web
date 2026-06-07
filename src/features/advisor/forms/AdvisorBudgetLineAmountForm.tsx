"use client";

import { useActionState } from "react";
import { useAdvisorProposalRefresh } from "@/features/advisor/use-advisor-proposal-refresh";
import { patchAdvisorClientBudgetLineAmountAction } from "@/server/advisor-client-actions";
import { BlockingSubmitOverlay } from "@/ui/BlockingSubmitOverlay";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-slate-300/40 focus:ring-2";

export function AdvisorBudgetLineAmountForm({
  clientId,
  lineId,
  defaultCategory,
  defaultAmount,
  disabled = false,
}: {
  clientId: string;
  lineId: string;
  defaultCategory: string;
  defaultAmount: number;
  disabled?: boolean;
}) {
  const [state, action, pending] = useActionState(
    patchAdvisorClientBudgetLineAmountAction,
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
      <input type="hidden" name="id" value={lineId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Category</span>
          <input
            name="category"
            type="text"
            required
            defaultValue={defaultCategory}
            className={inputClass}
            disabled={pending || disabled}
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Planned / month</span>
          <input
            name="amount"
            type="number"
            min={0}
            step="0.01"
            required
            defaultValue={defaultAmount}
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
