import Link from "next/link";
import { getBudgetPageModel } from "@/data/budget-summary";
import { spendRecommendationsForUserMonth } from "@/data/spend-recommendations-from-month";
import { num, sumPlannedMonthlyGoalContributions } from "@/data/mappers";
import { listFinancialGoals } from "@/data/repositories/goals";
import { getProfileById } from "@/data/repositories/profiles";
import { createSupabaseServerClient } from "@/data/supabase/server";
import type { BudgetLineRow } from "@/data/supabase/types";
import { BudgetAddForm } from "@/features/budget/BudgetAddForm";
import { BudgetLineActionsCollapsible } from "@/features/budget/BudgetLineActionsCollapsible";
import { BudgetLineScheduleForm } from "@/features/budget/BudgetLineScheduleForm";
import { MethodologyOpenLink } from "@/features/help/MethodologyOpenLink";
import { SpendGuidancePanel } from "@/features/spend/SpendGuidancePanel";
import {
  addMonthsToYearMonth,
  defaultExpenseDateForBudgetMonth,
  formatYearMonth,
  parseYearMonth,
} from "@/lib/dates";
import { DEFAULT_BASE_CURRENCY } from "@/lib/currency";
import { isSupabaseConfigured } from "@/lib/env";
import { deleteBudgetLineAction } from "@/server/actions";
import {
  isMonthlyBudgetLineApplicable,
  monthlyBudgetAggregateOverspend,
  normalizeCategory,
  type BudgetVsActualResult,
} from "@/domain/finance/budget";
import { monthlyExpensesForBudgetCategory } from "@/domain/finance/expense-budget-lock";
import { appInlineLinkClass } from "@/ui/app-link-styles";
import { PageSection } from "@/ui/PageSection";
import { formatCurrency } from "@/ui/lib/format";

function varianceForLine(
  result: BudgetVsActualResult,
  line: BudgetLineRow
) {
  const key = normalizeCategory(line.category);
  return result.lines.find((v) => v.categoryKey === key);
}

type PageProps = {
  searchParams: Promise<{ month?: string; year?: string }>;
};

