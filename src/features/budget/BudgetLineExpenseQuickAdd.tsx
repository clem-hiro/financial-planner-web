"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { fpInputClass, fpPrimaryButtonClass } from "@/ui/input-classes";

type Props = {
  category: string;
  yearMonth: string;
  defaultSpentAt: string;
  /** Pre-fills amount (e.g. monthly budget); user can change before saving. */
  suggestedAmount?: number;
  /** Lighter layout when the parent already shows category / planned. */
  compact?: boolean;
};

export function BudgetLineExpenseQuickAdd({
  category,
  yearMonth,
  defaultSpentAt,
  suggestedAmount,
  compact = false,
}: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [isRefreshing, startTransition] = useTransition();
  const isBusy = pending || isRefreshing;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const amount = Number(fd.get("amount"));
    const spent_at = String(fd.get("spent_at") ?? defaultSpentAt).trim();

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(spent_at)) {
      setError("Invalid date");
      return;
    }
    if (spent_at.slice(0, 7) !== yearMonth) {
      setError(`Date must be in ${yearMonth}`);
      return;
    }

    setPending(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          amount,
          category,
          spent_at,
          note: null,
          spend_period: "monthly",
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(typeof j.error === "string" ? j.error : "Failed to add");
        return;
      }
      form.reset();
      const spentEl = form.elements.namedItem("spent_at") as HTMLInputElement;
      spentEl.value = defaultSpentAt;
      const amtEl = form.elements.namedItem("amount") as HTMLInputElement;
      if (
        suggestedAmount != null &&
        Number.isFinite(suggestedAmount) &&
        suggestedAmount > 0
      ) {
        amtEl.value = String(suggestedAmount);
      } else {
        amtEl.value = "";
      }
      startTransition(() => {
        router.refresh();
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="mt-2 rounded-xl border border-slate-200/90 bg-linear-to-r from-white to-emerald-50/45 p-2.5 shadow-sm"
    >
      {!compact && (
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Log actual (monthly)
        </p>
      )}
      {error && (
        <p className="mb-1 text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs">
          <span className="mb-0.5 block text-slate-600">Amount</span>
          <input
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            required
            defaultValue={
              suggestedAmount != null &&
              Number.isFinite(suggestedAmount) &&
              suggestedAmount > 0
                ? suggestedAmount
                : undefined
            }
            className={`${fpInputClass} w-28 max-w-none py-1.5 text-xs`}
          />
        </label>
        <label className="text-xs">
          <span className="mb-0.5 block text-slate-600">Date</span>
          <input
            name="spent_at"
            type="date"
            defaultValue={defaultSpentAt}
            required
            className={`${fpInputClass} max-w-none py-1.5 text-xs`}
          />
        </label>
        <button
          type="submit"
          disabled={isBusy}
          className={`${fpPrimaryButtonClass} px-3 py-1.5 text-xs disabled:opacity-60`}
        >
          {isBusy ? "…" : "Add"}
        </button>
      </div>
      {isBusy && (
        <p className="mt-1 text-xs text-slate-500" role="status" aria-live="polite">
          Updating expenses...
        </p>
      )}
    </form>
  );
}
