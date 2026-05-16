"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import {
  createCashAccountAction,
  deleteCashAccountAction,
  updateCashAccountAction,
} from "@/server/actions";
import {
  DebtPlanningPanels,
  mapLiabilityRows,
  type DebtPlanningRow,
} from "@/features/debts/DebtPlanningPanels";
import type { LiabilityRow } from "@/data/supabase/types";
import { BlockingSubmitOverlay } from "@/ui/BlockingSubmitOverlay";
import { formatCurrency } from "@/ui/lib/format";

export type CashAccountBalanceRow = {
  id: string;
  name: string;
  balance: number;
};

/** @deprecated Use `DebtPlanningRow` from debt planning panels. */
export type LiabilityBalanceRow = DebtPlanningRow;

const initial = { error: null as string | null };

function AddCashForm({ currencyCode }: { currencyCode: string }) {
  const router = useRouter();
  const wrapped = async (
    prev: typeof initial,
    fd: FormData
  ): Promise<typeof initial> => {
    const res = await createCashAccountAction(prev, fd);
    if (res.error === null) {
      router.refresh();
    }
    return res;
  };
  const [state, formAction, pending] = useActionState(wrapped, initial);
  return (
    <form
      action={formAction}
      className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 p-3.5"
      {...(pending ? { inert: true } : {})}
    >
      <BlockingSubmitOverlay active={pending} message="Adding cash account…" />
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
          New cash account
        </p>
        <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[10px] font-medium text-zinc-700">
          Draft
        </span>
      </div>
      {state.error && (
        <p className="mb-2 text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs">
          <span className="mb-0.5 block text-zinc-600">Name</span>
          <input
            name="name"
            type="text"
            required
            placeholder="Checking"
            className="w-40 rounded border border-zinc-300 px-2 py-1"
          />
        </label>
        <label className="text-xs">
          <span className="mb-0.5 block text-zinc-600">
            Balance ({currencyCode})
          </span>
          <input
            name="balance"
            type="number"
            min={0}
            step="0.01"
            defaultValue={0}
            required
            className="w-28 rounded border border-zinc-300 px-2 py-1"
          />
        </label>
        <div className="w-full flex justify-end">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-zinc-800 px-2 py-1 text-xs font-medium text-white hover:bg-zinc-700"
          >
            {pending ? "Adding…" : "Add"}
          </button>
        </div>
      </div>
    </form>
  );
}

function CashAccountRow({
  row,
  currencyCode,
}: {
  row: CashAccountBalanceRow;
  currencyCode: string;
}) {
  const router = useRouter();
  const [deletePending, setDeletePending] = useState(false);
  const wrapped = async (
    prev: typeof initial,
    fd: FormData
  ): Promise<typeof initial> => {
    const res = await updateCashAccountAction(prev, fd);
    if (res.error === null) router.refresh();
    return res;
  };
  const [state, formAction, pending] = useActionState(wrapped, initial);
  return (
    <div
      className="rounded-xl border border-zinc-200 bg-white p-3.5 shadow-sm ring-1 ring-zinc-100"
      {...(deletePending ? { inert: true } : {})}
    >
      <BlockingSubmitOverlay active={deletePending} message="Removing cash account…" />
      <form
        action={formAction}
        className="space-y-2"
        {...(pending ? { inert: true } : {})}
      >
        <BlockingSubmitOverlay active={pending} message="Saving cash account…" />
        <input type="hidden" name="id" value={row.id} />
        <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-2 py-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
            Saved account
          </p>
          <p className="text-xs font-semibold text-zinc-800">
            {formatCurrency(row.balance, currencyCode)}
          </p>
        </div>
        {state.error && (
          <p className="text-sm text-red-600" role="alert">
            {state.error}
          </p>
        )}
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs">
            <span className="mb-0.5 block text-zinc-600">Name</span>
            <input
              name="name"
              type="text"
              required
              defaultValue={row.name}
              className="w-40 rounded border border-zinc-300 px-2 py-1"
            />
          </label>
          <label className="text-xs">
            <span className="mb-0.5 block text-zinc-600">
              Balance ({currencyCode})
            </span>
            <input
              name="balance"
              type="number"
              min={0}
              step="0.01"
              required
              defaultValue={row.balance}
              className="w-28 rounded border border-zinc-300 px-2 py-1"
            />
          </label>
          <div className="w-full flex justify-end">
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white hover:bg-zinc-800"
            >
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </form>
      <button
        type="button"
        className="mt-2 text-xs text-red-600 hover:underline"
        onClick={async () => {
          setDeletePending(true);
          const fd = new FormData();
          fd.set("id", row.id);
          try {
            await deleteCashAccountAction(fd);
            router.refresh();
          } finally {
            setDeletePending(false);
          }
        }}
      >
        {deletePending ? "Removing…" : "Remove"}
      </button>
    </div>
  );
}


export function CashAndLiabilitiesPanels({
  cashRows,
  liabilityRows,
  currencyCode,
}: {
  cashRows: CashAccountBalanceRow[];
  liabilityRows: LiabilityRow[] | LiabilityBalanceRow[];
  currencyCode: string;
}) {
  const cashTotal = cashRows.reduce((a, r) => a + r.balance, 0);
  const debtRows =
    liabilityRows.length > 0 && "user_id" in liabilityRows[0]
      ? mapLiabilityRows(liabilityRows as LiabilityRow[])
      : (liabilityRows as DebtPlanningRow[]);
  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section className="space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50/30 p-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Cash accounts</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Bank balances, cash buckets, or manual CPF lines—anything not in
            investments. Counts toward net worth as cash.
          </p>
          <p className="mt-2 text-sm text-zinc-700">
            Total cash:{" "}
            <span className="font-semibold text-zinc-900">
              {formatCurrency(cashTotal, currencyCode)}
            </span>
          </p>
        </div>
        <AddCashForm currencyCode={currencyCode} />
        <ul className="space-y-3">
          {cashRows.map((row) => (
            <li key={row.id}>
              <CashAccountRow row={row} currencyCode={currencyCode} />
            </li>
          ))}
        </ul>
      </section>

      <div className="rounded-2xl border border-zinc-200 bg-zinc-50/30 p-4">
        <DebtPlanningPanels debtRows={debtRows} currencyCode={currencyCode} />
      </div>
    </div>
  );
}
