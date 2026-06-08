import Link from "next/link";
import type { BudgetLineRow, ExpenseRow } from "@/data/supabase/types";
import { BudgetLineActionsCollapsible } from "@/features/budget/BudgetLineActionsCollapsible";
import { budgetCategoryEmoji } from "@/features/budget/budget-category-icons";
import {
  budgetBucketForCategoryLabel,
  type BudgetSpendBucket,
} from "@/domain/finance/budget-guided-setup";
import {
  isMonthlyBudgetLineApplicable,
  normalizeCategory,
  type BudgetVsActualResult,
} from "@/domain/finance/budget";
import { isSetupInvestmentsBudgetLine } from "@/domain/finance/budget-cash-flow-allocation";
import { monthlyExpensesForBudgetCategory } from "@/domain/finance/expense-budget-lock";
import { num } from "@/data/mappers";
import { appInlineLinkClass } from "@/ui/app-link-styles";
import { formatCurrency } from "@/ui/lib/format";

const BUCKET_ORDER: BudgetSpendBucket[] = ["needs", "wants", "savings"];

const BUCKET_LABEL: Record<BudgetSpendBucket, string> = {
  needs: "Needs — essentials & stability",
  wants: "Wants — lifestyle & fun",
  savings: "Savings — future you",
};

function varianceForLine(result: BudgetVsActualResult, line: BudgetLineRow) {
  const key = normalizeCategory(line.category);
  return result.lines.find((v) => v.categoryKey === key);
}

type RowProps = {
  line: BudgetLineRow;
  month: string;
  currency: string;
  monthly: BudgetVsActualResult;
  overridesThisMonth: Record<string, number>;
  expenseDateDefault: string;
  monthExpenses: ExpenseRow[];
};

function MonthlyLineRowDesktop({
  line,
  month,
  currency,
  monthly,
  overridesThisMonth,
  expenseDateDefault,
  monthExpenses,
}: RowProps) {
  const v = varianceForLine(monthly, line);
  const base = num(line.amount);
  const spent = v?.spent ?? 0;
  const effective = v?.budget ?? base;
  const remaining = v ? v.remaining : effective - spent;
  const over = v?.over ?? false;
  const loggedMonthly = monthlyExpensesForBudgetCategory(
    monthExpenses,
    normalizeCategory(line.category)
  );
  const emoji = budgetCategoryEmoji(line.category);
  const isSetupInvestment = isSetupInvestmentsBudgetLine(line.id);

  return (
    <tr className="border-b border-zinc-100 align-top transition-colors hover:bg-teal-50/20 last:border-0">
      <td className="px-3 py-3">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 text-lg" aria-hidden>
            {emoji}
          </span>
          <div>
            <span className="font-medium capitalize text-zinc-900">
              {line.category}
            </span>
            {(line.start_year_month || line.end_year_month) && (
              <p className="mt-1 text-xs font-normal text-zinc-500">
                {line.start_year_month ? `From ${line.start_year_month}` : ""}
                {line.start_year_month && line.end_year_month ? " · " : ""}
                {line.end_year_month ? `Through ${line.end_year_month}` : ""}
              </p>
            )}
          </div>
        </div>
      </td>
      <td className="px-3 py-3 text-zinc-700">
        <div>
          {isSetupInvestment ? "Setup" : "Base"} {formatCurrency(base, currency)}
        </div>
        {overridesThisMonth[line.id] !== undefined && (
          <div className="text-xs text-teal-800">
            This month {formatCurrency(effective, currency)}
          </div>
        )}
      </td>
      <td
        className={
          over ? "px-3 py-3 font-medium text-red-700" : "px-3 py-3 text-zinc-800"
        }
      >
        {formatCurrency(spent, currency)}
      </td>
      <td
        className={
          remaining < 0
            ? "px-3 py-3 text-red-600"
            : "px-3 py-3 text-zinc-700"
        }
      >
        {formatCurrency(remaining, currency)}
      </td>
      <td className="px-3 py-3 align-top">
        {isSetupInvestment ? (
          <Link
            href="/setup?tab=investments#add-investment"
            className={`text-xs font-medium ${appInlineLinkClass}`}
          >
            Setup → Investments
          </Link>
        ) : (
          <BudgetLineActionsCollapsible
            variant="monthly"
            currency={currency}
            lineId={line.id}
            category={line.category}
            month={month}
            baseAmount={base}
            effectiveBudget={effective}
            expenseDateDefault={expenseDateDefault}
            overrideAmount={overridesThisMonth[line.id]}
            startYearMonth={line.start_year_month}
            endYearMonth={line.end_year_month}
            loggedExpenses={loggedMonthly}
          />
        )}
      </td>
    </tr>
  );
}

