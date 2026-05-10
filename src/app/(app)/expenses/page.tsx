import Link from "next/link";
import { num, sumPlannedMonthlyGoalContributions } from "@/data/mappers";
import {
  listBudgetLineOverridesForMonth,
  overridesToLineIdMap,
} from "@/data/repositories/budget-line-overrides";
import { listBudgetLines } from "@/data/repositories/budget-lines";
import { spendRecommendationsForUserMonth } from "@/data/spend-recommendations-from-month";
import { listExpensesForMonth } from "@/data/repositories/expenses";
import { listFinancialGoals } from "@/data/repositories/goals";
import { getProfileById } from "@/data/repositories/profiles";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { BudgetLineExpenseQuickAdd } from "@/features/budget/BudgetLineExpenseQuickAdd";
import { CategoryBarChart } from "@/features/expenses/CategoryBarChart";
import { ExpenseEditRow } from "@/features/expenses/ExpenseEditRow";
import { ExpenseForm } from "@/features/expenses/ExpenseForm";
import { MethodologyOpenLink } from "@/features/help/MethodologyOpenLink";
import { SpendingRouteNav } from "@/features/spend/SpendingRouteNav";
import { SpendGuidancePanel } from "@/features/spend/SpendGuidancePanel";
import { isMonthlyBudgetLineApplicable, normalizeCategory } from "@/domain/finance/budget";
import {
  activeMonthlyBudgetCategoryKeys,
  monthlyExpensesForBudgetCategory,
} from "@/domain/finance/expense-budget-lock";
import {
  addMonthsToYearMonth,
  defaultExpenseDateForBudgetMonth,
  formatYearMonth,
  parseYearMonth,
  yearFromYearMonth,
} from "@/lib/dates";
import { DEFAULT_BASE_CURRENCY } from "@/lib/currency";
import { isSupabaseConfigured } from "@/lib/env";
import { appInlineLinkClass } from "@/ui/app-link-styles";
import {
  appTabPillClass,
  appTabPillInactiveClass,
  appTabRailClass,
} from "@/ui/app-tab-styles";
import { PageSection } from "@/ui/PageSection";
import { formatCurrency } from "@/ui/lib/format";

type PageProps = {
  searchParams: Promise<{ month?: string; category?: string }>;
};

