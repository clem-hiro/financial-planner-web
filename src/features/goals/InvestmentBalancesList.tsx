"use client";

import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { updateInvestmentAction } from "@/server/actions";
import { formatCurrency } from "@/ui/lib/format";

export type InvestmentBalanceRow = {
  id: string;
  name: string;
  current_value: number;
  monthly_contribution: number;
  expected_annual_return: number;
};

const initial = { error: null as string | null };

function InvestmentUpdateRow({
  investment,
  currencyCode,
}: {
  investment: InvestmentBalanceRow;
  currencyCode: string;
}) {
  const router = useRouter();
  const wrapped = async (
    prev: typeof initial,
    formData: FormData
  ): Promise<typeof initial> => {
    const res = await updateInvestmentAction(prev, formData);
    if (res.error === null) {
      router.refresh();
    }
    return res;
  };
  const [state, formAction] = useActionState(wrapped, initial);

  return (
    <form action={formAction} className="py-4 first:pt-0 last:pb-0">
      <input type="hidden" name="id" value={investment.id} />
      {state.error && (
        <p className="mb-2 text-sm text-red-600" role="alert">
          {state.error}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-zinc-600">Account name</span>
          <input
            name="name"
            type="text"
            required
            defaultValue={investment.name}
            className="w-full rounded border border-zinc-300 px-2 py-1.5"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-600">
            Current value ({currencyCode})
          </span>
          <input
            name="current_value"
            type="number"
            min={0}
            step="0.01"
            required
            defaultValue={investment.current_value}
            className="w-full rounded border border-zinc-300 px-2 py-1.5"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-600">
            Monthly contribution ({currencyCode})
          </span>
          <input
            name="monthly_contribution"
            type="number"
            min={0}
            step="0.01"
            required
            defaultValue={investment.monthly_contribution}
            className="w-full rounded border border-zinc-300 px-2 py-1.5"
          />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-zinc-600">
            Expected annual return / interest (decimal, e.g. 0.07 for 7%)
          </span>
          <input
            name="expected_annual_return"
            type="number"
            min={0}
            max={1}
            step="0.001"
            required
            defaultValue={investment.expected_annual_return}
            className="w-full rounded border border-zinc-300 px-2 py-1.5"
          />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-zinc-500">
          Net worth and projections use this current value.
        </p>
        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Save
        </button>
      </div>
    </form>
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
        <h2 className="text-sm font-semibold text-zinc-900">
          Your accounts
        </h2>
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
      <ul className="divide-y divide-zinc-200 border-t border-zinc-200">
        {items.map((inv) => (
          <li key={inv.id}>
            <InvestmentUpdateRow investment={inv} currencyCode={currencyCode} />
          </li>
        ))}
      </ul>
    </section>
  );
}
