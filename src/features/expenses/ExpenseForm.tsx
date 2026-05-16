"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { normalizeCategory } from "@/domain/finance/budget";
import {
  fpInputClass,
  fpPrimaryButtonClass,
  fpSelectClass,
} from "@/ui/input-classes";
import { BlockingSubmitOverlay } from "@/ui/BlockingSubmitOverlay";

export function ExpenseForm({
  defaultDate,
  defaultCategory,
  blockedNormalizedCategoryKeys = [],
}: {
  defaultDate: string;
  /** Prefill category (e.g. from /expenses?category=). */
  defaultCategory?: string;
  /** Budget category keys that already have a monthly row this month (cannot add another). */
  blockedNormalizedCategoryKeys?: string[];
}) {
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
    const category = String(fd.get("category") ?? "").trim();
    const spent_at = String(fd.get("spent_at") ?? defaultDate);
    const noteRaw = fd.get("note");
    const note = noteRaw ? String(noteRaw) : null;
    const spend_period_raw = String(fd.get("spend_period") ?? "monthly");
    const spend_period =
      spend_period_raw === "annual" ? "annual" : "monthly";

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter a valid amount");
      return;
    }
    if (!category) {
      setError("Category is required");
      return;
    }
    if (
      spend_period === "monthly" &&
      blockedNormalizedCategoryKeys.includes(normalizeCategory(category))
    ) {
      setError(
        "That name matches a monthly budget category you already logged—use Edit below, or use a different label for a custom expense (e.g. add detail in the name or note)."
      );
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
          note,
          spend_period,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Failed to add expense");
        return;
      }
      form.reset();
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
      className="space-y-3 rounded-2xl border border-slate-200/90 bg-linear-to-br from-white via-white to-sky-50/35 p-4 shadow-sm"
      {...(isBusy ? { inert: true } : {})}
    >
      <BlockingSubmitOverlay active={isBusy} message="Saving expense…" />
      <h2 className="text-sm font-semibold text-slate-900">
        Custom expenses
      </h2>
      <div className="rounded-xl border border-emerald-100/80 bg-emerald-50/60 px-3 py-2 text-xs leading-relaxed text-slate-600">
        <p>
          Add one-off spending here: gifts, ad-hoc buys, or anything that
          doesn&apos;t fit your monthly budget.
        </p>
        <p className="mt-1 font-medium text-slate-700">
          If it matches a budget category you already logged this month, edit
          that row instead.
        </p>
      </div>
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Amount</span>
          <input
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            required
            className={`${fpInputClass} max-w-none`}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Category</span>
          <input
            name="category"
            type="text"
            required
            defaultValue={defaultCategory ?? ""}
            className={`${fpInputClass} max-w-none`}
            placeholder="e.g. Wedding gift, Vet bill, Cash spending"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-slate-600">Date</span>
          <input
            name="spent_at"
            type="date"
            defaultValue={defaultDate}
            required
            className={`${fpInputClass} max-w-none`}
          />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-slate-600">Note (optional)</span>
          <input
            name="note"
            type="text"
            className="w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition-[border-color,box-shadow,background-color] placeholder:text-slate-400 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/15"
          />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-slate-600">Spend type</span>
          <select
            name="spend_period"
            className={`${fpSelectClass} max-w-none`}
            defaultValue="monthly"
          >
            <option value="monthly">
              Monthly (counts toward monthly category budgets)
            </option>
            <option value="annual">
              Annual (counts toward annual budgets for that year only)
            </option>
          </select>
        </label>
      </div>
      <button
        type="submit"
        disabled={isBusy}
        className={`${fpPrimaryButtonClass} disabled:opacity-60`}
      >
        {isBusy ? "Saving…" : "Add custom expense"}
      </button>
    </form>
  );
}