export default async function BudgetPage({ searchParams }: PageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <p className="text-sm text-zinc-600">
        Configure Supabase and run migrations (including budget_lines) to use
        budgets.
      </p>
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Budget</h1>
        <Link href="/login" className={`text-sm ${appInlineLinkClass}`}>
          Sign in
        </Link>
      </div>
    );
  }

  const sp = await searchParams;
  const month =
    sp.month && parseYearMonth(sp.month) ? sp.month : formatYearMonth(new Date());
  const yearParsed = sp.year != null ? Number(sp.year) : NaN;
  const calendarYear =
    Number.isFinite(yearParsed) && yearParsed >= 2000 && yearParsed <= 2100
      ? yearParsed
      : new Date().getFullYear();

  const [model, profile, goals] = await Promise.all([
    getBudgetPageModel(supabase, user.id, month, calendarYear),
    getProfileById(supabase, user.id),
    listFinancialGoals(supabase, user.id),
  ]);
  const plannedGoalMonthlyTotal = sumPlannedMonthlyGoalContributions(goals);
  const currency = profile?.base_currency ?? DEFAULT_BASE_CURRENCY;

  const monthlyAll = model.lineRows.filter((l) => l.cadence === "monthly");
  const activeMonthly = monthlyAll.filter((l) =>
    isMonthlyBudgetLineApplicable(
      month,
      l.start_year_month ?? null,
      l.end_year_month ?? null
    )
  );
  const inactiveMonthly = monthlyAll.filter(
    (l) =>
      !isMonthlyBudgetLineApplicable(
        month,
        l.start_year_month ?? null,
        l.end_year_month ?? null
      )
  );
  const annualRows = model.lineRows.filter(
    (l) =>
      l.cadence === "annual" &&
      Number(l.calendar_year) === calendarYear
  );

  const prevMonth = addMonthsToYearMonth(month, -1);
  const nextMonth = addMonthsToYearMonth(month, 1);
  const expenseDateDefault = defaultExpenseDateForBudgetMonth(month);
  const unbudgetedMonthlyTotal = model.unbudgetedMonthlyExpenses.reduce(
    (acc, e) => acc + num(e.amount),
    0
  );
  const monthlyBudgetAgg = monthlyBudgetAggregateOverspend(
    model.monthly.totals
  );
  const showMonthlyVerdict =
    model.monthly.totals.budget > 0 || model.monthly.totals.spent > 0;

  const spendRecommendations = spendRecommendationsForUserMonth({
    expenses: model.monthExpenses,
    budgetLineRows: model.lineRows,
    overrideByLineId: model.overridesThisMonth,
    yearMonth: month,
    profile,
    monthlyPlannedGoalContributions: plannedGoalMonthlyTotal,
  });

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Budget</h1>
          <p className="mt-1 max-w-xl text-sm text-zinc-500">
            Monthly lines use a stable base amount; optional first/last month
            bounds (e.g. loan payoff). Use &quot;This month only&quot; for rare
            one-off changes. Annual lines use one calendar year and annual-tagged
            expenses.
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-600">
            <MethodologyOpenLink topicId="budget-lines" className={appInlineLinkClass}>
              How budget lines work →
            </MethodologyOpenLink>
            <MethodologyOpenLink
              topicId="monthly-budget-check"
              className={appInlineLinkClass}
            >
              How monthly totals work →
            </MethodologyOpenLink>
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link
            className="text-zinc-600 hover:text-zinc-900"
            href={`/budget?month=${prevMonth}&year=${calendarYear}`}
          >
            Previous month
          </Link>
          <span className="font-medium text-zinc-800">{month}</span>
          <Link
            className="text-zinc-600 hover:text-zinc-900"
            href={`/budget?month=${nextMonth}&year=${calendarYear}`}
          >
            Next month
          </Link>
        </div>
      </div>

      <nav
        className="flex flex-wrap gap-x-4 gap-y-1 border-b border-zinc-200 pb-3 text-sm text-zinc-600"
        aria-label="On this page"
      >
        <a href="#budget-add" className="hover:text-zinc-900 hover:underline">
          Add line
        </a>
        <a href="#budget-monthly" className="hover:text-zinc-900 hover:underline">
          Monthly
        </a>
        <a
          href="#budget-unbudgeted"
          className="hover:text-zinc-900 hover:underline"
        >
          Unbudgeted
        </a>
        <a href="#budget-annual" className="hover:text-zinc-900 hover:underline">
          Annual
        </a>
        {inactiveMonthly.length > 0 && (
          <a
            href="#budget-inactive"
            className="hover:text-zinc-900 hover:underline"
          >
            Inactive lines
          </a>
        )}
      </nav>

      <PageSection id="budget-add" title="Add a budget line" className="scroll-mt-4">
        <BudgetAddForm defaultYear={calendarYear} />
      </PageSection>

      <PageSection
        id="budget-monthly"
        className="scroll-mt-4 space-y-3"
        title={`Monthly budget (${month})`}
        description={
          <span className="text-xs text-zinc-600">
            Totals use expenses with spend type &quot;Monthly&quot; only. Use
            quick-add or the expenses page; categories must match (case
            insensitive).{" "}
            <MethodologyOpenLink topicId="monthly-budget-check" className={appInlineLinkClass}>
              How calculated →
            </MethodologyOpenLink>
          </span>
        }
        actions={
          <Link
            href={`/expenses?month=${encodeURIComponent(month)}`}
            className={`shrink-0 text-xs ${appInlineLinkClass}`}
          >
            Log expenses · {month}
          </Link>
        }
      >
        {spendRecommendations.length > 0 && (
          <div className="mb-1 flex justify-end">
            <MethodologyOpenLink topicId="spend-guidance" className="text-xs">
              How spending guidance is built →
            </MethodologyOpenLink>
          </div>
        )}
        <SpendGuidancePanel month={month} lines={spendRecommendations} />

        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <div className="max-h-[min(65vh,42rem)] overflow-x-auto overflow-y-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500 shadow-sm">
                <tr>
                  <th className="bg-zinc-50 px-3 py-2">Category</th>
                  <th className="bg-zinc-50 px-3 py-2">Planned</th>
                  <th className="bg-zinc-50 px-3 py-2">Spent</th>
                  <th className="bg-zinc-50 px-3 py-2">Remaining</th>
                  <th className="min-w-40 bg-zinc-50 px-3 py-2">Actions</th>
                </tr>
              </thead>
            <tbody>
              {monthlyAll.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-4 text-zinc-500"
                  >
                    No monthly budget lines yet.
                  </td>
                </tr>
              ) : activeMonthly.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-zinc-500">
                    No monthly lines apply in {month}. See below for lines
                    outside this month.
                  </td>
                </tr>
              ) : (
                activeMonthly.map((line) => {
                  const v = varianceForLine(model.monthly, line);
                  const base = num(line.amount);
                  const spent = v?.spent ?? 0;
                  const effective = v?.budget ?? base;
                  const remaining = v ? v.remaining : effective - spent;
                  const over = v?.over ?? false;
                  const loggedMonthly = monthlyExpensesForBudgetCategory(
                    model.monthExpenses,
                    normalizeCategory(line.category)
                  );
                  return (
                    <tr
                      key={line.id}
                      className="border-b border-zinc-100 align-top last:border-0"
                    >
                      <td className="px-3 py-2 font-medium capitalize text-zinc-800">
                        {line.category}
                        {(line.start_year_month || line.end_year_month) && (
                          <p className="mt-1 text-xs font-normal text-zinc-500">
                            {line.start_year_month
                              ? `From ${line.start_year_month}`
                              : ""}
                            {line.start_year_month && line.end_year_month
                              ? " · "
                              : ""}
                            {line.end_year_month
                              ? `Through ${line.end_year_month}`
                              : ""}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2 text-zinc-700">
                        <div>Base {formatCurrency(base, currency)}</div>
                        {model.overridesThisMonth[line.id] !== undefined && (
                          <div className="text-xs text-blue-700">
                            This month {formatCurrency(effective, currency)}
                          </div>
                        )}
                      </td>
                      <td
                        className={
                          over ? "px-3 py-2 font-medium text-red-700" : "px-3 py-2"
                        }
                      >
                        {formatCurrency(spent, currency)}
                      </td>
                      <td
                        className={
                          remaining < 0
                            ? "px-3 py-2 text-red-600"
                            : "px-3 py-2 text-zinc-700"
                        }
                      >
                        {formatCurrency(remaining, currency)}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <BudgetLineActionsCollapsible
                          variant="monthly"
                          currency={currency}
                          lineId={line.id}
                          category={line.category}
                          month={month}
                          baseAmount={base}
                          effectiveBudget={effective}
                          expenseDateDefault={expenseDateDefault}
                          overrideAmount={model.overridesThisMonth[line.id]}
                          startYearMonth={line.start_year_month}
                          endYearMonth={line.end_year_month}
                          loggedExpenses={loggedMonthly}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          </div>
        </div>
        <p className="text-xs text-zinc-500">
          Monthly planned total:{" "}
          <span className="font-medium text-zinc-800">
            {formatCurrency(model.monthly.totals.budget, currency)}
          </span>
          {" · "}
          Spent (budgeted categories):{" "}
          <span className="font-medium text-zinc-800">
            {formatCurrency(model.monthly.totals.spent, currency)}
          </span>
        </p>
        {showMonthlyVerdict && (
          <div
            className={
              monthlyBudgetAgg.onTrack
                ? "mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950"
                : "mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-950"
            }
          >
            {monthlyBudgetAgg.onTrack ? (
              <p className="font-medium">
                On plan: budgeted categories are within the monthly planned
                total (remaining{" "}
                {formatCurrency(model.monthly.totals.remaining, currency)}).
              </p>
            ) : (
              <p className="font-medium">
                Over planned total by{" "}
                {formatCurrency(monthlyBudgetAgg.overBy, currency)} for
                budgeted categories this month (
                {formatCurrency(model.monthly.totals.spent, currency)} spent vs{" "}
                {formatCurrency(model.monthly.totals.budget, currency)}{" "}
                planned).
              </p>
            )}
            {unbudgetedMonthlyTotal > 0 && (
              <p className="mt-2 text-xs text-zinc-700">
                Also{" "}
                {formatCurrency(unbudgetedMonthlyTotal, currency)} in unbudgeted
                monthly categories (see below)—not included in the verdict
                above.
              </p>
            )}
          </div>
        )}
      </PageSection>

      <PageSection
        id="budget-unbudgeted"
        className="scroll-mt-4 space-y-3"
        title={`Unbudgeted monthly spend (${month})`}
        description="Monthly spend with no matching active budget line this month (same category matching as the table above)."
        actions={
          <Link href={`/expenses?month=${encodeURIComponent(month)}`} className={`text-xs ${appInlineLinkClass}`}>
            Add expense
          </Link>
        }
      >
        {model.unbudgetedMonthlyExpenses.length === 0 ? (
          <p className="text-sm text-zinc-600">None this month.</p>
        ) : (
          <>
            <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
              <div className="max-h-[min(65vh,42rem)] overflow-x-auto overflow-y-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="sticky top-0 z-10 border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500 shadow-sm">
                    <tr>
                      <th className="bg-zinc-50 px-3 py-2">Category</th>
                      <th className="bg-zinc-50 px-3 py-2">Date</th>
                      <th className="bg-zinc-50 px-3 py-2">Amount</th>
                      <th className="bg-zinc-50 px-3 py-2">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                  {model.unbudgetedMonthlyExpenses.map((e) => (
                    <tr
                      key={e.id}
                      className="border-b border-zinc-100 last:border-0"
                    >
                      <td className="px-3 py-2 font-medium capitalize text-zinc-800">
                        {e.category}
                      </td>
                      <td className="px-3 py-2 text-zinc-600">{e.spent_at}</td>
                      <td className="px-3 py-2 text-zinc-800">
                        {formatCurrency(num(e.amount), currency)}
                      </td>
                      <td className="px-3 py-2 text-xs text-zinc-500">
                        {e.note ?? "—"}
                      </td>
                    </tr>
                  ))}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="text-xs text-zinc-500">
              Subtotal (unbudgeted monthly):{" "}
              <span className="font-medium text-zinc-800">
                {formatCurrency(unbudgetedMonthlyTotal, currency)}
              </span>
            </p>
          </>
        )}
      </PageSection>

      {inactiveMonthly.length > 0 && (
        <PageSection
          id="budget-inactive"
          className="scroll-mt-4 space-y-3"
          title={`Monthly lines not active in ${month}`}
          description="These lines do not apply in this month (before the first month or after the last/payoff month). Adjust the schedule or remove the line."
        >
          <ul className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4">
            {inactiveMonthly.map((line) => (
              <li
                key={line.id}
                className="border-b border-zinc-100 pb-4 last:border-0 last:pb-0"
              >
                <p className="font-medium capitalize text-zinc-800">
                  {line.category}{" "}
                  <span className="text-xs font-normal text-zinc-500">
                    Base {formatCurrency(num(line.amount), currency)}
                    {line.start_year_month
                      ? ` · from ${line.start_year_month}`
                      : ""}
                    {line.end_year_month
                      ? ` · through ${line.end_year_month}`
                      : ""}
                  </span>
                </p>
                <div className="mt-2 flex flex-wrap gap-3">
                  <BudgetLineScheduleForm
                    lineId={line.id}
                    startYearMonth={line.start_year_month}
                    endYearMonth={line.end_year_month}
                  />
                  <form action={deleteBudgetLineAction} className="self-end">
                    <input type="hidden" name="id" value={line.id} />
                    <button
                      type="submit"
                      className="text-xs text-red-600 hover:underline"
                    >
                      Remove line
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        </PageSection>
      )}

      <PageSection
        id="budget-annual"
        className="scroll-mt-4 space-y-3"
        title={`Annual budget (${calendarYear})`}
        description={
          <span className="text-xs text-zinc-600">
            Totals use expenses with spend type &quot;Annual&quot; and date in{" "}
            {calendarYear}.{" "}
            <MethodologyOpenLink topicId="budget-lines" className={appInlineLinkClass}>
              How annual lines work →
            </MethodologyOpenLink>
          </span>
        }
        actions={
          <div className="flex gap-3 text-sm">
            <Link
              className="text-zinc-600 hover:text-zinc-900"
              href={`/budget?month=${month}&year=${calendarYear - 1}`}
            >
              Previous year
            </Link>
            <Link
              className="text-zinc-600 hover:text-zinc-900"
              href={`/budget?month=${month}&year=${calendarYear + 1}`}
            >
              Next year
            </Link>
          </div>
        }
      >
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
          <div className="max-h-[min(65vh,42rem)] overflow-x-auto overflow-y-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500 shadow-sm">
                <tr>
                  <th className="bg-zinc-50 px-3 py-2">Category</th>
                  <th className="bg-zinc-50 px-3 py-2">Budget</th>
                  <th className="bg-zinc-50 px-3 py-2">Spent</th>
                  <th className="bg-zinc-50 px-3 py-2">Remaining</th>
                  <th className="bg-zinc-50 px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
              {annualRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-zinc-500">
                    No annual budget lines for {calendarYear}.
                  </td>
                </tr>
              ) : (
                annualRows.map((line) => {
                  const v = varianceForLine(model.annual, line);
                  const budget = num(line.amount);
                  const spent = v?.spent ?? 0;
                  const remaining = v?.remaining ?? budget;
                  const over = v?.over ?? false;
                  return (
                    <tr
                      key={line.id}
                      className="border-b border-zinc-100 last:border-0"
                    >
                      <td className="px-3 py-2 font-medium capitalize text-zinc-800">
                        {line.category}
                      </td>
                      <td className="px-3 py-2 text-zinc-700">
                        {formatCurrency(budget, currency)}
                      </td>
                      <td
                        className={
                          over ? "px-3 py-2 font-medium text-red-700" : "px-3 py-2"
                        }
                      >
                        {formatCurrency(spent, currency)}
                      </td>
                      <td
                        className={
                          remaining < 0
                            ? "px-3 py-2 text-red-600"
                            : "px-3 py-2 text-zinc-700"
                        }
                      >
                        {formatCurrency(remaining, currency)}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <BudgetLineActionsCollapsible
                          variant="annual"
                          currency={currency}
                          lineId={line.id}
                          budgetAmount={budget}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-xs text-zinc-500">
          Annual planned total:{" "}
          <span className="font-medium text-zinc-800">
            {formatCurrency(model.annual.totals.budget, currency)}
          </span>
          {" · "}
          Spent:{" "}
          <span className="font-medium text-zinc-800">
            {formatCurrency(model.annual.totals.spent, currency)}
          </span>
        </p>
      </PageSection>
    </div>
  );
}
