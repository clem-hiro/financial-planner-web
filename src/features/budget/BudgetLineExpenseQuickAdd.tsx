"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

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
      className="mt-2 rounded border border-zinc-100 bg-zinc-50/80 p-2"
    >
      {!compact && (
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
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
          <span className="mb-0.5 block text-zinc-600">Amount</span>
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
            className="w-24 rounded border border-zinc-300 px-1.5 py-1"
          />
        </label>
        <label className="text-xs">
          <span className="mb-0.5 block text-zinc-600">Date</span>
          <input
            name="spent_at"
            type="date"
            defaultValue={defaultSpentAt}
            required
            className="rounded border border-zinc-300 px-1.5 py-1"
          />
        </label>
        <button
          type="submit"
          disabled={isBusy}
          className="rounded bg-zinc-800 px-2 py-1 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-60"
        >
          {isBusy ? "…" : "Add"}
        </button>
      </div>
      {isBusy && (
        <p className="mt-1 text-xs text-zinc-500" role="status" aria-live="polite">
          Updating expenses...
        </p>
      )}
    </form>
  );
}
