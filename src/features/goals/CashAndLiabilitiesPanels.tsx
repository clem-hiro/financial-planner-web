"use client";

import { useRouter } from "next/navigation";
import { useActionState } from "react";
import {
  createCashAccountAction,
  createLiabilityAction,
  deleteCashAccountAction,
  deleteLiabilityAction,
  updateCashAccountAction,
  updateLiabilityAction,
} from "@/server/actions";
import { formatCurrency } from "@/ui/lib/format";

export type CashAccountBalanceRow = {
  id: string;
  name: string;
  balance: number;
};

export type LiabilityBalanceRow = {
  id: string;
  name: string;
  balance: number;
};

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
  const [state, formAction] = useActionState(wrapped, initial);
  return (
    <form
      action={formAction}
      className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50/50 p-3"
    >
      <p className="mb-2 text-xs font-medium text-zinc-700">Add cash account</p>
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
            className="rounded-md bg-zinc-800 px-2 py-1 text-xs font-medium text-white hover:bg-zinc-700"
          >
            Add
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
  const wrapped = async (
    prev: typeof initial,
    fd: FormData
  ): Promise<typeof initial> => {
    const res = await updateCashAccountAction(prev, fd);
    if (res.error === null) router.refresh();
    return res;
  };
  const [state, formAction] = useActionState(wrapped, initial);
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3">
      <form action={formAction} className="space-y-2">
        <input type="hidden" name="id" value={row.id} />
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
              className="rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white hover:bg-zinc-800"
            >
              Save
            </button>
          </div>
        </div>
      </form>
      <button
        type="button"
        className="mt-2 text-xs text-red-600 hover:underline"
        onClick={async () => {
          const fd = new FormData();
          fd.set("id", row.id);
          await deleteCashAccountAction(fd);
          router.refresh();
        }}
      >
        Remove
      </button>
    </div>
  );
}

function AddLiabilityForm({ currencyCode }: { currencyCode: string }) {
  const router = useRouter();
  const wrapped = async (
    prev: typeof initial,
    fd: FormData
  ): Promise<typeof initial> => {
    const res = await createLiabilityAction(prev, fd);
    if (res.error === null) router.refresh();
    return res;
  };
  const [state, formAction] = useActionState(wrapped, initial);
  return (
    <form
      action={formAction}
      className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50/50 p-3"
    >
      <p className="mb-2 text-xs font-medium text-zinc-700">Add debt</p>
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
            placeholder="Credit card"
            className="w-40 rounded border border-zinc-300 px-2 py-1"
          />
        </label>
        <label className="text-xs">
          <span className="mb-0.5 block text-zinc-600">
            Owed ({currencyCode})
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
            className="rounded-md bg-zinc-800 px-2 py-1 text-xs font-medium text-white hover:bg-zinc-700"
          >
            Add
          </button>
        </div>
      </div>
    </form>
  );
}

function LiabilityRow({
  row,
  currencyCode,
}: {
  row: LiabilityBalanceRow;
  currencyCode: string;
}) {
  const router = useRouter();
  const wrapped = async (
    prev: typeof initial,
    fd: FormData
  ): Promise<typeof initial> => {
    const res = await updateLiabilityAction(prev, fd);
    if (res.error === null) router.refresh();
    return res;
  };
  const [state, formAction] = useActionState(wrapped, initial);
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-3">
      <form action={formAction} className="space-y-2">
        <input type="hidden" name="id" value={row.id} />
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
              Owed ({currencyCode})
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
              className="rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white hover:bg-zinc-800"
            >
              Save
            </button>
          </div>
        </div>
      </form>
      <button
        type="button"
        className="mt-2 text-xs text-red-600 hover:underline"
        onClick={async () => {
          const fd = new FormData();
          fd.set("id", row.id);
          await deleteLiabilityAction(fd);
          router.refresh();
        }}
      >
        Remove
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
  liabilityRows: LiabilityBalanceRow[];
  currencyCode: string;
}) {
  const cashTotal = cashRows.reduce((a, r) => a + r.balance, 0);
  const debtTotal = liabilityRows.reduce((a, r) => a + r.balance, 0);

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section className="space-y-3">
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
        <ul className="space-y-2">
          {cashRows.map((row) => (
            <li key={row.id}>
              <CashAccountRow row={row} currencyCode={currencyCode} />
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Debts</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Amount owed (positive number). Subtracted from investments + cash
            for net worth.
          </p>
          <p className="mt-2 text-sm text-zinc-700">
            Total owed:{" "}
            <span className="font-semibold text-red-800">
              {formatCurrency(debtTotal, currencyCode)}
            </span>
          </p>
        </div>
        <AddLiabilityForm currencyCode={currencyCode} />
        <ul className="space-y-2">
          {liabilityRows.map((row) => (
            <li key={row.id}>
              <LiabilityRow row={row} currencyCode={currencyCode} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
