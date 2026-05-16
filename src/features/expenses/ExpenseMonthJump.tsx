"use client";

import { useRouter } from "next/navigation";
import { useRef, useTransition } from "react";
import { BlockingSubmitOverlay } from "@/ui/BlockingSubmitOverlay";

type Props = {
  category?: string;
  month: string;
};

export function ExpenseMonthJump({ category, month }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [pending, startTransition] = useTransition();

  function openMonthPicker() {
    const input = inputRef.current;
    if (!input) return;
    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }
    input.click();
  }

  return (
    <span className="relative inline-flex">
      <BlockingSubmitOverlay active={pending} message="Loading month…" />
      <button
        type="button"
        aria-label={`Jump to expense month, currently ${month}`}
        disabled={pending}
        className="w-[7.5rem] cursor-pointer rounded-full border border-transparent bg-transparent px-2 py-1 text-center font-medium text-zinc-800 outline-none transition hover:border-zinc-200 hover:bg-white focus:border-emerald-500/40 focus:bg-white focus:ring-2 focus:ring-emerald-500/15 disabled:cursor-wait disabled:opacity-60"
        onClick={openMonthPicker}
      >
        {month}
      </button>
      <input
        ref={inputRef}
        key={month}
        type="month"
        aria-hidden="true"
        tabIndex={-1}
        defaultValue={month}
        disabled={pending}
        className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
        onChange={(e) => {
          const nextMonth = e.target.value;
          if (!nextMonth) return;
          const params = new URLSearchParams({ month: nextMonth });
          if (category) params.set("category", category);
          startTransition(() => {
            router.push(`/expenses?${params.toString()}`);
          });
        }}
      />
    </span>
  );
}
