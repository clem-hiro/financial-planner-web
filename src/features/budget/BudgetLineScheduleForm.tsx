"use client";

import { useActionState } from "react";
import { updateBudgetLineScheduleAction } from "@/server/actions";
import { fpInputNarrowClass, fpSecondaryButtonCompactClass } from "@/ui/input-classes";
import { BlockingSubmitOverlay } from "@/ui/BlockingSubmitOverlay";

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
  const [state, formAction, pending] = useActionState(
    updateBudgetLineScheduleAction,
    initial
  );

  return (
    <form
      action={formAction}
      className="mt-2 flex flex-col gap-2 border-t border-slate-100 pt-2 text-xs dark:border-slate-800 sm:flex-row sm:flex-wrap sm:items-end"
      {...(pending ? { inert: true } : {})}
    >
      <BlockingSubmitOverlay active={pending} message="Saving schedule…" />
      <input type="hidden" name="id" value={lineId} />
      <label className="flex flex-col gap-0.5">
        <span className="text-slate-500 dark:text-slate-400">First month (optional)</span>
        <input
          name="start_year_month"
          type="month"
          defaultValue={startYearMonth ?? ""}
          className={fpInputNarrowClass}
        />
      </label>
      <label className="flex flex-col gap-0.5">
        <span className="text-slate-500 dark:text-slate-400">Last month / payoff (optional)</span>
        <input
          name="end_year_month"
          type="month"
          defaultValue={endYearMonth ?? ""}
          className={fpInputNarrowClass}
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className={fpSecondaryButtonCompactClass}
      >
        {pending ? "Saving…" : "Save schedule"}
      </button>
      {state.error && (
        <span className="text-red-600" role="alert">
          {state.error}
        </span>
      )}
    </form>
  );
}
