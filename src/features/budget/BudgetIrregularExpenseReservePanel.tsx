import type { BudgetVsActualResult } from "@/domain/finance/budget";
import { buildIrregularExpenseReserves } from "@/domain/finance/irregular-expenses";
import { appInlineLinkClass } from "@/ui/app-link-styles";
import { appCardClass } from "@/ui/surface-classes";
import { formatCurrency } from "@/ui/lib/format";

export function BudgetIrregularExpenseReservePanel({
  annual,
  currency,
  month,
}: {
  annual: BudgetVsActualResult;
  currency: string;
  month: string;
}) {
  const reserves = buildIrregularExpenseReserves({
    annual,
    viewingMonth: month,
  });

  if (reserves.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-teal-200/80 bg-teal-50/40 p-5 text-sm text-slate-700 dark:border-teal-400/30 dark:bg-teal-950/25 dark:text-slate-200">
        <p className="font-semibold text-slate-950 dark:text-slate-50">
          Add annual or irregular costs to build a reserve plan
        </p>
        <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          Use this for insurance, road tax, school fees, holidays, quarterly
          bills, or annual subscriptions. The app will translate them into a
          simple monthly set-aside target.
        </p>
        <a href="#budget-advanced-add" className={`mt-3 inline-block ${appInlineLinkClass}`}>
          Add an irregular line
        </a>
      </div>
    );
  }

  const annualTotal = reserves.reduce((sum, row) => sum + row.annualBudget, 0);
  const monthlyReserveTotal = annualTotal / 12;
  const remainingTotal = reserves.reduce((sum, row) => sum + row.remaining, 0);
  const reserveNeededNow = reserves.reduce(
    (sum, row) => sum + row.reserveNeededPerRemainingMonth,
    0
  );

  return (
    <div className={`${appCardClass} overflow-hidden`}>
      <div className="grid gap-0 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="bg-linear-to-br from-cyan-50/90 via-white to-slate-50 px-5 py-6 dark:from-slate-950 dark:via-slate-950 dark:to-cyan-950/35 sm:px-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-200">
            Irregular expense reserve
          </p>
          <h3 className="mt-3 text-lg font-semibold tracking-tight text-slate-950 dark:text-slate-50">
            Set aside {formatCurrency(monthlyReserveTotal, currency)} per month
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Annual and irregular lines total{" "}
            {formatCurrency(annualTotal, currency)} for the year. Based on
            spending so far, the remaining reserve target is{" "}
            {formatCurrency(reserveNeededNow, currency)} per remaining month.
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl border border-white/80 bg-white/70 p-3 dark:border-slate-700 dark:bg-slate-900/70">
              <dt className="text-slate-500 dark:text-slate-400">Remaining this year</dt>
              <dd className="mt-1 font-semibold text-slate-950 dark:text-slate-50">
                {formatCurrency(remainingTotal, currency)}
              </dd>
            </div>
            <div className="rounded-xl border border-white/80 bg-white/70 p-3 dark:border-slate-700 dark:bg-slate-900/70">
              <dt className="text-slate-500 dark:text-slate-400">Lines tracked</dt>
              <dd className="mt-1 font-semibold text-slate-950 dark:text-slate-50">
                {reserves.length}
              </dd>
            </div>
          </dl>
        </div>

        <div className="overflow-x-auto px-5 py-6 dark:bg-slate-950 sm:px-6">
          <table className="min-w-full text-left text-sm">
            <thead className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <tr>
                <th className="py-2 pr-3">Category</th>
                <th className="px-3 py-2">Annual plan</th>
                <th className="px-3 py-2">Spent</th>
                <th className="px-3 py-2">Monthly reserve</th>
                <th className="py-2 pl-3">Catch-up reserve</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {reserves.map((row) => (
                <tr key={row.categoryKey}>
                  <td className="py-3 pr-3 font-medium capitalize text-slate-900 dark:text-slate-50">
                    {row.categoryLabel}
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className={
                          row.over
                            ? "h-full bg-red-500"
                            : "h-full bg-cyan-500"
                        }
                        style={{ width: `${Math.round(row.progressRatio * 100)}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-3 text-slate-700 dark:text-slate-300">
                    {formatCurrency(row.annualBudget, currency)}
                  </td>
                  <td
                    className={
                      row.over
                        ? "px-3 py-3 font-medium text-red-700 dark:text-red-300"
                        : "px-3 py-3 text-slate-700 dark:text-slate-300"
                    }
                  >
                    {formatCurrency(row.spent, currency)}
                  </td>
                  <td className="px-3 py-3 text-slate-700 dark:text-slate-300">
                    {formatCurrency(row.monthlySetAside, currency)}
                  </td>
                  <td className="py-3 pl-3 text-slate-700 dark:text-slate-300">
                    {formatCurrency(row.reserveNeededPerRemainingMonth, currency)}
                    <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                      {row.remainingMonthsInYear} months left
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
