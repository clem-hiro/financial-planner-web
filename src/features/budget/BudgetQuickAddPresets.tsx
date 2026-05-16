"use client";

import { useActionState, useMemo, useState } from "react";
import { createBudgetLineAction } from "@/server/actions";
import {
  BUDGET_QUICK_PRESETS,
  suggestedMonthlyForPreset,
  type BudgetQuickPreset,
} from "@/features/budget/budget-quick-presets";
import { formatCurrency } from "@/ui/lib/format";
import { BlockingSubmitOverlay } from "@/ui/BlockingSubmitOverlay";

const initial = { error: null as string | null };

type Props = {
  defaultCalendarYear: number;
  monthlyIncome: number | null;
  currency: string;
};

export function BudgetQuickAddPresets({
  defaultCalendarYear,
  monthlyIncome,
  currency,
}: Props) {
  const [state, formAction, pending] = useActionState(createBudgetLineAction, initial);
  const [draft, setDraft] = useState<BudgetQuickPreset | null>(null);
  const suggested = useMemo(
    () => (draft ? suggestedMonthlyForPreset(draft, monthlyIncome) : 0),
    [draft, monthlyIncome]
  );

  return (
    <div className="rounded-2xl border border-zinc-200/90 bg-white/90 p-4 shadow-sm sm:p-5">
      <h3 className="text-sm font-semibold text-zinc-900">
        Quick add a category
      </h3>
      <p className="mt-1 text-xs leading-relaxed text-zinc-600">
        Tap a starter — we prefill a sensible amount you can edit before saving.
        Perfect when you do not have exact numbers yet.
      </p>

      {state.error && (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {BUDGET_QUICK_PRESETS.map((p) => {
          const active = draft?.id === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setDraft(p)}
              className={[
                "inline-flex min-h-10 items-center gap-2 rounded-full border px-3 py-2 text-left text-xs font-medium transition",
                active
                  ? "border-teal-500 bg-teal-50 text-teal-950 shadow-sm"
                  : "border-zinc-200 bg-zinc-50/80 text-zinc-800 hover:border-zinc-300 hover:bg-white",
              ].join(" ")}
            >
              <span className="text-base" aria-hidden>
                {p.emoji}
              </span>
              {p.label}
            </button>
          );
        })}
      </div>

      {draft && (
        <form
          action={formAction}
          className="mt-5 space-y-3 rounded-xl bg-zinc-50/80 p-4 ring-1 ring-zinc-100"
          {...(pending ? { inert: true } : {})}
        >
          <BlockingSubmitOverlay active={pending} message="Adding budget category…" />
          <input type="hidden" name="cadence" value="monthly" />
          <input type="hidden" name="calendar_year" value={defaultCalendarYear} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-zinc-900">
              {draft.emoji} {draft.label}
            </p>
            <button
              type="button"
              className="text-xs font-medium text-zinc-500 hover:text-zinc-800"
              onClick={() => setDraft(null)}
            >
              Cancel
            </button>
          </div>
          <label className="block text-xs font-medium text-zinc-600">
            Category name
            <input
              name="category"
              required
              defaultValue={draft.category}
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
            />
          </label>
          <label className="block text-xs font-medium text-zinc-600">
            Monthly plan
            <input
              name="amount"
              type="number"
              min={0}
              step="0.01"
              required
              key={draft.id}
              defaultValue={suggested}
              className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
            />
          </label>
          <p className="text-[11px] text-zinc-500">
            Suggested starting point:{" "}
            <span className="font-medium text-zinc-700">
              {formatCurrency(suggested, currency)}
            </span>
            {monthlyIncome != null && monthlyIncome > 0 && draft.id === "savings"
              ? " (~20% of your stated monthly income)"
              : null}
          </p>
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-xl bg-zinc-900 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 sm:w-auto sm:px-6"
          >
            {pending ? "Adding…" : "Add to monthly plan"}
          </button>
        </form>
      )}
    </div>
  );
}
