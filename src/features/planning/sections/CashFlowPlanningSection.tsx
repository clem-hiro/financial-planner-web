import Link from "next/link";
import {
  num,
  profileAnnualSalaryGrowthNominal,
  profileCpfAgeBand,
  profileMonthlyGross,
  profileSalaryTakeHomeMonthly,
} from "@/data/mappers";
import { listBudgetLines } from "@/data/repositories/budget-lines";
import { getProfileById } from "@/data/repositories/profiles";
import { countReplaceableMonthlyBudgetLines } from "@/domain/finance/budget-guided-setup";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { ProfileIncomeForm } from "@/features/dashboard/ProfileIncomeForm";
import { BudgetPlanningView } from "@/features/budget/BudgetPlanningView";
import { BudgetLensProfileForm } from "@/features/setup/BudgetLensProfileForm";
import { DEFAULT_BASE_CURRENCY } from "@/lib/currency";
import { formatYearMonth, parseYearMonth, yearFromYearMonth } from "@/lib/dates";
import { appInlineLinkClass } from "@/ui/app-link-styles";
import { PageSection } from "@/ui/PageSection";

type SearchLike = { month?: string; year?: string };

export async function CashFlowPlanningSection({
  searchParams,
}: {
  searchParams: Promise<SearchLike>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <p className="text-sm text-slate-600">
        <Link href="/login" className={appInlineLinkClass}>
          Sign in
        </Link>{" "}
        to manage cash flow.
      </p>
    );
  }

  const [financialProfile, budgetLines] = await Promise.all([
    getProfileById(supabase, user.id),
    listBudgetLines(supabase, user.id),
  ]);
  const replaceableMonthlyLineCount =
    countReplaceableMonthlyBudgetLines(budgetLines);
  const sp = await searchParams;
  const budgetMonth =
    sp.month && parseYearMonth(sp.month) ? sp.month : formatYearMonth(new Date());
  const budgetYearParsed = sp.year != null ? Number(sp.year) : NaN;
  const budgetCalendarYear =
    Number.isFinite(budgetYearParsed) &&
    budgetYearParsed >= 2000 &&
    budgetYearParsed <= 2100
      ? budgetYearParsed
      : yearFromYearMonth(budgetMonth);

  const income = profileSalaryTakeHomeMonthly(financialProfile, budgetMonth);
  const gross = profileMonthlyGross(financialProfile);
  const cpfBand = profileCpfAgeBand(financialProfile);
  const currency = financialProfile?.base_currency ?? DEFAULT_BASE_CURRENCY;

  return (
    <div className="space-y-10">
      <header className="max-w-2xl space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Level 2 · Cash flow workspace
        </p>
        <h2 className="text-2xl font-semibold tracking-tight text-[#0c192f] sm:text-3xl">
          Income, budgets, and surplus
        </h2>
        <p className="text-sm leading-relaxed text-slate-600">
          Start with the monthly budget. Expand advanced assumptions only when you need
          to tune income or CPF banding. Retirement targets live under{" "}
          <Link href="/setup?tab=goals" className={appInlineLinkClass}>
            Setup → Goals
          </Link>
          .
        </p>
      </header>

      <BudgetPlanningView
        month={budgetMonth}
        calendarYear={budgetCalendarYear}
        budgetPathVariant="planning"
      />

      <details className="group rounded-3xl bg-slate-50/50 ring-1 ring-slate-200/70 open:bg-white open:shadow-[0_16px_50px_-36px_rgba(15,23,42,0.28)]">
        <summary className="cursor-pointer list-none rounded-3xl px-5 py-4 text-sm font-semibold text-[#0c192f] outline-none transition marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="flex items-center justify-between gap-3">
            <span>Advanced · Income &amp; planning assumptions</span>
            <span className="text-xs font-medium text-slate-500">
              <span className="group-open:hidden">Show</span>
              <span className="hidden group-open:inline">Hide</span>
            </span>
          </span>
        </summary>
        <div className="space-y-8 border-t border-slate-200/70 px-5 pb-6 pt-2">
          <PageSection id="planning-cashflow-profile" title="Income &amp; CPF">
            <ProfileIncomeForm
              key={`${income ?? ""}-${gross ?? ""}-${cpfBand ?? ""}-${profileAnnualSalaryGrowthNominal(financialProfile)}-${financialProfile?.annual_bonus ?? ""}-${financialProfile?.birth_date ?? ""}-${financialProfile?.onboarding_completed_at ?? ""}`}
              initialIncome={income}
              initialGross={gross}
              initialCpfAgeBand={cpfBand}
              initialAnnualBonus={
                financialProfile?.annual_bonus != null &&
                String(financialProfile.annual_bonus).trim() !== ""
                  ? num(financialProfile.annual_bonus)
                  : null
              }
              initialAnnualBonusMonths={
                financialProfile?.annual_bonus_months != null &&
                String(financialProfile.annual_bonus_months).trim() !== ""
                  ? num(financialProfile.annual_bonus_months)
                  : null
              }
              initialAnnualSalaryGrowthPercent={
                financialProfile?.annual_salary_growth_nominal != null &&
                String(financialProfile.annual_salary_growth_nominal).trim() !== ""
                  ? num(financialProfile.annual_salary_growth_nominal) * 100
                  : null
              }
              initialBirthDate={financialProfile?.birth_date ?? null}
              onboardingCompletedAt={
                financialProfile?.onboarding_completed_at ?? null
              }
              cpfYearMonth={formatYearMonth(new Date())}
              currencyCode={currency}
            />
          </PageSection>
          <PageSection id="planning-cashflow-lens" title="Budget lens">
            <BudgetLensProfileForm
              initialLifestyle={financialProfile?.lifestyle_profile ?? null}
              initialStrategy={financialProfile?.budgeting_strategy ?? null}
              initialConfidence={financialProfile?.onboarding_confidence_level ?? null}
              initialFoodSpendBand={financialProfile?.food_spend_band ?? null}
              monthlyIncome={income}
              currency={currency}
              replaceableMonthlyLineCount={replaceableMonthlyLineCount}
            />
          </PageSection>
        </div>
      </details>
    </div>
  );
}
