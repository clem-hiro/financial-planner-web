"use client";

import { useMemo, useState } from "react";
import type { DebtPlanningRow } from "@/features/debts/DebtPlanningPanels";
import {
  compareDebtPayoffStrategies,
  debtsEligibleForPayoffComparison,
} from "@/domain/finance/debt-payoff-strategies";
import { effectiveMonthlyRepayment } from "@/domain/finance/debt-repayment";
import { appCardClass } from "@/ui/surface-classes";
import { formatCurrency } from "@/ui/lib/format";

function debtToSimInput(row: DebtPlanningRow) {
  return {
    id: row.id ?? row.name,
    name: row.name,
    balance: row.balance,
    annualRate: row.interestRateAnnual ?? 0,
    minimumPayment: effectiveMonthlyRepayment(row),
  };
}

export function DebtPayoffStrategyComparison({
  debtRows,
  currencyCode,
}: {
  debtRows: DebtPlanningRow[];
  currencyCode: string;
}) {
  const [extraMonthly, setExtraMonthly] = useState(0);

  const simDebts = useMemo(() => debtRows.map(debtToSimInput), [debtRows]);
  const eligible = useMemo(
    () => debtsEligibleForPayoffComparison(simDebts),
    [simDebts]
  );

  const results = useMemo(
    () => compareDebtPayoffStrategies(simDebts, extraMonthly),
    [simDebts, extraMonthly]
  );

  if (eligible.length < 2) return null;

  const strategiesMatch =
    results.length === 2 &&
    results[0]!.monthsToDebtFree === results[1]!.monthsToDebtFree &&
    results[0]!.totalInterestPaid === results[1]!.totalInterestPaid;

  return (
    <section className={`${appCardClass} p-4 sm:p-5`}>
      <h3 className="text-sm font-semibold text-slate-900">
        Payoff strategy comparison
      </h3>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">
        Compare avalanche (target highest interest) vs snowball (target
        smallest balance) using your current minimum repayments plus any extra
        you can put toward debt each month.
      </p>

      <label className="mt-4 block text-xs text-slate-600">
        <span className="font-medium text-slate-700">
          Extra monthly toward debt (optional)
        </span>
        <input
          type="number"
          min={0}
          step={50}
          value={extraMonthly || ""}
          onChange={(e) => {
            const n = Number(e.target.value);
            setExtraMonthly(Number.isFinite(n) && n >= 0 ? n : 0);
          }}
          className="mt-1 w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
          placeholder="0"
        />
      </label>

      {strategiesMatch && extraMonthly <= 0 ? (
        <p className="mt-3 rounded-lg bg-slate-50 px-2.5 py-2 text-[11px] leading-relaxed text-slate-600">
          With only scheduled minimums and no extra payment, both strategies
          follow the same path. Add extra monthly above to see how payoff order
          and total interest differ.
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {results.map((r) => (
          <div
            key={r.strategy}
            className="rounded-xl border border-slate-200/80 bg-slate-50/50 px-3 py-3"
          >
            <p className="text-xs font-semibold text-slate-800">{r.label}</p>
            <dl className="mt-2 space-y-1.5 text-xs text-slate-600">
              <div className="flex justify-between gap-2">
                <dt>Debt-free in</dt>
                <dd className="font-medium text-slate-900">
                  {r.monthsToDebtFree != null
                    ? `${r.monthsToDebtFree} months`
                    : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Est. total interest</dt>
                <dd className="font-medium text-slate-900">
                  {formatCurrency(r.totalInterestPaid, currencyCode)}
                </dd>
              </div>
            </dl>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        Illustrative only — assumes fixed rates and steady minimums. Not lending
        advice; your bank&apos;s actual schedule may differ.
      </p>
    </section>
  );
}
