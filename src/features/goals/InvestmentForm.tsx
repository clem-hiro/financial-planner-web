"use client";

import { useActionState } from "react";
import { createInvestmentAction } from "@/server/actions";

const initial = { error: null as string | null };

export function InvestmentForm() {
  const [state, formAction] = useActionState(createInvestmentAction, initial);

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4"
    >
      <h2 className="text-sm font-semibold text-zinc-900">Add account</h2>
      {state.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-zinc-600">Account name</span>
          <input
            name="name"
            type="text"
            required
            className="w-full rounded border border-zinc-300 px-2 py-1.5"
            placeholder="Brokerage / Savings"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-600">Current value</span>
          <input
            name="current_value"
            type="number"
            min={0}
            step="0.01"
            defaultValue={0}
            required
            className="w-full rounded border border-zinc-300 px-2 py-1.5"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-600">Monthly contribution</span>
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
            Expected annual return / interest (decimal, e.g. 0.07 for 7%)
          </span>
          <input
            name="expected_annual_return"
            type="number"
            min={0}
            max={1}
            step="0.001"
            defaultValue={0.07}
            required
            className="w-full rounded border border-zinc-300 px-2 py-1.5"
          />
        </label>
      </div>
      <div className="flex justify-end">
        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Save account
        </button>
      </div>
    </form>
  );
}
