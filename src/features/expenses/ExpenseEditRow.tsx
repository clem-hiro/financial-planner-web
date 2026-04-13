"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ExpenseRow } from "@/data/supabase/types";
import { num } from "@/data/mappers";
import { DEFAULT_BASE_CURRENCY } from "@/lib/currency";
import { appInlineLinkClass } from "@/ui/app-link-styles";
import { formatCurrency } from "@/ui/lib/format";

export function ExpenseEditRow({
  expense,
  currency = DEFAULT_BASE_CURRENCY,
}: {
  expense: ExpenseRow;
  currency?: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const amount = Number(fd.get("amount"));
    const category = String(fd.get("category") ?? "").trim();
    const spent_at = String(fd.get("spent_at") ?? "").trim();
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
    if (!/^\d{4}-\d{2}-\d{2}$/.test(spent_at)) {
      setError("Invalid date");
      return;
    }

    setPending(true);
    try {
      const res = await fetch(`/api/expenses/${expense.id}`, {
        method: "PATCH",
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
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof j.error === "string" ? j.error : "Update failed");
        return;
      }
      setEditing(false);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function onDelete() {
    if (!window.confirm("Delete this expense?")) return;
    setError(null);
    setDeleting(true);
    try {
      const res = await fetch(`/api/expenses/${expense.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(typeof j.error === "string" ? j.error : "Delete failed");
        return;
      }
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  if (!editing) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2 rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs">
        <span className="font-medium capitalize text-zinc-900">
          {expense.category}
        </span>
        <span className="font-medium text-zinc-800">
          {formatCurrency(num(expense.amount), currency)}
        </span>
        <span className="text-zinc-500">{expense.spent_at}</span>
        {(expense.spend_period ?? "monthly") === "annual" && (
          <span className="rounded bg-amber-100 px-1 py-0.5 text-amber-900">
            Annual
          </span>
        )}
        {expense.note && (
          <span className="w-full text-zinc-500">{expense.note}</span>
        )}
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={`text-sm ${appInlineLinkClass}`}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="text-red-600 hover:underline disabled:opacity-50"
          >
            {deleting ? "…" : "Delete"}
          </button>
        </div>
        {error && (
          <p className="w-full text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={onSave}
      className="mt-2 space-y-2 rounded border border-zinc-200 bg-white p-2 text-xs"
    >
      {error && (
        <p className="text-red-600" role="alert">
          {error}
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <label>
          <span className="mb-0.5 block text-zinc-600">Amount</span>
          <input
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            required
            defaultValue={num(expense.amount)}
            className="w-full rounded border border-zinc-300 px-1.5 py-1"
          />
        </label>
        <label>
          <span className="mb-0.5 block text-zinc-600">Category</span>
          <input
            name="category"
            type="text"
            required
            defaultValue={expense.category}
            className="w-full rounded border border-zinc-300 px-1.5 py-1"
          />
        </label>
        <label>
          <span className="mb-0.5 block text-zinc-600">Date</span>
          <input
            name="spent_at"
            type="date"
            required
            defaultValue={expense.spent_at}
            className="w-full rounded border border-zinc-300 px-1.5 py-1"
          />
        </label>
        <label className="sm:col-span-2">
          <span className="mb-0.5 block text-zinc-600">Note</span>
          <input
            name="note"
            type="text"
            defaultValue={expense.note ?? ""}
            className="w-full rounded border border-zinc-300 px-1.5 py-1"
          />
        </label>
        <label className="sm:col-span-2">
          <span className="mb-0.5 block text-zinc-600">Spend type</span>
          <select
            name="spend_period"
            className="w-full rounded border border-zinc-300 px-1.5 py-1"
            defaultValue={expense.spend_period ?? "monthly"}
          >
            <option value="monthly">Monthly</option>
            <option value="annual">Annual</option>
          </select>
        </label>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-zinc-800 px-2 py-1 text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setError(null);
          }}
          className="rounded border border-zinc-300 px-2 py-1 hover:bg-zinc-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
