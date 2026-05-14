"use client";

import { useMethodology } from "@/features/help/methodology-context";

export function OpenMethodologyButton({
  label = "How it works",
  className,
  onBeforeOpen,
}: {
  label?: string;
  className?: string;
  /** Runs immediately before opening the methodology sheet (e.g. close a parent menu). */
  onBeforeOpen?: () => void;
}) {
  const { openMethodology } = useMethodology();
  return (
    <button
      type="button"
      onClick={() => {
        onBeforeOpen?.();
        openMethodology(null);
      }}
      className={
        className ??
        "inline-flex min-h-10 w-full items-center justify-center rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-[#0c192f] ring-1 ring-slate-200/80 transition hover:bg-white sm:min-h-0 sm:w-auto sm:rounded-full sm:py-2"
      }
    >
      {label}
    </button>
  );
}