function MonthlyLineCardMobile({
  line,
  month,
  currency,
  monthly,
  overridesThisMonth,
  expenseDateDefault,
  monthExpenses,
}: RowProps) {
  const v = varianceForLine(monthly, line);
  const base = num(line.amount);
  const spent = v?.spent ?? 0;
  const effective = v?.budget ?? base;
  const remaining = v ? v.remaining : effective - spent;
  const over = v?.over ?? false;
  const loggedMonthly = monthlyExpensesForBudgetCategory(
    monthExpenses,
    normalizeCategory(line.category)
  );
  const emoji = budgetCategoryEmoji(line.category);
  const isSetupInvestment = isSetupInvestmentsBudgetLine(line.id);

  return (
    <li className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <span className="text-xl" aria-hidden>
            {emoji}
          </span>
          <div className="min-w-0">
            <p className="font-semibold capitalize text-zinc-900">
              {line.category}
            </p>
            {(line.start_year_month || line.end_year_month) && (
              <p className="mt-0.5 text-xs text-zinc-500">
                {line.start_year_month ? `From ${line.start_year_month}` : ""}
                {line.start_year_month && line.end_year_month ? " · " : ""}
                {line.end_year_month ? `Through ${line.end_year_month}` : ""}
              </p>
            )}
          </div>
        </div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-zinc-50 px-2 py-1.5">
          <dt className="text-zinc-500">Planned</dt>
          <dd className="font-medium text-zinc-900">
            {formatCurrency(base, currency)}
            {isSetupInvestment && (
              <span className="mt-0.5 block text-[11px] font-normal text-teal-800">
                From setup
              </span>
            )}
            {overridesThisMonth[line.id] !== undefined && (
              <span className="mt-0.5 block text-[11px] font-normal text-teal-800">
                This month {formatCurrency(effective, currency)}
              </span>
            )}
          </dd>
        </div>
        <div className="rounded-lg bg-zinc-50 px-2 py-1.5">
          <dt className="text-zinc-500">Spent</dt>
          <dd
            className={
              over ? "font-semibold text-red-700" : "font-medium text-zinc-900"
            }
          >
            {formatCurrency(spent, currency)}
          </dd>
        </div>
        <div className="col-span-2 rounded-lg bg-zinc-50 px-2 py-1.5">
          <dt className="text-zinc-500">Remaining</dt>
          <dd
            className={
              remaining < 0
                ? "font-semibold text-red-600"
                : "font-medium text-zinc-900"
            }
          >
            {formatCurrency(remaining, currency)}
          </dd>
        </div>
      </dl>
      <div className="mt-3 border-t border-zinc-100 pt-3">
        {isSetupInvestment ? (
          <Link
            href="/setup?tab=investments#add-investment"
            className={`text-xs font-medium ${appInlineLinkClass}`}
          >
            Setup → Investments
          </Link>
        ) : (
          <BudgetLineActionsCollapsible
            variant="monthly"
            currency={currency}
            lineId={line.id}
            category={line.category}
            month={month}
            baseAmount={base}
            effectiveBudget={effective}
            expenseDateDefault={expenseDateDefault}
            overrideAmount={overridesThisMonth[line.id]}
            startYearMonth={line.start_year_month}
            endYearMonth={line.end_year_month}
            loggedExpenses={loggedMonthly}
          />
        )}
      </div>
    </li>
  );
}

type SectionProps = {
  month: string;
  currency: string;
  monthly: BudgetVsActualResult;
  monthlyAll: BudgetLineRow[];
  activeMonthly: BudgetLineRow[];
  overridesThisMonth: Record<string, number>;
  expenseDateDefault: string;
  monthExpenses: ExpenseRow[];
  expensesHref: string;
};

