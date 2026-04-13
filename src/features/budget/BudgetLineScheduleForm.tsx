"use client";

import { useActionState } from "react";
import { updateBudgetLineScheduleAction } from "@/server/actions";

const initial = { error: null as string | null };

export function BudgetLineScheduleForm({
  lineId,
  startYearMonth,
  endYearMonth,
}: {
  lineId: string;
  startYearMonth: string | null | undefined;
  endYearMonth: string | null | undefined;
}) {
  const [state, formAction] = useActionState(
    updateBudgetLineScheduleAction,
    initial
  );

  return (
    <form
      action={formAction}
      className="mt-2 flex flex-col gap-2 border-t border-zinc-100 pt-2 text-xs sm:flex-row sm:flex-wrap sm:items-end"
    >
      <input type="hidden" name="id" value={lineId} />
      <label className="flex flex-col gap-0.5">
        <span className="text-zinc-500">First month (optional)</span>
        <input
          name="start_year_month"
          type="month"
          defaultValue={startYearMonth ?? ""}
          className="rounded border border-zinc-300 px-1 py-0.5"
        />
      </label>
      <label className="flex flex-col gap-0.5">
        <span className="text-zinc-500">Last month / payoff (optional)</span>
        <input
          name="end_year_month"
          type="month"
          defaultValue={endYearMonth ?? ""}
          className="rounded border border-zinc-300 px-1 py-0.5"
        />
      </label>
      <button
        type="submit"
        className="rounded border border-zinc-300 px-2 py-1 font-medium text-zinc-800 hover:bg-zinc-50"
      >
        Save schedule
      </button>
      {state.error && (
        <span className="text-red-600" role="alert">
          {state.error}
        </span>
      )}
    </form>
  );
}
