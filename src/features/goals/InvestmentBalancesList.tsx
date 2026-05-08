"use client";

import { useRouter } from "next/navigation";
import { useActionState, useMemo, useState } from "react";
import { updateInvestmentAction } from "@/server/actions";
import { InfoTooltip } from "@/ui/InfoTooltip";
import { fpInputClass, fpPrimaryButtonClass } from "@/ui/input-classes";
import { formatCurrency } from "@/ui/lib/format";

export type InvestmentBalanceRow = {
  id: string;
  name: string;
  current_value: number;
  monthly_contribution: number;
  expected_annual_return: number;
};

const initial = { error: null as string | null };

const fieldClass = `${fpInputClass} max-w-none`;

function InvestmentSummary({
  investment,
  currencyCode,
  onEdit,
}: {
  investment: InvestmentBalanceRow;
  currencyCode: string;
  onEdit: () => void;
}) {
  const returnPct = (investment.expected_annual_return * 100).toFixed(1);
  return (
    <div className="flex items-start justify-between gap-3 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">
          {investment.name}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          <span>
            +{formatCurrency(investment.monthly_contribution, currencyCode)}/mo
          </span>
          <span aria-hidden className="px-1.5 text-slate-300">
            ·
          </span>
          <span>{returnPct}% return</span>
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <p className="text-sm font-semibold tabular-nums text-slate-900">
          {formatCurrency(investment.current_value, currencyCode)}
        </p>
        <button
          type="button"
          onClick={onEdit}
          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
        >
          Edit
        </button>
      </div>
    </div>
  );
}

function InvestmentEditForm({
  investment,
  currencyCode,
  onClose,
}: {
  investment: InvestmentBalanceRow;
  currencyCode: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(investment.name);
  const [currentValueRaw, setCurrentValueRaw] = useState(
    String(investment.current_value)
  );
  const [monthlyRaw, setMonthlyRaw] = useState(
    String(investment.monthly_contribution)
  );
  const [returnPctRaw, setReturnPctRaw] = useState(
    String(
      Math.round(investment.expected_annual_return * 1000) / 10
    )
  );

  const wrapped = async (
    prev: typeof initial,
    formData: FormData
  ): Promise<typeof initial> => {
    const res = await updateInvestmentAction(prev, formData);
    if (res.error === null) {
      router.refresh();
      onClose();
    }
    return res;
  };
  const [state, formAction, pending] = useActionState(wrapped, initial);

  const decimal = useMemo(() => {
    const n = Number(returnPctRaw);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, n)) / 100;
  }, [returnPctRaw]);

  return (
    <form action={formAction} className="space-y-4 py-4">
      <input type="hidden" name="id" value={investment.id} />
      {state.error && (
        <p
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          role="alert"
        >
          {state.error}
        </p>
      )}

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Account name</span>
        <input
          name="name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={fieldClass}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">
            Current value{" "}
            <span className="font-normal text-slate-500">({currencyCode})</span>
          </span>
          <input
            name="current_value"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            required
            value={currentValueRaw}
            onChange={(e) => setCurrentValueRaw(e.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">
            Monthly contribution{" "}
            <span className="font-normal text-slate-500">({currencyCode})</span>
          </span>
          <input
            name="monthly_contribution"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            required
            value={monthlyRaw}
            onChange={(e) => setMonthlyRaw(e.target.value)}
            className={fieldClass}
          />
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 flex flex-wrap items-center gap-1 font-medium text-slate-700">
          Expected annual return
          <InfoTooltip ariaLabel="What to enter for expected return">
            <p>
              Long-run nominal yield for this account. Rough ranges:{" "}
              <strong>1–3%</strong> savings, <strong>4–6%</strong> bonds,{" "}
              <strong>6–9%</strong> diversified equities.
            </p>
            <p className="mt-2 text-slate-300">
              Type a percent — e.g. <strong>7</strong> for 7%. Used in
              projections only; not financial advice.
            </p>
          </InfoTooltip>
        </span>
        <div className="relative w-full max-w-40">
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            step={0.1}
            required
            value={returnPctRaw}
            onChange={(e) => setReturnPctRaw(e.target.value)}
            className={`${fieldClass} pr-10`}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-medium text-slate-400"
          >
            %
          </span>
        </div>
        <input
          type="hidden"
          name="expected_annual_return"
          value={decimal.toString()}
        />
      </label>

      <div className="flex flex-col-reverse items-stretch gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className={`${fpPrimaryButtonClass} disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

function InvestmentRow({
  investment,
  currencyCode,
}: {
  investment: InvestmentBalanceRow;
  currencyCode: string;
}) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <InvestmentSummary
        investment={investment}
        currencyCode={currencyCode}
        onEdit={() => setEditing(true)}
      />
    );
  }
  return (
    <InvestmentEditForm
      investment={investment}
      currencyCode={currencyCode}
      onClose={() => setEditing(false)}
    />
  );
}

export function InvestmentBalancesList({
  items,
  currencyCode,
}: {
  items: InvestmentBalanceRow[];
  currencyCode: string;
}) {
  const total = items.reduce((acc, i) => acc + i.current_value, 0);

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-zinc-900">Your accounts</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Track investments, savings, or cash-like accounts. Amounts are in{" "}
          {currencyCode}.
        </p>
        <p className="mt-2 text-sm text-zinc-700">
          Combined current value:{" "}
          <span className="font-semibold text-zinc-900">
            {formatCurrency(total, currencyCode)}
          </span>
        </p>
      </div>
      <ul className="divide-y divide-slate-200 border-t border-slate-200">
        {items.map((inv) => (
          <li key={inv.id}>
            <InvestmentRow investment={inv} currencyCode={currencyCode} />
          </li>
        ))}
      </ul>
    </section>
  );
}
