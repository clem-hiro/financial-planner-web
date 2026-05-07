import Link from "next/link";
import { num, profileAnnualSalaryGrowthNominal, profileCpfAgeBand, profileMonthlyGross, profileMonthlyIncome } from "@/data/mappers";
import { getProfileById } from "@/data/repositories/profiles";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { FinancialPlanningForm } from "@/features/dashboard/FinancialPlanningForm";
import { ProfileIncomeForm } from "@/features/dashboard/ProfileIncomeForm";
import { DEFAULT_BASE_CURRENCY } from "@/lib/currency";
import { formatYearMonth } from "@/lib/dates";
import { isSupabaseConfigured } from "@/lib/env";
import { appInlineLinkClass } from "@/ui/app-link-styles";
import { PageSection } from "@/ui/PageSection";

export default async function FinancialProfilePage() {
  if (!isSupabaseConfigured()) {
    return <p className="text-sm text-zinc-600">Configure Supabase to edit your financial profile.</p>;
  }
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Financial profile</h1>
        <Link href="/login" className={`text-sm ${appInlineLinkClass}`}>Sign in</Link>
      </div>
    );
  }
  const profile = await getProfileById(supabase, user.id);
  const income = profileMonthlyIncome(profile);
  const gross = profileMonthlyGross(profile);
  const cpfBand = profileCpfAgeBand(profile);
  const currency = profile?.base_currency ?? DEFAULT_BASE_CURRENCY;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Financial profile</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Canonical assumptions for dashboard and projections. Update here to avoid duplicated settings across screens.
        </p>
      </div>

      <PageSection title="Global planning assumptions">
        <FinancialPlanningForm
          initialCurrency={currency}
          initialSalaryFrequency={profile?.salary_frequency ?? null}
          initialAnnualBonus={profile?.annual_bonus != null ? num(profile.annual_bonus) : null}
          initialSavingsTarget={profile?.savings_target_monthly != null ? num(profile.savings_target_monthly) : null}
          initialFixedExpenses={profile?.fixed_expenses_monthly != null ? num(profile.fixed_expenses_monthly) : null}
          initialDebtObligations={profile?.debt_obligations_monthly != null ? num(profile.debt_obligations_monthly) : null}
        />
      </PageSection>

      <PageSection title="Income, CPF, and retirement assumptions">
        <ProfileIncomeForm
          key={`${income ?? ""}-${gross ?? ""}-${cpfBand ?? ""}-${profileAnnualSalaryGrowthNominal(profile)}-${profile?.birth_date ?? ""}-${profile?.target_retirement_age ?? ""}-${profile?.retirement_monthly_spend_goal ?? ""}-${profile?.retirement_dividend_yield_annual ?? ""}`}
          initialIncome={income}
          initialGross={gross}
          initialCpfAgeBand={cpfBand}
          initialAnnualSalaryGrowthPercent={
            profile?.annual_salary_growth_nominal != null &&
            String(profile.annual_salary_growth_nominal).trim() !== ""
              ? num(profile.annual_salary_growth_nominal) * 100
              : null
          }
          initialBirthDate={profile?.birth_date ?? null}
          initialTargetRetirementAge={profile?.target_retirement_age != null ? Number(profile.target_retirement_age) : null}
          initialRetirementMonthlySpendGoal={
            profile?.retirement_monthly_spend_goal != null &&
            String(profile.retirement_monthly_spend_goal).trim() !== ""
              ? num(profile.retirement_monthly_spend_goal)
              : null
          }
          initialRetirementDividendYieldPercent={
            profile?.retirement_dividend_yield_annual != null &&
            String(profile.retirement_dividend_yield_annual).trim() !== ""
              ? num(profile.retirement_dividend_yield_annual) * 100
              : null
          }
          initialRetirementWithdrawalRatePercent={
            profile?.retirement_withdrawal_rate_annual != null &&
            String(profile.retirement_withdrawal_rate_annual).trim() !== ""
              ? num(profile.retirement_withdrawal_rate_annual) * 100
              : null
          }
          cpfYearMonth={formatYearMonth(new Date())}
          currencyCode={currency}
        />
      </PageSection>
    </div>
  );
}
