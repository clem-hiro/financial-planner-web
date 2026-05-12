import Link from "next/link";
import { getBudgetPageModel } from "@/data/budget-summary";
import { spendRecommendationsForUserMonth } from "@/data/spend-recommendations-from-month";
import { num, sumPlannedMonthlyGoalContributions, profileMonthlyIncome } from "@/data/mappers";
import { listFinancialGoals } from "@/data/repositories/goals";
import { getProfileById } from "@/data/repositories/profiles";
import { createSupabaseServerClient } from "@/data/supabase/server";
import type { BudgetLineRow } from "@/data/supabase/types";
import { BudgetAddForm } from "@/features/budget/BudgetAddForm";
import { BudgetLineActionsCollapsible } from "@/features/budget/BudgetLineActionsCollapsible";
import { BudgetLineScheduleForm } from "@/features/budget/BudgetLineScheduleForm";
import { BudgetStrategyInsightPanel } from "@/features/budget/BudgetStrategyInsightPanel";
import { BudgetPageHero } from "@/features/budget/BudgetPageHero";
import { BudgetQuickAddPresets } from "@/features/budget/BudgetQuickAddPresets";
import {
  BudgetMonthlyCategoriesSection,
  partitionMonthlyLines,
} from "@/features/budget/BudgetMonthlyCategoriesSection";
import { BudgetRecommendationHints } from "@/features/budget/BudgetRecommendationHints";
import { budgetCategoryEmoji } from "@/features/budget/budget-category-icons";
import { MethodologyOpenLink } from "@/features/help/MethodologyOpenLink";
import { SpendGuidancePanel } from "@/features/spend/SpendGuidancePanel";
import {
  addMonthsToYearMonth,
  defaultExpenseDateForBudgetMonth,
  formatYearMonth,
  parseYearMonth,
  yearFromYearMonth,
} from "@/lib/dates";
import { setupBudgetPath } from "@/lib/setup-urls";
import { DEFAULT_BASE_CURRENCY } from "@/lib/currency";
import { deleteBudgetLineAction } from "@/server/actions";
import {
  monthlyBudgetAggregateOverspend,
  normalizeCategory,
  type BudgetVsActualResult,
} from "@/domain/finance/budget";
import { appInlineLinkClass } from "@/ui/app-link-styles";
import {
  appTabPillClass,
  appTabPillInactiveClass,
  appTabRailClass,
} from "@/ui/app-tab-styles";
import { PageSection } from "@/ui/PageSection";
import { formatCurrency } from "@/ui/lib/format";

function varianceForLine(
  result: BudgetVsActualResult,
  line: BudgetLineRow
) {
  const key = normalizeCategory(line.category);
  return result.lines.find((v) => v.categoryKey === key);
}

