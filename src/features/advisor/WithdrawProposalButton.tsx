"use client";

import { useActionState, useState } from "react";
import { withdrawAdvisorProposalAction } from "@/server/advisor-proposal-actions";

/**
 * Per-row withdraw. Mirrors the `ProposalReviewView` reject button
 * (`useActionState` + `<form action>` + hidden `proposal_id`), with an
 * inline two-click confirm (no modal): first click arms, second click
 * submits; blur disarms. On a returned error the confirm button stays
 * armed (one-click retry) with the message shown beneath. On success the
 * server action revalidates the page, so the row re-renders. Sits in its
 * own `relative z-10` cell so it stays clickable above the row's
 * stretched navigation link. Only rendered for `draft|pending`.
 */
export function WithdrawProposalButton({ proposalId }: { proposalId: string }) {
  const [state, action, pending] = useActionState(
    withdrawAdvisorProposalAction,
    { error: null as string | null }
  );
  const [armed, setArmed] = useState(false);

  return (
    <div className="relative z-10 inline-flex flex-col items-end gap-1">
      <form action={action}>
        <input type="hidden" name="proposal_id" value={proposalId} />
        {armed ? (
          <button
            type="submit"
            disabled={pending}
            onBlur={() => setArmed(false)}
            className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-800 transition hover:bg-rose-100 disabled:opacity-50"
          >
            {pending ? "Withdrawing…" : "Confirm withdraw"}
          </button>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() => setArmed(true)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Withdraw
          </button>
        )}
      </form>
      {state.error ? (
        <span className="text-[11px] font-medium text-rose-700" role="alert">
          {state.error}
        </span>
      ) : null}
    </div>
  );
}
