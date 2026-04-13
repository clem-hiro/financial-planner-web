"use client";

import { useActionState } from "react";
import { updateBudgetLineAmountAction } from "@/server/actions";

const initial = { error: null as string | null };

export function BudgetUpdateAmountForm({
  id,
  amount,
}: {
  id: string;
  amount: number;
}) {
  const [state, formAction] = useActionState(
    updateBudgetLineAmountAction,
    initial
  );

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <input
        name="amount"
        type="number"
        min={0}
        step="0.01"
        defaultValue={amount}
        required
        className="w-28 rounded border border-zinc-300 px-2 py-1 text-sm"
      />
      <button
        type="submit"
        className="rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
      >
        Update
      </button>
      {state.error && (
        <span className="text-xs text-red-600">{state.error}</span>
      )}
    </form>
  );
}