export async function BudgetPlanningView({
  month: monthParam,
  calendarYear: calendarYearParam,
}: {
  month: string;
  calendarYear: number;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <p className="text-sm text-zinc-600">
        Sign in to manage your budget.
      </p>
    );
  }

  const month =
    monthParam && parseYearMonth(monthParam)
      ? monthParam
      : formatYearMonth(new Date());
  const calendarYear =
    Number.isFinite(calendarYearParam) &&
    calendarYearParam >= 2000 &&
    calendarYearParam <= 2100
      ? calendarYearParam
      : yearFromYearMonth(month);

  const [model, profile, goals] = await Promise.all([
    getBudgetPageModel(supabase, user.id, month, calendarYear),
    getProfileById(supabase, user.id),
    listFinancialGoals(supabase, user.id),
  ]);
  const plannedGoalMonthlyTotal = sumPlannedMonthlyGoalContributions(goals);
  const currency = profile?.base_currency ?? DEFAULT_BASE_CURRENCY;
  const monthlyIncome = profileMonthlyIncome(profile);

  const monthlyAll = model.lineRows.filter((l) => l.cadence === "monthly");
  const { active: activeMonthly, inactive: inactiveMonthly } =
    partitionMonthlyLines(month, monthlyAll);
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

  const expensesHref = `/expenses?month=${encodeURIComponent(month)}`;

  return (
    <div className="space-y-12 pb-16">
      <BudgetPageHero
        month={month}
        currency={currency}
        totals={model.monthly.totals}
        activeMonthlyLines={activeMonthly}
        prevMonth={prevMonth}
        nextMonth={nextMonth}
      />

      <nav aria-label="On this page" className="scroll-mt-4 sm:mx-0">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">
          Jump to
        </p>
        <div className="-mx-1 overflow-x-auto px-1 pb-0.5 scroll-smooth sm:mx-0 sm:overflow-visible sm:px-0 sm:pb-0">
          <div className={appTabRailClass}>
            <a
              href="#budget-plan-lens"
              className={`${appTabPillClass} ${appTabPillInactiveClass}`}
            >
              Needs / wants / savings
            </a>
            <a
              href="#budget-quick-add"
              className={`${appTabPillClass} ${appTabPillInactiveClass}`}
            >
              Quick add
            </a>
            <a
              href="#budget-monthly"
              className={`${appTabPillClass} ${appTabPillInactiveClass}`}
            >
              Your categories
            </a>
            <a
              href="#budget-guidance"
              className={`${appTabPillClass} ${appTabPillInactiveClass}`}
            >
              Guidance
            </a>
            <a
              href="#budget-unbudgeted"
              className={`${appTabPillClass} ${appTabPillInactiveClass}`}
            >
              Unbudgeted
            </a>
            <a
              href="#budget-annual"
              className={`${appTabPillClass} ${appTabPillInactiveClass}`}
            >
              Yearly plan
            </a>
            {inactiveMonthly.length > 0 && (
              <a
                href="#budget-inactive"
                className={`${appTabPillClass} ${appTabPillInactiveClass}`}
              >
                Paused lines
              </a>
            )}
            <a
              href="#budget-advanced-add"
              className={`${appTabPillClass} ${appTabPillInactiveClass}`}
            >
              Advanced add
            </a>
          </div>
        </div>
      </nav>

      <BudgetStrategyInsightPanel
        profile={profile}
        currency={currency}
        month={month}
        monthlyLines={model.lineRows}
      />

      <section
        id="budget-quick-add"
        className="scroll-mt-4 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]"
      >
        <BudgetQuickAddPresets
          defaultCalendarYear={calendarYear}
          monthlyIncome={monthlyIncome}
          currency={currency}
        />
        <BudgetRecommendationHints monthlyIncome={monthlyIncome} />
      </section>

      <PageSection
        id="budget-monthly"
        className="scroll-mt-4 space-y-6"
        variant="plain"
        title="Your monthly categories"
        description={
          <span className="text-xs text-zinc-600">
            Totals use expenses marked monthly; categories match your lines
            (case insensitive).{" "}
            <MethodologyOpenLink topicId="monthly-budget-check" className={appInlineLinkClass}>
              How this is calculated
            </MethodologyOpenLink>
          </span>
        }
        actions={
          <Link
            href={expensesHref}
            className={`shrink-0 text-xs font-medium ${appInlineLinkClass}`}
          >
            Log expenses
          </Link>
        }
      >
        {spendRecommendations.length > 0 && (
          <div className="mb-1 flex justify-end">
            <MethodologyOpenLink topicId="spend-guidance" className="text-xs">
              How guidance is built
            </MethodologyOpenLink>
          </div>
        )}
        <div id="budget-guidance" className="scroll-mt-4 space-y-4">
          <SpendGuidancePanel month={month} lines={spendRecommendations} />
        </div>

        <BudgetMonthlyCategoriesSection
          month={month}
          currency={currency}
          monthly={model.monthly}
          monthlyAll={monthlyAll}
          activeMonthly={activeMonthly}
          overridesThisMonth={model.overridesThisMonth}
          expenseDateDefault={expenseDateDefault}
          monthExpenses={model.monthExpenses}
          expensesHref={expensesHref}
        />

        {showMonthlyVerdict && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div
              className={
                monthlyBudgetAgg.onTrack
                  ? "rounded-2xl border border-emerald-200/80 bg-emerald-50/80 p-4 shadow-sm"
                  : "rounded-2xl border border-red-200/80 bg-red-50/80 p-4 shadow-sm"
              }
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                {monthlyBudgetAgg.onTrack ? "On track" : "Heads up"}
              </p>
              <p className="mt-2 text-sm font-semibold text-zinc-900">
                {monthlyBudgetAgg.onTrack
                  ? "You are within your monthly plan for budgeted categories."
                  : `Spending has passed your planned total for budgeted categories.`}
              </p>
              <p className="mt-2 text-xs text-zinc-700">
                {monthlyBudgetAgg.onTrack
                  ? `Remaining this month: ${formatCurrency(model.monthly.totals.remaining, currency)}.`
                  : `Over by ${formatCurrency(monthlyBudgetAgg.overBy, currency)} (${formatCurrency(model.monthly.totals.spent, currency)} spent vs ${formatCurrency(model.monthly.totals.budget, currency)} planned).`}
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                Snapshot
              </p>
              <ul className="mt-2 space-y-1.5 text-xs text-zinc-700">
                <li>
                  Planned:{" "}
                  <span className="font-medium text-zinc-900">
                    {formatCurrency(model.monthly.totals.budget, currency)}
                  </span>
                </li>
                <li>
                  Logged:{" "}
                  <span className="font-medium text-zinc-900">
                    {formatCurrency(model.monthly.totals.spent, currency)}
                  </span>
                </li>
                {unbudgetedMonthlyTotal > 0 && (
                  <li className="text-amber-900">
                    Unbudgeted monthly spend (below):{" "}
                    <span className="font-medium">
                      {formatCurrency(unbudgetedMonthlyTotal, currency)}
                    </span>{" "}
                    — not in the verdict above.
                  </li>
                )}
              </ul>
            </div>
          </div>
        )}
      </PageSection>

      <PageSection
        id="budget-unbudgeted"
        className="scroll-mt-4 space-y-3"
        title="Spend without a matching line"
        description="Monthly expenses in categories you have not planned for this month."
        actions={
          <Link href={expensesHref} className={`text-xs font-medium ${appInlineLinkClass}`}>
            Log an expense
          </Link>
        }
      >
        {model.unbudgetedMonthlyExpenses.length === 0 ? (
          <div className="rounded-2xl border border-emerald-100 bg-linear-to-br from-emerald-50/80 to-white p-6 text-center shadow-sm">
            <p className="text-lg" aria-hidden>
              ✨
            </p>
            <p className="mt-2 text-sm font-semibold text-emerald-950">
              Nothing unbudgeted this month
            </p>
            <p className="mt-1 text-xs text-emerald-900/80">
              Every monthly expense lines up with a category in your plan — or
              you have not logged spend yet. Either way, you are all caught up
              here.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm">
              <div className="max-h-[min(65vh,42rem)] overflow-x-auto overflow-y-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="sticky top-0 z-10 border-b border-zinc-200 bg-zinc-50/95 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 shadow-sm backdrop-blur-sm">
                    <tr>
                      <th className="bg-zinc-50/95 px-3 py-3">Category</th>
                      <th className="bg-zinc-50/95 px-3 py-3">Date</th>
                      <th className="bg-zinc-50/95 px-3 py-3">Amount</th>
                      <th className="bg-zinc-50/95 px-3 py-3">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                  {model.unbudgetedMonthlyExpenses.map((e) => (
                    <tr
                      key={e.id}
                      className="border-b border-zinc-100 transition-colors hover:bg-teal-50/15 last:border-0"
                    >
                      <td className="px-3 py-2 font-medium capitalize text-zinc-800">
                        <span className="mr-1.5" aria-hidden>
                          {budgetCategoryEmoji(e.category)}
                        </span>
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
              Subtotal:{" "}
              <span className="font-medium text-zinc-800">
                {formatCurrency(unbudgetedMonthlyTotal, currency)}
              </span>
              . Tip: quick-add a line above, then expenses will map here
              automatically.
            </p>
          </>
        )}
      </PageSection>

      {inactiveMonthly.length > 0 && (
        <PageSection
          id="budget-inactive"
          className="scroll-mt-4 space-y-3"
          title="Lines not active this month"
          description="These lines start later or already ended (for example after a loan payoff). You can adjust the schedule or remove the line."
        >
          <ul className="space-y-4 rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm">
            {inactiveMonthly.map((line) => (
              <li
                key={line.id}
                className="border-b border-zinc-100 pb-4 last:border-0 last:pb-0"
              >
                <p className="flex items-center gap-2 font-medium capitalize text-zinc-800">
                  <span aria-hidden>{budgetCategoryEmoji(line.category)}</span>
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
        title={`Yearly expenses (${calendarYear})`}
        description={
          <span className="text-xs text-zinc-600">
            For insurance, holidays, road tax, gifts, and other once-a-year
            costs. Totals use annual-tagged expenses dated in {calendarYear}.{" "}
            <MethodologyOpenLink topicId="budget-lines" className={appInlineLinkClass}>
              How annual lines work
            </MethodologyOpenLink>
          </span>
        }
        actions={
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <Link
              className="font-medium text-zinc-600 hover:text-zinc-900"
              href={setupBudgetPath(month, calendarYear - 1)}
            >
              Previous year
            </Link>
            <Link
              className="font-medium text-zinc-600 hover:text-zinc-900"
              href={setupBudgetPath(month, calendarYear + 1)}
            >
              Next year
            </Link>
          </div>
        }
      >
        {annualRows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-violet-200/80 bg-linear-to-br from-violet-50/50 to-white p-6 text-sm text-zinc-700 shadow-sm">
            <p className="font-semibold text-zinc-900">No yearly lines yet</p>
            <p className="mt-2 text-xs leading-relaxed text-zinc-600">
              Add categories such as insurance premiums, travel, vehicle tax, or
              annual subscriptions — then tag matching expenses as annual in{" "}
              {calendarYear}.
            </p>
            <p className="mt-3 text-xs">
              <a href="#budget-advanced-add" className={appInlineLinkClass}>
                Add an annual line
              </a>
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-sm">
            <div className="max-h-[min(65vh,42rem)] overflow-x-auto overflow-y-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 z-10 border-b border-zinc-200 bg-zinc-50/95 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 shadow-sm backdrop-blur-sm">
                  <tr>
                    <th className="bg-zinc-50/95 px-3 py-3">Category</th>
                    <th className="bg-zinc-50/95 px-3 py-3">Budget</th>
                    <th className="bg-zinc-50/95 px-3 py-3">Spent</th>
                    <th className="bg-zinc-50/95 px-3 py-3">Remaining</th>
                    <th className="bg-zinc-50/95 px-3 py-3">Details</th>
                  </tr>
                </thead>
                <tbody>
                {annualRows.map((line) => {
                  const v = varianceForLine(model.annual, line);
                  const budget = num(line.amount);
                  const spent = v?.spent ?? 0;
                  const remaining = v?.remaining ?? budget;
                  const over = v?.over ?? false;
                  return (
                    <tr
                      key={line.id}
                      className="border-b border-zinc-100 transition-colors hover:bg-violet-50/20 last:border-0"
                    >
                      <td className="px-3 py-2 font-medium capitalize text-zinc-800">
                        <span className="mr-1.5" aria-hidden>
                          {budgetCategoryEmoji(line.category)}
                        </span>
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
                })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {annualRows.length > 0 && (
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
        )}
      </PageSection>

      <PageSection
        id="budget-advanced-add"
        className="scroll-mt-4"
        title="Advanced — full budget line form"
        description={
          <span className="text-xs text-zinc-600">
            For precise schedules, annual amounts, or loan payoff months.{" "}
            <MethodologyOpenLink topicId="budget-lines" className={appInlineLinkClass}>
              How budget lines work
            </MethodologyOpenLink>
          </span>
        }
      >
        <BudgetAddForm defaultYear={calendarYear} />
      </PageSection>
    </div>
  );
}
