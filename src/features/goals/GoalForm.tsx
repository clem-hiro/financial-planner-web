"use client";

import { useActionState } from "react";
import { createGoalAction } from "@/server/actions";
import { BlockingSubmitOverlay } from "@/ui/BlockingSubmitOverlay";
import { fpInputClass, fpPrimaryButtonClass, fpSelectClass } from "@/ui/input-classes";

const initial = { error: null as string | null };

type InvestmentOption = { id: string; name: string };

export function GoalForm({ investments }: { investments: InvestmentOption[] }) {
  const [state, formAction, pending] = useActionState(createGoalAction, initial);

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-slate-700/80 dark:bg-slate-900"
      {...(pending ? { inert: true } : {})}
    >
      <BlockingSubmitOverlay active={pending} message="Saving goal…" />
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-slate-50">Add goal</h2>
      {state.error && (
        <p className="text-sm text-red-600 dark:text-red-200" role="alert">
          {state.error}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-zinc-600 dark:text-slate-200">Title</span>
          <input
            name="title"
            type="text"
            required
            className={`${fpInputClass} max-w-none`}
            placeholder="Emergency fund"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-600 dark:text-slate-200">Target amount</span>
          <input
            name="target_amount"
            type="number"
            min="0.01"
            step="0.01"
            required
            className={`${fpInputClass} max-w-none`}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-600 dark:text-slate-200">Already saved</span>
          <input
            name="current_amount"
            type="number"
            min={0}
            step="0.01"
            defaultValue={0}
            required
            className={`${fpInputClass} max-w-none`}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-600 dark:text-slate-200">
            Monthly contribution (this goal)
          </span>
          <input
            name="monthly_contribution"
            type="number"
            min={0}
            step="0.01"
            defaultValue={0}
            required
            className={`${fpInputClass} max-w-none`}
          />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-zinc-600 dark:text-slate-200">
            Expected annual return (decimal, e.g. 0.07 for 7%; 0 = cash)
          </span>
          <input
            name="expected_annual_return"
            type="number"
            min={0}
            max={1}
            step="0.001"
            defaultValue={0}
            required
            className={`${fpInputClass} max-w-none`}
          />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-zinc-600 dark:text-slate-200">Target date (optional)</span>
          <input
            name="target_date"
            type="date"
            className={`${fpInputClass} max-w-none`}
          />
        </label>
        <details className="text-sm sm:col-span-2">
          <summary className="cursor-pointer text-zinc-600 hover:text-zinc-900 dark:text-slate-300 dark:hover:text-slate-50">
            Optional: link to an investment account (legacy)
          </summary>
          <p className="mt-2 text-xs text-zinc-500 dark:text-slate-400">
            Progress and time-to-goal use the fields above. Linking does not
            change projections unless you choose to align values manually.
          </p>
          <label className="mt-2 block">
            <span className="mb-1 block text-zinc-600 dark:text-slate-200">Linked investment</span>
            <select
              name="linked_investment_id"
              className={`${fpSelectClass} max-w-none`}
              defaultValue=""
            >
              <option value="">None</option>
              {investments.map((inv) => (
                <option key={inv.id} value={inv.id}>
                  {inv.name}
                </option>
              ))}
            </select>
          </label>
        </details>
      </div>
      <button
        type="submit"
        disabled={pending}
        className={fpPrimaryButtonClass}
      >
        {pending ? "Saving…" : "Save goal"}
      </button>
    </form>
  );
}
