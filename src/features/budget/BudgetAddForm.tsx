"use client";

import { useActionState, useState } from "react";
import { createBudgetLineAction } from "@/server/actions";

const initial = { error: null as string | null };

export function BudgetAddForm({ defaultYear }: { defaultYear: number }) {
  const [state, formAction] = useActionState(createBudgetLineAction, initial);
  const [cadence, setCadence] = useState<"monthly" | "annual">("monthly");

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4"
    >
      <h2 className="text-sm font-semibold text-zinc-900">Add budget line</h2>
      <p className="text-xs text-zinc-500">
        Category names are matched to expenses after trimming and ignoring case.
        For loans with a payoff date, use monthly cadence and set &quot;Last
        month&quot; (inclusive). For a one-off higher month (e.g. birthday), add
        the line then use &quot;This month only&quot; on the budget table.
      </p>
      {state.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-zinc-600">Category</span>
          <input
            name="category"
            type="text"
            required
            className="w-full rounded border border-zinc-300 px-2 py-1.5"
            placeholder="groceries"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-600">Cadence</span>
          <select
            name="cadence"
            required
            className="w-full rounded border border-zinc-300 px-2 py-1.5"
            value={cadence}
            onChange={(e) =>
              setCadence(e.target.value as "monthly" | "annual")
            }
          >
            <option value="monthly">Monthly (repeats every month)</option>
            <option value="annual">Annual (per calendar year)</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-600">Budget amount</span>
          <input
            name="amount"
            type="number"
            min={0}
            step="0.01"
            required
            className="w-full rounded border border-zinc-300 px-2 py-1.5"
          />
        </label>
        {cadence === "monthly" && (
          <>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-zinc-600">
                First month applies (optional)
              </span>
              <input
                name="start_year_month"
                type="month"
                className="w-full max-w-xs rounded border border-zinc-300 px-2 py-1.5"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block text-zinc-600">
                Last month applies / loan payoff (optional, inclusive)
              </span>
              <input
                name="end_year_month"
                type="month"
                className="w-full max-w-xs rounded border border-zinc-300 px-2 py-1.5"
              />
            </label>
          </>
        )}
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-zinc-600">
            Calendar year (annual lines only)
          </span>
          <input
            name="calendar_year"
            type="number"
            min={2000}
            max={2100}
            defaultValue={defaultYear}
            className="w-full rounded border border-zinc-300 px-2 py-1.5"
          />
        </label>
      </div>
      <button
        type="submit"
        className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800"
      >
        Save budget line
      </button>
    </form>
  );
}