export default async function ExpensesPage({ searchParams }: PageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <p className="text-sm text-zinc-600">
        Configure Supabase environment variables to use expenses.
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
        <h1 className="text-2xl font-semibold">Expenses</h1>
        <Link href="/login" className={`text-sm ${appInlineLinkClass}`}>
          Sign in
        </Link>
      </div>
    );
  }

  const sp = await searchParams;
  const month =
    sp.month && parseYearMonth(sp.month)
      ? sp.month
      : formatYearMonth(new Date());
  const categoryPrefill =
    typeof sp.category === "string" && sp.category.trim() !== ""
      ? sp.category.trim()
      : undefined;

  const [expenses, budgetLines, budgetOverrideRows, profile, goals] =
    await Promise.all([
      listExpensesForMonth(supabase, user.id, month),
      listBudgetLines(supabase, user.id),
      listBudgetLineOverridesForMonth(supabase, user.id, month),
      getProfileById(supabase, user.id),
      listFinancialGoals(supabase, user.id),
    ]);
  const plannedGoalMonthlyTotal = sumPlannedMonthlyGoalContributions(goals);
  const currency = profile?.base_currency ?? DEFAULT_BASE_CURRENCY;
  const total = expenses.reduce((acc, e) => acc + num(e.amount), 0);
  const budgetOverrideByLineId = overridesToLineIdMap(budgetOverrideRows);
  const monthlyBudgetShortcuts = budgetLines
    .filter((l) => l.cadence === "monthly")
    .filter((l) =>
      isMonthlyBudgetLineApplicable(
        month,
        l.start_year_month ?? null,
        l.end_year_month ?? null
      )
    )
    .map((l) => ({
      lineId: l.id,
      category: l.category,
      planned:
        budgetOverrideByLineId[l.id] !== undefined
          ? budgetOverrideByLineId[l.id]!
          : num(l.amount),
    }));

  const byCategory = new Map<string, number>();
  for (const e of expenses) {
    const c = e.category || "uncategorized";
    byCategory.set(c, (byCategory.get(c) ?? 0) + num(e.amount));
  }
  const chartData = [...byCategory.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  const budgetCategoryKeys = activeMonthlyBudgetCategoryKeys(
    budgetLines,
    month
  );
  const blockedNormalizedCategoryKeys = [...budgetCategoryKeys].filter(
    (key) => monthlyExpensesForBudgetCategory(expenses, key).length > 0
  );
  const categoryPrefillBlocked =
    categoryPrefill !== undefined &&
    blockedNormalizedCategoryKeys.includes(
      normalizeCategory(categoryPrefill)
    );

  const prevMonth = addMonthsToYearMonth(month, -1);
  const nextMonth = addMonthsToYearMonth(month, 1);
  const catQs = categoryPrefill
    ? `&category=${encodeURIComponent(categoryPrefill)}`
    : "";
  const defaultDate = defaultExpenseDateForBudgetMonth(month);

  const spendRecommendations = spendRecommendationsForUserMonth({
    expenses,
    budgetLineRows: budgetLines,
    overrideByLineId: budgetOverrideByLineId,
    yearMonth: month,
    profile,
    monthlyPlannedGoalContributions: plannedGoalMonthlyTotal,
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Expenses</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Month <span className="font-medium text-zinc-800">{month}</span>
            {categoryPrefill && (
              <>
                {" "}
                · category{" "}
                <span className="font-medium text-zinc-800">
                  {categoryPrefill}
                </span>
              </>
            )}
          </p>
          <p className="mt-1 max-w-xl text-xs text-zinc-500">
            Custom categories first (any name, multiple entries). Budget
            shortcuts below are optional for planned lines.
          </p>
          <p className="mt-2 text-xs text-zinc-500">
            <MethodologyOpenLink
              topicId="expenses-month"
              className="text-zinc-500 underline decoration-zinc-300/90 underline-offset-2 transition-colors hover:text-zinc-700"
            >
              How this month view works
            </MethodologyOpenLink>
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link
            className="text-zinc-600 hover:text-zinc-900"
            href={`/expenses?month=${prevMonth}${catQs}`}
          >
            Previous month
          </Link>
          <Link
            className="text-zinc-600 hover:text-zinc-900"
            href={`/expenses?month=${nextMonth}${catQs}`}
          >
            Next month
          </Link>
        </div>
      </div>

      <div className="space-y-4">
        <SpendingRouteNav
          active="expenses"
          month={month}
          budgetCalendarYear={yearFromYearMonth(month)}
          category={categoryPrefill}
        />
        <nav aria-label="On this page" className="sm:mx-0">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            On this page
          </p>
          <div className="-mx-1 overflow-x-auto px-1 pb-0.5 scroll-smooth sm:mx-0 sm:overflow-visible sm:px-0 sm:pb-0">
            <div className={appTabRailClass}>
              <a
                href="#expenses-form"
                className={`${appTabPillClass} ${appTabPillInactiveClass}`}
              >
                Add expense
              </a>
              {monthlyBudgetShortcuts.length > 0 && (
                <a
                  href="#expenses-budget-shortcuts"
                  className={`${appTabPillClass} ${appTabPillInactiveClass}`}
                >
                  From budget
                </a>
              )}
              <a
                href="#expenses-list"
                className={`${appTabPillClass} ${appTabPillInactiveClass}`}
              >
                This month
              </a>
              {spendRecommendations.length > 0 && (
                <a
                  href="#expenses-guidance"
                  className={`${appTabPillClass} ${appTabPillInactiveClass}`}
                >
                  Spending guidance
                </a>
              )}
              <a
                href="#expenses-chart"
                className={`${appTabPillClass} ${appTabPillInactiveClass}`}
              >
                By category
              </a>
            </div>
          </div>
        </nav>
      </div>

      <PageSection id="expenses-form" title="Add expense" className="scroll-mt-4">
      {categoryPrefillBlocked ? (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
          <p className="font-medium text-zinc-900">
            This category is already logged for {month}
          </p>
          <p className="mt-1 text-xs text-zinc-600">
            Use <strong>Edit</strong> in the budget list below, or add a{" "}
            <strong>custom</strong> expense with a different category name.
          </p>
          <Link
            href={`/expenses?month=${encodeURIComponent(month)}`}
            className={`mt-3 inline-block text-sm ${appInlineLinkClass}`}
          >
            Open custom expense form
          </Link>
        </div>
      ) : (
        <ExpenseForm
          key={`${month}-${categoryPrefill ?? ""}`}
          defaultDate={defaultDate}
          defaultCategory={categoryPrefill}
          blockedNormalizedCategoryKeys={blockedNormalizedCategoryKeys}
        />
      )}
      </PageSection>

      {monthlyBudgetShortcuts.length > 0 && (
        <PageSection
          id="expenses-budget-shortcuts"
          className="scroll-mt-4 space-y-3"
          title={`From your monthly budget (${month})`}
          description={
            <span className="text-xs text-zinc-600">
              One end-of-month entry per budget category (monthly spend type).
              After you log actuals, use Edit or Delete here; add again only after
              deleting. For anything else, use <strong>Custom expenses</strong>{" "}
              above.{" "}
              <MethodologyOpenLink topicId="monthly-budget-check" className={appInlineLinkClass}>
                How budget lock works →
              </MethodologyOpenLink>
            </span>
          }
        >
          <ul className="space-y-3">
            {monthlyBudgetShortcuts.map((s) => {
              const catKey = normalizeCategory(s.category);
              const logged = monthlyExpensesForBudgetCategory(
                expenses,
                catKey
              );
              const actualTotal = logged.reduce(
                (acc, e) => acc + num(e.amount),
                0
              );
              const categoryOver = actualTotal > s.planned;
              const categoryOverBy = Math.max(0, actualTotal - s.planned);
              const categoryRemaining = s.planned - actualTotal;
              return (
                <li
                  key={s.lineId}
                  className="rounded-md border border-zinc-100 bg-zinc-50/50 px-3 py-2"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium capitalize text-zinc-900">
                      {s.category}
                    </span>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                      <span>
                        Planned{" "}
                        <span className="font-medium text-zinc-700">
                          {formatCurrency(s.planned, currency)}
                        </span>
                      </span>
                      {logged.length > 0 && (
                        <>
                          <span>
                            Actual{" "}
                            <span
                              className={
                                categoryOver
                                  ? "font-medium text-red-700"
                                  : "font-medium text-zinc-700"
                              }
                            >
                              {formatCurrency(actualTotal, currency)}
                            </span>
                          </span>
                          {categoryOver ? (
                            <span className="font-medium text-red-700">
                              Over by{" "}
                              {formatCurrency(categoryOverBy, currency)}
                            </span>
                          ) : (
                            <span className="text-zinc-600">
                              Remaining{" "}
                              {formatCurrency(categoryRemaining, currency)}
                            </span>
                          )}
                        </>
                      )}
                      {logged.length === 0 && (
                        <Link
                          href={`/expenses?month=${encodeURIComponent(month)}&category=${encodeURIComponent(s.category)}`}
                          className={appInlineLinkClass}
                        >
                          Full form
                        </Link>
                      )}
                    </div>
                  </div>
                  {logged.length === 0 ? (
                    <BudgetLineExpenseQuickAdd
                      category={s.category}
                      yearMonth={month}
                      defaultSpentAt={defaultDate}
                      suggestedAmount={s.planned}
                      compact
                    />
                  ) : (
                    <div className="mt-2 space-y-2">
                      <p
                        className={
                          categoryOver
                            ? "text-xs font-medium text-red-800"
                            : "text-xs font-medium text-emerald-800"
                        }
                      >
                        {categoryOver
                          ? `Over planned for ${month} by ${formatCurrency(
                              categoryOverBy,
                              currency
                            )}. Edit or delete below to adjust.`
                          : `Recorded for ${month}. Edit or delete to change.`}
                      </p>
                      {logged.map((e) => (
                        <ExpenseEditRow
                          key={e.id}
                          expense={e}
                          currency={currency}
                        />
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </PageSection>
      )}

      <PageSection
        id="expenses-list"
        className="scroll-mt-4"
        title="This month"
        description={
          <span className="text-xs text-zinc-600">
            Edit or delete any row. Budget categories allow at most one monthly
            entry per month.{" "}
            <MethodologyOpenLink topicId="expenses-month" className={appInlineLinkClass}>
              Month filter details →
            </MethodologyOpenLink>
          </span>
        }
      >
        {expenses.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No rows yet.</p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-md border border-zinc-200">
            <div className="sticky top-0 z-10 border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-700">
              {expenses.length}{" "}
              {expenses.length === 1 ? "entry" : "entries"}
            </div>
            <div className="max-h-[min(60vh,36rem)] overflow-y-auto px-2 py-2">
              <ul className="space-y-2 divide-y divide-zinc-100">
                {expenses.map((e) => (
                  <li key={e.id} className="pt-2 first:pt-0">
                    <ExpenseEditRow expense={e} currency={currency} />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </PageSection>

      {spendRecommendations.length > 0 && (
        <PageSection
          id="expenses-guidance"
          className="scroll-mt-4"
          title="Spending guidance"
          description={
            <MethodologyOpenLink topicId="spend-guidance" className={appInlineLinkClass}>
              How spending guidance is built →
            </MethodologyOpenLink>
          }
        >
          <SpendGuidancePanel month={month} lines={spendRecommendations} />
        </PageSection>
      )}

      <PageSection
        id="expenses-chart"
        className="scroll-mt-4"
        title="By category"
        actions={
          <p className="text-sm text-zinc-600">
            Total:{" "}
            <span className="font-medium text-zinc-900">
              {formatCurrency(total, currency)}
            </span>
          </p>
        }
      >
        {chartData.length ? (
          <CategoryBarChart data={chartData} currency={currency} />
        ) : (
          <p className="text-sm text-zinc-500">No expenses this month yet.</p>
        )}
      </PageSection>
    </div>
  );
}
