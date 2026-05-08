"use client";

import { useActionState } from "react";
import { useState } from "react";
import { clearCpfBalanceAction, upsertCpfBalanceAction } from "@/server/actions";
import type { CpfBalanceRow } from "@/data/supabase/types";
import { num } from "@/data/mappers";

const initial = { error: null as string | null };
const numberInputClass =
  "w-full rounded border border-zinc-300 px-2 py-1.5 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

export function CpfBalancesForm({ row }: { row: CpfBalanceRow | null }) {
  const [state, action] = useActionState(upsertCpfBalanceAction, initial);
  const [showCpfisAdvanced, setShowCpfisAdvanced] = useState(() => {
    if (!row) return false;
    return (
      num(row.cpfis_monthly_from_oa) > 0 ||
      num(row.cpfis_notional_balance) > 0
    );
  });

  return (
    <div className="space-y-3">
      <form action={action} className="space-y-4">
        <h2 className="text-sm font-semibold text-zinc-900">
          CPF balances (OA / SA / MA)
        </h2>
        {state.error && (
          <p className="text-sm text-red-600" role="alert">
            {state.error}
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600">OA balance</span>
            <input
              name="oa"
              type="number"
              min={0}
              step="0.01"
              required
              defaultValue={row ? num(row.oa) : 0}
              className={numberInputClass}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600">SA balance</span>
            <input
              name="sa"
              type="number"
              min={0}
              step="0.01"
              required
              defaultValue={row ? num(row.sa) : 0}
              className={numberInputClass}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600">MA balance</span>
            <input
              name="ma"
              type="number"
              min={0}
              step="0.01"
              required
              defaultValue={row ? num(row.ma) : 0}
              className={numberInputClass}
            />
          </label>
        </div>
        <div className="border-t border-zinc-200 pt-4">
          <button
            type="button"
            onClick={() => setShowCpfisAdvanced((prev) => !prev)}
            className="flex w-full items-center justify-between rounded-md px-1 py-1 text-left"
            aria-expanded={showCpfisAdvanced}
            aria-controls="advanced-cpfis-modeling"
          >
            <span className="text-xs font-medium text-zinc-700">
              Advanced CPFIS modeling (optional)
            </span>
            <span className="text-xs text-zinc-500">
              {showCpfisAdvanced ? "Hide" : "Show"}
            </span>
          </button>
          {showCpfisAdvanced && (
            <div id="advanced-cpfis-modeling">
              <p className="mt-1 text-xs text-zinc-500">
                Monthly OA outflow and a separate notional balance with its own
                return assumption — rough stand-in for CPFIS-style flows.
              </p>
              <div className="mt-2 grid gap-3 sm:grid-cols-3">
                <label className="text-sm">
                  <span className="mb-1 block text-zinc-600">Monthly from OA</span>
                  <input
                    name="cpfis_monthly_from_oa"
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    defaultValue={row ? num(row.cpfis_monthly_from_oa) : 0}
                    className={numberInputClass}
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-zinc-600">Notional balance</span>
                  <input
                    name="cpfis_notional_balance"
                    type="number"
                    min={0}
                    step="0.01"
                    required
                    defaultValue={row ? num(row.cpfis_notional_balance) : 0}
                    className={numberInputClass}
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-zinc-600">Annual return (0–1)</span>
                  <input
                    name="cpfis_annual_return"
                    type="number"
                    min={0}
                    max={1}
                    step="0.01"
                    required
                    defaultValue={row ? num(row.cpfis_annual_return) : 0.04}
                    className={numberInputClass}
                  />
                </label>
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Save CPF balances
          </button>
        </div>
      </form>
      {row && (
        <form action={clearCpfBalanceAction}>
          <button
            type="submit"
            className="text-xs font-medium text-rose-700 hover:underline"
          >
            Remove saved CPF row (clears from net worth)
          </button>
        </form>
      )}
    </div>
  );
}
