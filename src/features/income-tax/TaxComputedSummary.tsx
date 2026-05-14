import { buildSyntheticTaxExpense } from "@/data/income-tax-synthetic-expense";
import type { IncomeTaxConfigRow, ProfileRow } from "@/data/supabase/types";
import { appCardClass, appCardPadding } from "@/ui/surface-classes";
import { formatCurrency } from "@/ui/lib/format";

type Props = {
  profile: ProfileRow | null;
  config: IncomeTaxConfigRow | null;
  referenceYearMonth: string;
};

/**
 * Server component — calls `buildSyntheticTaxExpense` to reuse the same compute
 * path that feeds the dashboard/budget synthetic line. If the helper returns
 * `null` (missing inputs or zero net tax), we render a "what's missing" hint
 * instead of zero-stamped numbers.
 */
export function TaxComputedSummary({ profile, config, referenceYearMonth }: Props) {
  const synth = buildSyntheticTaxExpense(config, profile, referenceYearMonth);

  if (!synth) {
    return (
      <div className={`${appCardClass} ${appCardPadding}`}>
        <h3 className="text-sm font-semibold text-slate-900">Computed summary</h3>
        <p className="mt-2 text-sm text-slate-600">
          Fill in your monthly gross salary, birth date, and CPF age band on the
          Profile tab to see your computed tax burden.
        </p>
      </div>
    );
  }

  const b = synth.breakdown;
  const rows: Array<{ label: string; value: string; emphasis?: boolean }> = [
    { label: "Annual income", value: formatCurrency(b.annualIncomeSgd) },
    { label: "Earned-income relief", value: formatCurrency(b.earnedIncomeReliefSgd) },
    { label: "Mandatory CPF relief", value: formatCurrency(b.cpfReliefSgd) },
    { label: "Typed reliefs", value: formatCurrency(b.typedReliefsSgd) },
    {
      label: "Total reliefs (after $80k cap)",
      value: formatCurrency(b.totalReliefAfterCapSgd),
    },
    { label: "Chargeable income", value: formatCurrency(b.chargeableIncomeSgd) },
    { label: "Gross tax", value: formatCurrency(b.grossTaxSgd) },
    { label: "Rebate applied", value: formatCurrency(b.rebateAppliedSgd) },
    { label: "Net tax (annual)", value: formatCurrency(b.netTaxSgd), emphasis: true },
    {
      label:
        synth.expense.spendPeriod === "monthly"
          ? "Monthly GIRO"
          : "One-time payment",
      value: formatCurrency(synth.expense.amount),
      emphasis: true,
    },
  ];

  return (
    <div className={`${appCardClass} ${appCardPadding}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">Computed summary</h3>
        {b.reliefCapApplied ? (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
            $80k relief cap applied
          </span>
        ) : null}
      </div>
      <dl className="mt-4 space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-3">
            <dt className="text-sm text-slate-600">{r.label}</dt>
            <dd
              className={
                r.emphasis
                  ? "text-sm font-semibold text-slate-900"
                  : "text-sm text-slate-900"
              }
            >
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
      {b.reliefCapApplied ? (
        <p className="mt-3 text-xs text-amber-700">
          Total reliefs exceeded $80,000; the excess is disregarded by IRAS.
        </p>
      ) : null}
    </div>
  );
}
