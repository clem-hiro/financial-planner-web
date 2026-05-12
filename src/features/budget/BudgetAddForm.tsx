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
      className="space-y-4 rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm sm:p-5"
    >
      <div>
        <h2 className="text-sm font-semibold text-zinc-900">
          Add a custom line
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-zinc-600">
          Category names match expenses after trimming and ignoring case.
        </p>
      </div>
      {state.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      <input type="hidden" name="cadence" value={cadence} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-xs font-medium text-zinc-600">
            Category
          </span>
          <input
            name="category"
            type="text"
            required
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
            placeholder="e.g. childcare"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-zinc-600">
            Budget amount
          </span>
          <input
            name="amount"
            type="number"
            min={0}
            step="0.01"
            required
            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm"
          />
        </label>
        <div className="text-sm">
          <span className="mb-1 block text-xs font-medium text-zinc-600">
            Repeats
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setCadence("monthly")}
              className={`flex-1 rounded-lg border px-2 py-2 text-xs font-medium ${
                cadence === "monthly"
                  ? "border-teal-600 bg-teal-50 text-teal-950"
                  : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-white"
              }`}
            >
              Every month
            </button>
            <button
              type="button"
              onClick={() => setCadence("annual")}
              className={`flex-1 rounded-lg border px-2 py-2 text-xs font-medium ${
                cadence === "annual"
                  ? "border-teal-600 bg-teal-50 text-teal-950"
                  : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-white"
              }`}
            >
              Once a year
            </button>
          </div>
        </div>
      </div>

      <details className="group rounded-xl border border-zinc-100 bg-zinc-50/50 p-3">
        <summary className="cursor-pointer list-none text-sm font-medium text-zinc-800 [&::-webkit-details-marker]:hidden">
          <span className="mr-1 text-zinc-400 transition group-open:rotate-90">
            ▸
          </span>
          Advanced — schedule, year, loan payoff
        </summary>
        <div className="mt-3 space-y-3 border-t border-zinc-200/80 pt-3 text-sm">
          <p className="text-xs text-zinc-600">
            For loans with a payoff month, set monthly cadence and the last
            applicable month. For a one-off higher month, add the line then use
            &quot;This month only&quot; on that category.
          </p>
          {cadence === "monthly" && (
            <>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs font-medium text-zinc-600">
                  First month applies (optional)
                </span>
                <input
                  name="start_year_month"
                  type="month"
                  className="w-full max-w-xs rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-xs font-medium text-zinc-600">
                  Last month applies / loan payoff (optional, inclusive)
                </span>
                <input
                  name="end_year_month"
                  type="month"
                  className="w-full max-w-xs rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                />
              </label>
            </>
          )}
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-600">
              Calendar year (annual lines only)
            </span>
            <input
              name="calendar_year"
              type="number"
              min={2000}
              max={2100}
              defaultValue={defaultYear}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
            />
          </label>
        </div>
      </details>

      <button
        type="submit"
        className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800"
      >
        Save budget line
      </button>
    </form>
  );
}
