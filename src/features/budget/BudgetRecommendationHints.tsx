import { BUDGET_QUICK_PRESETS } from "@/features/budget/budget-quick-presets";

type Props = {
  monthlyIncome: number | null;
};

/**
 * Soft, optional hints — never blocks the user.
 */
export function BudgetRecommendationHints({ monthlyIncome }: Props) {
  const withRange = BUDGET_QUICK_PRESETS.filter((p) => p.typicalRangeLabel);
  return (
    <aside className="rounded-2xl border border-teal-100/80 bg-linear-to-br from-teal-50/40 via-white to-zinc-50/60 p-4 text-xs text-zinc-700 shadow-sm dark:border-teal-400/30 dark:from-slate-950 dark:via-slate-950 dark:to-teal-950/35 dark:text-slate-200 dark:shadow-black/25">
      <p className="font-semibold text-teal-950 dark:text-teal-100">
        Gentle benchmarks
      </p>
      <ul className="mt-2 space-y-2 leading-relaxed">
        {withRange.map((p) => (
          <li key={p.id}>
            <span className="font-medium text-zinc-800 dark:text-slate-50">
              {p.label}:
            </span>{" "}
            {p.typicalRangeLabel}
          </li>
        ))}
        {monthlyIncome != null && monthlyIncome > 0 ? (
          <li>
            <span className="font-medium text-zinc-800 dark:text-slate-50">
              Savings nudge:
            </span>{" "}
            With your stated income, aiming near{" "}
            {Math.round(monthlyIncome * 0.2).toLocaleString("en-SG")} / month to
            savings is a common starting point — adjust freely.
          </li>
        ) : (
          <li className="text-zinc-500 dark:text-slate-400">
            Add monthly income in Setup → Profile for income-aware suggestions
            in quick add.
          </li>
        )}
        <li className="rounded-lg bg-white/60 px-2 py-1.5 text-[11px] text-zinc-500 dark:bg-slate-900/85 dark:text-slate-300 dark:ring-1 dark:ring-slate-700/70">
          AI recommendations: Coming soon · Adaptive budgets: Coming soon
        </li>
      </ul>
    </aside>
  );
}
