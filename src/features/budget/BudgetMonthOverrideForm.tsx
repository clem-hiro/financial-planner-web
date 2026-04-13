"use client";

import { useActionState } from "react";
import {
  clearBudgetMonthOverrideAction,
  setBudgetMonthOverrideAction,
} from "@/server/actions";

const initial = { error: null as string | null };

export function BudgetMonthOverrideForm({
  lineId,
  yearMonth,
  baseAmount,
  overrideAmount,
}: {
  lineId: string;
  yearMonth: string;
  baseAmount: number;
  overrideAmount?: number;
}) {
  const [state, formAction] = useActionState(
    setBudgetMonthOverrideAction,
    initial
  );
  const hasOverride = overrideAmount !== undefined;

  return (
    <div className="mt-2 border-t border-zinc-100 pt-2 text-xs text-zinc-600">
      <span className="font-medium text-zinc-700">This month only:</span>{" "}
      replace planned budget for <code className="rounded bg-zinc-100 px-1">{yearMonth}</code>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <form action={formAction} className="flex flex-wrap items-center gap-1">
          <input type="hidden" name="budget_line_id" value={lineId} />
          <input type="hidden" name="year_month" value={yearMonth} />
          <input
            name="amount"
            type="number"
            min={0}
            step="0.01"
            required
            defaultValue={hasOverride ? overrideAmount : baseAmount}
            className="w-24 rounded border border-zinc-300 px-1 py-0.5"
          />
          <button
            type="submit"
            className="rounded border border-zinc-300 px-2 py-0.5 font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Set override
          </button>
        </form>
        {hasOverride && (
          <form action={clearBudgetMonthOverrideAction}>
            <input type="hidden" name="budget_line_id" value={lineId} />
            <input type="hidden" name="year_month" value={yearMonth} />
            <button
              type="submit"
              className="text-red-600 hover:underline"
            >
              Clear override
            </button>
          </form>
        )}
        {state.error && (
          <span className="text-red-600" role="alert">
            {state.error}
          </span>
        )}
      </div>
    </div>
  );
}
