"use client";

import Link from "next/link";
import { appInlineLinkClass } from "@/ui/app-link-styles";
import type { ExpenseRow } from "@/data/supabase/types";
import { deleteBudgetLineAction } from "@/server/actions";
import { BudgetLineExpenseQuickAdd } from "@/features/budget/BudgetLineExpenseQuickAdd";
import { BudgetLineScheduleForm } from "@/features/budget/BudgetLineScheduleForm";
import { BudgetMonthOverrideForm } from "@/features/budget/BudgetMonthOverrideForm";
import { BudgetUpdateAmountForm } from "@/features/budget/BudgetUpdateAmountForm";
import { ExpenseEditRow } from "@/features/expenses/ExpenseEditRow";

type MonthlyProps = {
  variant: "monthly";
  currency: string;
  lineId: string;
  category: string;
  month: string;
  baseAmount: number;
  effectiveBudget: number;
  expenseDateDefault: string;
  overrideAmount: number | undefined;
  startYearMonth: string | null | undefined;
  endYearMonth: string | null | undefined;
  loggedExpenses: ExpenseRow[];
};

type AnnualProps = {
  variant: "annual";
  currency: string;
  lineId: string;
  budgetAmount: number;
};

export function BudgetLineActionsCollapsible(
  props: MonthlyProps | AnnualProps
) {
  if (props.variant === "annual") {
    return (
      <details className="group">
        <summary className="flex min-h-10 cursor-pointer list-none items-center gap-1 text-xs font-medium text-teal-800 hover:underline [&::-webkit-details-marker]:hidden">
          <span className="inline-block transition-transform group-open:rotate-90">
            ▸
          </span>
          Edit category
        </summary>
        <div className="mt-2 flex flex-col gap-2 border-t border-zinc-100 pt-2 sm:flex-row sm:items-center">
          <BudgetUpdateAmountForm id={props.lineId} amount={props.budgetAmount} />
          <form action={deleteBudgetLineAction}>
            <input type="hidden" name="id" value={props.lineId} />
            <button
              type="submit"
              className="text-xs text-red-600 hover:underline"
            >
              Remove
            </button>
          </form>
        </div>
      </details>
    );
  }

  const p = props;
  return (
    <details className="group">
        <summary className="flex min-h-10 cursor-pointer list-none items-center gap-1 text-xs font-medium text-teal-800 hover:underline [&::-webkit-details-marker]:hidden">
          <span className="inline-block transition-transform group-open:rotate-90">
            ▸
          </span>
          Edit budget &amp; spending
        </summary>
      <div className="mt-2 space-y-2 border-t border-zinc-100 pt-2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <BudgetUpdateAmountForm id={p.lineId} amount={p.baseAmount} />
          <form action={deleteBudgetLineAction}>
            <input type="hidden" name="id" value={p.lineId} />
            <button
              type="submit"
              className="text-xs text-red-600 hover:underline"
            >
              Remove
            </button>
          </form>
        </div>
        <BudgetMonthOverrideForm
          lineId={p.lineId}
          yearMonth={p.month}
          baseAmount={p.baseAmount}
          overrideAmount={p.overrideAmount}
        />
        <BudgetLineScheduleForm
          lineId={p.lineId}
          startYearMonth={p.startYearMonth}
          endYearMonth={p.endYearMonth}
        />
        {p.loggedExpenses.length === 0 ? (
          <>
            <BudgetLineExpenseQuickAdd
              category={p.category}
              yearMonth={p.month}
              defaultSpentAt={p.expenseDateDefault}
              suggestedAmount={p.effectiveBudget}
            />
            <Link
              href={`/expenses?month=${encodeURIComponent(p.month)}&category=${encodeURIComponent(p.category)}`}
              className={`mt-1 inline-block text-xs ${appInlineLinkClass}`}
            >
              Full expense form (prefilled)
            </Link>
          </>
        ) : (
          <div className="mt-2 space-y-2">
            <p className="text-xs font-medium text-emerald-800">
              Monthly actual recorded — edit or delete to redo.
            </p>
            {p.loggedExpenses.map((e) => (
              <ExpenseEditRow key={e.id} expense={e} currency={p.currency} />
            ))}
          </div>
        )}
      </div>
    </details>
  );
}
