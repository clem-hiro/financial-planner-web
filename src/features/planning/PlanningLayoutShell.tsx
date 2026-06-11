"use client";

import { PlanningSectionNav } from "@/features/planning/PlanningSectionNav";

export function PlanningLayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-8 sm:space-y-10">
      <div className="max-w-3xl space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
          Planning workspace
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-[#0c192f] dark:text-slate-50 sm:text-4xl">
          Modular financial planning
        </h1>
        <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300 sm:text-base">
          Organized by how you think — overview, cash flow, balance sheet, protection,
          and long-term decisions — without changing the underlying calculators.
        </p>
      </div>
      <PlanningSectionNav />
      <div className="pt-2 sm:pt-4">{children}</div>
    </div>
  );
}
