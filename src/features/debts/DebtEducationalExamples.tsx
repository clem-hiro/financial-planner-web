"use client";

import { useState } from "react";
import { formatCurrency } from "@/ui/lib/format";
import { estimateFlatRateMonthlyPayment } from "@/domain/finance/debt-repayment";

function ExampleToggle({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white/60 dark:border-slate-700/80 dark:bg-slate-900/80">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-xs font-medium text-slate-700 hover:bg-slate-50/80 dark:text-slate-100 dark:hover:bg-slate-800"
        aria-expanded={open}
      >
        <span>{title}</span>
        <span className="text-slate-400 dark:text-slate-300" aria-hidden>
          {open ? "−" : "+"}
        </span>
      </button>
      {open ? (
        <div className="border-t border-slate-100 px-3.5 py-3 text-xs leading-relaxed text-slate-600 dark:border-slate-700/80 dark:text-slate-300">
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function DebtEducationalExamples({
  currencyCode,
}: {
  currencyCode: string;
}) {
  const vehicleExample = estimateFlatRateMonthlyPayment(100_000, 0.02, 7 * 12);

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Learn as you plan
      </p>
      <ExampleToggle title="Property loans — reducing balance">
        <p>
          Property loans are usually amortized. Your monthly repayment stays
          relatively stable, but over time more of each payment goes toward
          principal and less toward interest.
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-slate-50 px-2 py-2 dark:bg-slate-800/80">
            <p className="text-[10px] uppercase text-slate-500 dark:text-slate-400">
              Repayment
            </p>
            <p className="mt-0.5 font-semibold text-slate-800 dark:text-slate-100">
              Stable
            </p>
          </div>
          <div className="rounded-lg bg-emerald-50/80 px-2 py-2 dark:bg-emerald-400/12">
            <p className="text-[10px] uppercase text-emerald-700 dark:text-emerald-200">
              Principal
            </p>
            <p className="mt-0.5 font-semibold text-emerald-900 dark:text-emerald-50">
              Grows
            </p>
          </div>
          <div className="rounded-lg bg-amber-50/80 px-2 py-2 dark:bg-amber-300/12">
            <p className="text-[10px] uppercase text-amber-700 dark:text-amber-200">
              Interest
            </p>
            <p className="mt-0.5 font-semibold text-amber-900 dark:text-amber-50">
              Shrinks
            </p>
          </div>
        </div>
      </ExampleToggle>

      <ExampleToggle title="Vehicle loans — flat rate">
        <p>
          Vehicle loans commonly use flat-rate interest: total interest is based
          on the original loan amount and tenure, then spread evenly each month.
        </p>
        <ul className="mt-2 space-y-1 text-slate-600 dark:text-slate-300">
          <li>Loan: {formatCurrency(100_000, currencyCode)}</li>
          <li>Rate: 2% per year · Tenure: 7 years</li>
          <li>
            Estimated monthly:{" "}
            <strong className="text-slate-800 dark:text-slate-50">
              ~
              {formatCurrency(vehicleExample ?? 1357, currencyCode)}
              /month
            </strong>
          </li>
        </ul>
      </ExampleToggle>

      <ExampleToggle title="Why this matters for future cash flow">
        <p>
          Debt is not only what you owe today — it is a monthly obligation until
          the loan ends. When a loan is paid off, that repayment drops to zero
          and your future cash flow improves.
        </p>
        <p className="mt-2 rounded-lg bg-emerald-50/70 px-2.5 py-2 text-emerald-900 dark:bg-emerald-400/12 dark:text-emerald-100">
          Example: once a car loan ends in 2032, monthly obligations may fall by
          about {formatCurrency(900, currencyCode)}/month — freeing cash for
          savings, goals, or lifestyle.
        </p>
      </ExampleToggle>
    </div>
  );
}
