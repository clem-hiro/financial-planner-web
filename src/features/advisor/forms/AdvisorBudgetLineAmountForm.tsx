"use client";

import { useActionState } from "react";
import { patchAdvisorClientBudgetLineAmountAction } from "@/server/advisor-client-actions";

const inputClass =
  "w-28 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-right text-sm tabular-nums text-slate-900 shadow-sm outline-none ring-slate-300/40 focus:ring-2";

export function AdvisorBudgetLineAmountForm({
  clientId,
  lineId,
  defaultAmount,
}: {
  clientId: string;
  lineId: string;
  defaultAmount: number;
}) {
  const [state, action, pending] = useActionState(
    patchAdvisorClientBudgetLineAmountAction,
    { error: null as string | null }
  );

  return (
    <form action={action} className="inline-flex flex-col items-end gap-1">
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="id" value={lineId} />
      <input
        name="amount"
        type="number"
        min={0}
        step="0.01"
        defaultValue={defaultAmount}
        className={inputClass}
        disabled={pending}
      />
      {state.error ? (
        <span className="text-xs font-medium text-rose-700">{state.error}</span>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="text-xs font-semibold text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline disabled:opacity-50"
      >
        {pending ? "…" : "Apply"}
      </button>
    </form>
  );
}
