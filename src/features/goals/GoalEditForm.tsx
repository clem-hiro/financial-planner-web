"use client";

import { useActionState } from "react";
import { updateGoalAction } from "@/server/actions";
import { BlockingSubmitOverlay } from "@/ui/BlockingSubmitOverlay";

const initial = { error: null as string | null };

type InvestmentOption = { id: string; name: string };

type GoalFields = {
  id: string;
  title: string;
  target_amount: string;
  current_amount: string;
  monthly_contribution: string;
  expected_annual_return: string;
  target_date: string | null;
  linked_investment_id: string | null;
};

export function GoalEditForm({
  goal,
  investments,
}: {
  goal: GoalFields;
  investments: InvestmentOption[];
}) {
  const [state, formAction, pending] = useActionState(updateGoalAction, initial);

  return (
    <form
      action={formAction}
      className="mt-3 space-y-3 rounded border border-zinc-100 bg-zinc-50 p-3"
      {...(pending ? { inert: true } : {})}
    >
      <BlockingSubmitOverlay active={pending} message="Saving goal…" />
      <input type="hidden" name="goal_id" value={goal.id} />
      {state.error && (
        <p className="text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs sm:col-span-2">
          <span className="mb-0.5 block text-zinc-600">Title</span>
          <input
            name="title"
            type="text"
            required
            defaultValue={goal.title}
            className="w-full rounded border border-zinc-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs">
          <span className="mb-0.5 block text-zinc-600">Target</span>
          <input
            name="target_amount"
            type="number"
            min="0.01"
            step="0.01"
            required
            defaultValue={goal.target_amount}
            className="w-full rounded border border-zinc-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs">
          <span className="mb-0.5 block text-zinc-600">Saved</span>
          <input
            name="current_amount"
            type="number"
            min={0}
            step="0.01"
            required
            defaultValue={goal.current_amount}
            className="w-full rounded border border-zinc-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs">
          <span className="mb-0.5 block text-zinc-600">Monthly</span>
          <input
            name="monthly_contribution"
            type="number"
            min={0}
            step="0.01"
            required
            defaultValue={goal.monthly_contribution}
            className="w-full rounded border border-zinc-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs sm:col-span-2">
          <span className="mb-0.5 block text-zinc-600">
            Expected return (0–1, e.g. 0.07)
          </span>
          <input
            name="expected_annual_return"
            type="number"
            min={0}
            max={1}
            step="0.001"
            required
            defaultValue={goal.expected_annual_return}
            className="w-full rounded border border-zinc-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs sm:col-span-2">
          <span className="mb-0.5 block text-zinc-600">Target date</span>
          <input
            name="target_date"
            type="date"
            defaultValue={goal.target_date ?? ""}
            className="w-full rounded border border-zinc-300 px-2 py-1 text-sm"
          />
        </label>
        <label className="text-xs sm:col-span-2">
          <span className="mb-0.5 block text-zinc-600">
            Linked investment (optional)
          </span>
          <select
            name="linked_investment_id"
            className="w-full rounded border border-zinc-300 px-2 py-1 text-sm"
            defaultValue={goal.linked_investment_id ?? ""}
          >
            <option value="">None</option>
            {investments.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-zinc-800 px-2 py-1 text-xs font-medium text-white hover:bg-zinc-700"
      >
        {pending ? "Saving…" : "Update goal"}
      </button>
    </form>
  );
}
