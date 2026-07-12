import Link from "next/link";
import {
  num,
  profileCpfAgeBand,
  profileMonthlyGross,
  profileSalaryTakeHomeMonthly,
} from "@/data/mappers";
import { getProfileById } from "@/data/repositories/profiles";
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

  const financialProfile = await getProfileById(supabase, user.id);
  const sp = await searchParams;
  const month =
    sp.month && parseYearMonth(sp.month)
      ? sp.month
      : formatYearMonth(new Date());
  const yearParsed = sp.year != null ? Number(sp.year) : NaN;
  const calendarYear =
    Number.isFinite(yearParsed) && yearParsed >= 2000 && yearParsed <= 2100
      ? yearParsed
      : yearFromYearMonth(month);

  const income = profileSalaryTakeHomeMonthly(financialProfile, month);
  const gross = profileMonthlyGross(financialProfile);
  const cpfBand = profileCpfAgeBand(financialProfile);
  const currency = financialProfile?.base_currency ?? DEFAULT_BASE_CURRENCY;

  return (
    <div className="space-y-6">
      <BudgetPlanningView
        month={month}
        calendarYear={calendarYear}
        budgetPathVariant="planning"
      />
      <details className="group rounded-2xl border border-slate-200/90 bg-white open:shadow-sm dark:border-slate-700/80 dark:bg-slate-900">
        <summary className="cursor-pointer list-none px-5 py-4 text-sm font-medium text-slate-800 marker:content-none dark:text-slate-100 [&::-webkit-details-marker]:hidden">
          Income & lifestyle preferences
          <span className="ml-2 text-xs font-normal text-slate-500 group-open:hidden">
            (expand)
          </span>
        </summary>
        <div className="space-y-6 border-t border-slate-100 px-5 py-5 dark:border-slate-700/80">
          <PageSection id="planning-cashflow-income" title="Income">
            <ProfileIncomeForm
              initialIncome={income}
              initialGross={gross}
              initialCpfAgeBand={cpfBand}
              initialAnnualBonus={
                financialProfile?.annual_bonus != null &&
                String(financialProfile.annual_bonus).trim() !== ""
                  ? num(financialProfile.annual_bonus)
                  : null
              }
              initialAnnualSalaryGrowthPercent={
                financialProfile?.annual_salary_growth_nominal != null &&
                String(financialProfile.annual_salary_growth_nominal).trim() !==
                  ""
                  ? num(financialProfile.annual_salary_growth_nominal) * 100
                  : null
              }
              initialBirthDate={financialProfile?.birth_date ?? null}
              cpfYearMonth={formatYearMonth(new Date())}
              currencyCode={currency}
            />
          </PageSection>
          <PageSection id="planning-cashflow-lens" title="Budget preferences">
            <BudgetLensProfileForm
              initialLifestyle={financialProfile?.lifestyle_profile ?? null}
              initialStrategy={financialProfile?.budgeting_strategy ?? null}
              initialConfidence={
                financialProfile?.onboarding_confidence_level ?? null
              }
              initialFoodSpendBand={financialProfile?.food_spend_band ?? null}
            />
          </PageSection>
        </div>
      </details>
    </div>
  );
}
