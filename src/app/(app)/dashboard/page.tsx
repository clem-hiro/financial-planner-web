import Link from "next/link";
import { getDashboardPayload } from "@/data/dashboard";
import { getProfileById } from "@/data/repositories/profiles";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { IncomeRetirementSectionActions } from "@/features/dashboard/IncomeRetirementSectionActions";
import { DashboardMonthSection } from "@/features/dashboard/DashboardMonthSection";
import { DashboardOverviewSection } from "@/features/dashboard/DashboardOverviewSection";
import { DashboardRetirementSection } from "@/features/dashboard/DashboardRetirementSection";
import { DashboardSubnav } from "@/features/dashboard/DashboardSubnav";
import { ProfileIncomeForm } from "@/features/dashboard/ProfileIncomeForm";
import {
  num,
  profileAnnualSalaryGrowthNominal,
  profileCpfAgeBand,
  profileMonthlyGross,
  profileMonthlyIncome,
} from "@/data/mappers";
import { DEFAULT_BASE_CURRENCY } from "@/lib/currency";
import { formatYearMonth } from "@/lib/dates";
import { isSupabaseConfigured } from "@/lib/env";
import { PageSection } from "@/ui/PageSection";

export default async function DashboardPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="rounded-2xl border border-amber-200/70 bg-amber-50/95 p-6 text-sm text-amber-950 shadow-lg shadow-amber-900/10 ring-1 ring-amber-100/50">
        Set{" "}
        <code className="rounded bg-amber-100 px-1">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
        and{" "}
        <code className="rounded bg-amber-100 px-1">
          NEXT_PUBLIC_SUPABASE_ANON_KEY
        </code>{" "}
        in <code className="rounded bg-amber-100 px-1">.env.local</code>, run
        migrations, then sign in.
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Dashboard
        </h1>
        <p className="text-slate-600">
          Sign in to see net worth, savings rate, and projections.
        </p>
        <Link
          href="/login"
          className="inline-flex rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Sign in
        </Link>
      </div>
    );
  }

  const month = formatYearMonth(new Date());
  const [payload, profile] = await Promise.all([
    getDashboardPayload(supabase, user.id, month),
    getProfileById(supabase, user.id),
  ]);
  const income = profileMonthlyIncome(profile);
  const gross = profileMonthlyGross(profile);
  const cpfBand = profileCpfAgeBand(profile);
  const currency = profile?.base_currency ?? DEFAULT_BASE_CURRENCY;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          Dashboard
        </h1>
        <p className="mt-1 font-mono text-xs font-medium tabular-nums text-slate-500">
          {month}
        </p>
        <DashboardSubnav />
      </div>

      <section id="overview" className="scroll-mt-24 space-y-2">
        <h2 className="sr-only">Overview</h2>
        <DashboardOverviewSection payload={payload} currency={currency} />
      </section>

      <section id="profile" className="scroll-mt-24">
        <PageSection
          title="Income & retirement"
          actions={<IncomeRetirementSectionActions />}
        >
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
            initialTargetRetirementAge={
              profile?.target_retirement_age != null
                ? Number(profile.target_retirement_age)
                : null
            }
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
            cpfYearMonth={month}
            currencyCode={currency}
          />
        </PageSection>
      </section>

      <section id="retirement" className="scroll-mt-24">
        <h2 className="sr-only">Projected wealth</h2>
        <DashboardRetirementSection payload={payload} profile={profile} />
      </section>

      <section id="month" className="scroll-mt-24 space-y-6">
        <h2 className="sr-only">This month</h2>
        <DashboardMonthSection payload={payload} />
      </section>
    </div>
  );
}
