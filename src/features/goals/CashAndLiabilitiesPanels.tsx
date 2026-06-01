"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useMemo, useState } from "react";
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
import type { CashAccountPurpose, LiabilityRow } from "@/data/supabase/types";
import { CategoryVisibilityToggle } from "@/features/consent/CategoryVisibilityToggle";
import type { AdvisorCategoryVisibility } from "@/lib/advisor-visibility";
import {
  CASH_ACCOUNT_PURPOSE_LABELS,
  CASH_ACCOUNT_PURPOSES,
  cashPurposeSortOrder,
} from "@/domain/finance/cash-account-purpose";
import type { CashAccountHistoryPoint } from "@/domain/finance/cash-account-history.types";
import { BlockingSubmitOverlay } from "@/ui/BlockingSubmitOverlay";
import { formatCurrency } from "@/ui/lib/format";
import { appInlineLinkClass } from "@/ui/app-link-styles";

export type CashAccountBalanceRow = {
  id: string;
  name: string;
  balance: number;
  purpose: CashAccountPurpose;
};

/** @deprecated Use `DebtPlanningRow` from debt planning panels. */
export type LiabilityBalanceRow = DebtPlanningRow;

const initial = { error: null as string | null };

const selectClass =
  "rounded border border-zinc-300 px-2 py-1 text-xs bg-white";

function PurposeSelect({
  name,
  defaultValue = "other",
}: {
  name: string;
  defaultValue?: CashAccountPurpose;
}) {
  return (
    <label className="text-xs">
      <span className="mb-0.5 block text-zinc-600">Bucket</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className={`${selectClass} min-w-[9rem]`}
      >
        {CASH_ACCOUNT_PURPOSES.map((p) => (
          <option key={p} value={p}>
            {CASH_ACCOUNT_PURPOSE_LABELS[p]}
          </option>
        ))}
      </select>
    </label>
  );
}

function formatSnapshotDate(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function CashAccountHistory({
  points,
  currencyCode,
}: {
  points: CashAccountHistoryPoint[];
  currencyCode: string;
}) {
  if (points.length === 0) return null;
  return (
    <details className="mt-2 rounded-lg border border-zinc-100 bg-zinc-50/80 px-2 py-1.5">
      <summary className="cursor-pointer text-[11px] font-medium text-zinc-600">
        Balance history ({points.length})
      </summary>
      <ul className="mt-1.5 space-y-0.5 text-[11px] text-zinc-600">
        {points.map((p, i) => (
          <li key={`${p.recorded_at}-${i}`} className="flex justify-between gap-2">
            <span>{formatSnapshotDate(p.recorded_at)}</span>
            <span className="font-medium text-zinc-800">
              {formatCurrency(p.balance, currencyCode)}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

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
        <PurposeSelect name="purpose" defaultValue="everyday_spending" />
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
  history,
}: {
  row: CashAccountBalanceRow;
  currencyCode: string;
  history: CashAccountHistoryPoint[];
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
            {CASH_ACCOUNT_PURPOSE_LABELS[row.purpose]}
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
          <PurposeSelect name="purpose" defaultValue={row.purpose} />
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
      <CashAccountHistory points={history} currencyCode={currencyCode} />
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

function groupCashByPurpose(rows: CashAccountBalanceRow[]) {
  const groups = new Map<CashAccountPurpose, CashAccountBalanceRow[]>();
  for (const row of rows) {
    const list = groups.get(row.purpose) ?? [];
    list.push(row);
    groups.set(row.purpose, list);
  }
  return [...groups.entries()].sort(
    ([a], [b]) => cashPurposeSortOrder(a) - cashPurposeSortOrder(b)
  );
}

export function CashAndLiabilitiesPanels({
  cashRows,
  cashHistoryByAccountId = {},
  liabilityRows,
  currencyCode,
  advisorVisibility = null,
}: {
  cashRows: CashAccountBalanceRow[];
  cashHistoryByAccountId?: Record<string, CashAccountHistoryPoint[]>;
  liabilityRows: LiabilityRow[] | LiabilityBalanceRow[];
  currencyCode: string;
  /** When set (client self-view with linked+consented advisor), show the
   * per-category visibility toggles. Null hides them (advisor view / no consent). */
  advisorVisibility?: AdvisorCategoryVisibility | null;
}) {
  const cashTotal = cashRows.reduce((a, r) => a + r.balance, 0);
  const groupedCash = useMemo(() => groupCashByPurpose(cashRows), [cashRows]);
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
            Bank balances grouped by liquidity bucket. Saving a balance adds a
            history point for trend tracking.
          </p>
          <p className="mt-2 text-sm text-zinc-700">
            Total cash:{" "}
            <span className="font-semibold text-zinc-900">
              {formatCurrency(cashTotal, currencyCode)}
            </span>
          </p>
        </div>
        {advisorVisibility ? (
          <CategoryVisibilityToggle
            category="cash_accounts"
            visible={advisorVisibility.cash_accounts}
            showTooltip
          />
        ) : null}
        <AddCashForm currencyCode={currencyCode} />
        {groupedCash.length === 0 ? (
          <p className="text-xs text-zinc-500">No cash accounts yet.</p>
        ) : (
          <div className="space-y-4">
            {groupedCash.map(([purpose, rows]) => {
              const subtotal = rows.reduce((a, r) => a + r.balance, 0);
              return (
                <div key={purpose} className="space-y-2">
                  <div className="flex items-baseline justify-between gap-2 border-b border-zinc-200/80 pb-1">
                    <h3 className="text-xs font-semibold text-zinc-800">
                      {CASH_ACCOUNT_PURPOSE_LABELS[purpose]}
                    </h3>
                    <p className="text-[11px] text-zinc-600">
                      {formatCurrency(subtotal, currencyCode)}
                    </p>
                  </div>
                  <ul className="space-y-3">
                    {rows.map((row) => (
                      <li key={row.id}>
                        <CashAccountRow
                          row={row}
                          currencyCode={currencyCode}
                          history={cashHistoryByAccountId[row.id] ?? []}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="rounded-2xl border border-zinc-200 bg-zinc-50/30 p-4">
        {advisorVisibility ? (
          <div className="mb-3">
            <CategoryVisibilityToggle
              category="liabilities"
              visible={advisorVisibility.liabilities}
              showTooltip
            />
          </div>
        ) : null}
        <p className="mb-3 text-xs text-zinc-600">
          Housing mortgages are managed under{" "}
          <Link href="/setup?tab=housing" className={appInlineLinkClass}>
            Setup → Housing
          </Link>{" "}
          (property-first, with optional linked loan).
        </p>
        <DebtPlanningPanels debtRows={debtRows} currencyCode={currencyCode} />
      </div>
    </div>
  );
}
