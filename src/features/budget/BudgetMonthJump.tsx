"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { yearFromYearMonth } from "@/lib/dates";

type Props = {
  month: string;
};

export function BudgetMonthJump({ month }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <label className="flex flex-wrap items-center gap-2 text-sm text-zinc-600">
      <span className="whitespace-nowrap">Go to</span>
      <input
        key={month}
        type="month"
        aria-label="Jump to budget month"
        defaultValue={month}
        disabled={pending}
        className="max-w-44 rounded border border-zinc-300 bg-white px-2 py-1.5 text-zinc-900 disabled:opacity-60"
        onChange={(e) => {
          const v = e.target.value;
          if (!v) return;
          const y = yearFromYearMonth(v);
          startTransition(() => {
            router.push(`/budget?month=${encodeURIComponent(v)}&year=${y}`);
          });
        }}
      />
    </label>
  );
}
