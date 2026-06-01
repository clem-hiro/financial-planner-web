"use client";

import { useActionState, useEffect, useRef } from "react";
import { useAdvisorProposalRefresh } from "@/features/advisor/use-advisor-proposal-refresh";
import { createAdvisorClientGoalAction } from "@/server/advisor-client-actions";
import { BlockingSubmitOverlay } from "@/ui/BlockingSubmitOverlay";

const inputClass =
  "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none ring-slate-300/40 focus:ring-2";

export function AdvisorNewGoalForm({
  clientId,
  disabled = false,
}: {
  clientId: string;
  disabled?: boolean;
}) {
  const [state, action, pending] = useActionState(createAdvisorClientGoalAction, {
    error: null as string | null,
    proposalRecorded: undefined as boolean | undefined,
  });
  const formRef = useRef<HTMLFormElement>(null);
  useAdvisorProposalRefresh(state.proposalRecorded, state.error);
  useEffect(() => {
    if (state.proposalRecorded && !state.error) formRef.current?.reset();
  }, [state.proposalRecorded, state.error]);

  return (
    <form
      ref={formRef}
      action={action}
      className="space-y-3"
      {...(pending ? { inert: true } : {})}
    >
      <BlockingSubmitOverlay active={pending} message="Recording suggestion…" />
      <input type="hidden" name="client_id" value={clientId} />
      <p className="text-sm font-semibold text-slate-900">Suggest a new goal</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-sm sm:col-span-3">
          <span className="font-medium text-slate-700">Goal name</span>
          <input
            name="title"
            type="text"
            required
            placeholder="e.g. House down payment"
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