export function BudgetMonthlyCategoriesSection({
  month,
  currency,
  monthly,
  monthlyAll,
  activeMonthly,
  overridesThisMonth,
  expenseDateDefault,
  monthExpenses,
  expensesHref,
}: SectionProps) {
  const byBucket = (bucket: BudgetSpendBucket) =>
    activeMonthly.filter(
      (l) => budgetBucketForCategoryLabel(l.category) === bucket
    );

  const rowProps = (line: BudgetLineRow): RowProps => ({
    line,
    month,
    currency,
    monthly,
    overridesThisMonth,
    expenseDateDefault,
    monthExpenses,
  });

  return (
    <div className="space-y-6">
      {monthlyAll.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50 px-4 py-6 text-center text-sm text-zinc-600">
          No monthly lines yet. Use quick add above or{" "}
          <a href="#budget-advanced-add" className={appInlineLinkClass}>
            advanced add
          </a>{" "}
          when you need full control.
        </p>
      ) : activeMonthly.length === 0 ? (
        <p className="rounded-2xl border border-amber-200/80 bg-amber-50/40 px-4 py-4 text-sm text-amber-950">
          Nothing applies in {month} — your lines may start later or already
          ended. Check inactive lines below or adjust schedules.
        </p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm md:block">
            <div className="max-h-[min(65vh,42rem)] overflow-x-auto overflow-y-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 z-10 border-b border-zinc-200 bg-zinc-50/95 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 shadow-sm backdrop-blur-sm">
                  <tr>
                    <th className="bg-zinc-50/95 px-3 py-3">Category</th>
                    <th className="bg-zinc-50/95 px-3 py-3">Planned</th>
                    <th className="bg-zinc-50/95 px-3 py-3">Spent</th>
                    <th className="bg-zinc-50/95 px-3 py-3">Left</th>
                    <th className="min-w-40 bg-zinc-50/95 px-3 py-3">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {BUCKET_ORDER.flatMap((bucket) => {
                    const lines = byBucket(bucket);
                    if (lines.length === 0) return [];
                    return [
                      <tr
                        key={`h-${bucket}`}
                        className="bg-linear-to-r from-zinc-100/90 to-zinc-50/80"
                      >
                        <td
                          colSpan={5}
                          className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-600"
                        >
                          {BUCKET_LABEL[bucket]}
                        </td>
                      </tr>,
                      ...lines.map((line) => (
                        <MonthlyLineRowDesktop
                          key={line.id}
                          {...rowProps(line)}
                        />
                      )),
                    ];
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="space-y-6 md:hidden">
            {BUCKET_ORDER.map((bucket) => {
              const lines = byBucket(bucket);
              if (lines.length === 0) return null;
              return (
                <div key={bucket} className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    {BUCKET_LABEL[bucket]}
                  </h4>
                  <ul className="space-y-3">
                    {lines.map((line) => (
                      <MonthlyLineCardMobile
                        key={line.id}
                        {...rowProps(line)}
                      />
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </>
      )}

      <p className="text-xs text-zinc-500">
        Monthly planned total:{" "}
        <span className="font-medium text-zinc-800">
          {formatCurrency(monthly.totals.budget, currency)}
        </span>
        {" · "}
        Spent (budgeted categories):{" "}
        <span className="font-medium text-zinc-800">
          {formatCurrency(monthly.totals.spent, currency)}
        </span>
        {" · "}
        <Link href={expensesHref} className={appInlineLinkClass}>
          Log expenses for {month}
        </Link>
      </p>
    </div>
  );
}

/** Lines that exist as monthly but do not apply this month (for parent sections). */
export function partitionMonthlyLines(
  month: string,
  monthlyAll: BudgetLineRow[]
) {
  const active = monthlyAll.filter((l) =>
    isMonthlyBudgetLineApplicable(
      month,
      l.start_year_month ?? null,
      l.end_year_month ?? null
    )
  );
  const inactive = monthlyAll.filter(
    (l) =>
      !isMonthlyBudgetLineApplicable(
        month,
        l.start_year_month ?? null,
        l.end_year_month ?? null
      )
  );
  return { active, inactive };
}
