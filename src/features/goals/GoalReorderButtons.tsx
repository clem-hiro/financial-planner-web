"use client";

import { useActionState } from "react";
import { reorderFinancialGoalAction } from "@/server/actions";
import { BlockingSubmitOverlay } from "@/ui/BlockingSubmitOverlay";

const initial = { error: null as string | null };

export function GoalReorderButtons({
  goalId,
  canMoveUp,
  canMoveDown,
}: {
  goalId: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    reorderFinancialGoalAction,
    initial
  );

  if (!canMoveUp && !canMoveDown) return null;

  return (
    <div className="flex flex-wrap items-center gap-1">
      <BlockingSubmitOverlay active={pending} message="Updating priority…" />
      {state.error ? (
        <span className="w-full text-xs text-red-600" role="alert">
          {state.error}
        </span>
      ) : null}
      {canMoveUp ? (
        <form action={formAction} className="inline">
          <input type="hidden" name="goal_id" value={goalId} />
          <input type="hidden" name="direction" value="up" />
          <button
            type="submit"
            disabled={pending}
            className="rounded border border-zinc-200 bg-white px-2 py-0.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            aria-label="Raise priority"
          >
            ↑ Higher
          </button>
        </form>
      ) : null}
      {canMoveDown ? (
        <form action={formAction} className="inline">
          <input type="hidden" name="goal_id" value={goalId} />
          <input type="hidden" name="direction" value="down" />
          <button
            type="submit"
            disabled={pending}
            className="rounded border border-zinc-200 bg-white px-2 py-0.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            aria-label="Lower priority"
          >
            ↓ Lower
          </button>
        </form>
      ) : null}
    </div>
  );
}
