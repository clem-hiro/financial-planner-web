"use client";

import { useActionState } from "react";
import { createGoalAction } from "@/server/actions";

const initial = { error: null as string | null };

type InvestmentOption = { id: string; name: string };

export function GoalForm({ investments }: { investments: InvestmentOption[] }) {
  const [state, formAction] = useActionState(createGoalAction, initial);

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4"
    >
      <h2 className="text-sm font-semibold text-zinc-900">Add goal</h2>
      {state.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-zinc-600">Title</span>
          <input
            name="title"
            type="text"
            required
            className="w-full rounded border border-zinc-300 px-2 py-1.5"
            placeholder="Emergency fund"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-600">Target amount</span>
          <input
            name="target_amount"
            type="number"
            min="0.01"
            step="0.01"
            required
            className="w-full rounded border border-zinc-300 px-2 py-1.5"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-600">Already saved</span>
          <input
            name="current_amount"
            type="number"
            min={0}
            step="0.01"
            defaultValue={0}
            required
            className="w-full rounded border border-zinc-300 px-2 py-1.5"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-600">
            Monthly contribution (this goal)
          </span>
          <input
            name="monthly_contribution"
            type="number"
            min={0}
            step="0.01"
            defaultValue={0}
            required
            className="w-full rounded border border-zinc-300 px-2 py-1.5"
          />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-zinc-600">
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
            className="w-full rounded border border-zinc-300 px-2 py-1.5"
          />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-zinc-600">Target date (optional)</span>
          <input
            name="target_date"
            type="date"
            className="w-full rounded border border-zinc-300 px-2 py-1.5"
          />
        </label>
        <details className="text-sm sm:col-span-2">
          <summary className="cursor-pointer text-zinc-600 hover:text-zinc-900">
            Optional: link to an investment account (legacy)
          </summary>
          <p className="mt-2 text-xs text-zinc-500">
            Progress and time-to-goal use the fields above. Linking does not
            change projections unless you choose to align values manually.
          </p>
          <label className="mt-2 block">
            <span className="mb-1 block text-zinc-600">Linked investment</span>
            <select
              name="linked_investment_id"
              className="w-full rounded border border-zinc-300 px-2 py-1.5"
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
        className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800"
      >
        Save goal
      </button>
    </form>
  );
}
