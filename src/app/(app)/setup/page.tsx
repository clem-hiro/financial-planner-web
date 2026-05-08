import Link from "next/link";
import {
  num,
  profileAnnualSalaryGrowthNominal,
  profileCpfAgeBand,
  profileMonthlyGross,
  profileMonthlyIncome,
} from "@/data/mappers";
import { getCpfBalanceByUserId } from "@/data/repositories/cpf-balances";
import { listCashAccounts } from "@/data/repositories/cash-accounts";
import { listHousingLoans } from "@/data/repositories/housing-loans";
import { listInvestments } from "@/data/repositories/investments";
import { listLiabilities } from "@/data/repositories/liabilities";
import { getProfileById } from "@/data/repositories/profiles";
import { listVehicles } from "@/data/repositories/vehicles";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { ProfileIncomeForm } from "@/features/dashboard/ProfileIncomeForm";
import {
  CashAndLiabilitiesPanels,
  type CashAccountBalanceRow,
  type LiabilityBalanceRow,
} from "@/features/goals/CashAndLiabilitiesPanels";
import { CpfBalancesForm } from "@/features/goals/CpfBalancesForm";
import { HousingLoansPanel } from "@/features/goals/HousingLoansPanel";
import {
  InvestmentBalancesList,
  type InvestmentBalanceRow,
} from "@/features/goals/InvestmentBalancesList";
import { InvestmentForm } from "@/features/goals/InvestmentForm";
import { VehiclesPanel } from "@/features/goals/VehiclesPanel";
import { MethodologyOpenLink } from "@/features/help/MethodologyOpenLink";
import { DEFAULT_BASE_CURRENCY } from "@/lib/currency";
import { formatYearMonth } from "@/lib/dates";
import { isSupabaseConfigured } from "@/lib/env";
import { appInlineLinkClass } from "@/ui/app-link-styles";
import { PageSection } from "@/ui/PageSection";
import { ScrollToTopButton } from "@/ui/ScrollToTopButton";

export default async function SetupPage() {
  if (!isSupabaseConfigured()) {
    return (
      <p className="text-sm text-zinc-600">
        Configure Supabase to edit your setup.
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
        <h1 className="text-2xl font-semibold">Setup</h1>
        <Link href="/login" className={`text-sm ${appInlineLinkClass}`}>
          Sign in
        </Link>
      </div>
    );
  }

  const [
    investments,
    cashAccounts,
    liabilityRows,
    profile,
    vehicleRows,
    cpfRow,
    housingLoans,
  ] = await Promise.all([
    listInvestments(supabase, user.id),
    listCashAccounts(supabase, user.id),
    listLiabilities(supabase, user.id),
    getProfileById(supabase, user.id),
    listVehicles(supabase, user.id),
    getCpfBalanceByUserId(supabase, user.id),
    listHousingLoans(supabase, user.id),
  ]);

  const income = profileMonthlyIncome(profile);
  const gross = profileMonthlyGross(profile);
  const cpfBand = profileCpfAgeBand(profile);
  const currency = profile?.base_currency ?? DEFAULT_BASE_CURRENCY;

  const investmentBalanceRows: InvestmentBalanceRow[] = investments.map((i) => ({
    id: i.id,
    name: i.name,
    current_value: num(i.current_value),
    monthly_contribution: num(i.monthly_contribution),
    expected_annual_return: num(i.expected_annual_return),
  }));

  const cashBalanceRows: CashAccountBalanceRow[] = cashAccounts.map((r) => ({
    id: r.id,
    name: r.name,
    balance: num(r.balance),
  }));

  const liabilityBalanceRows: LiabilityBalanceRow[] = liabilityRows.map((r) => ({
    id: r.id,
    name: r.name,
    balance: num(r.balance),
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Financial setup</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Keep your balances and profile assumptions in one place.
        </p>
        <p className="mt-2 flex flex-wrap gap-x-3 text-xs text-zinc-600">
          <MethodologyOpenLink topicId="net-worth" className={appInlineLinkClass}>
            Net worth methodology →
          </MethodologyOpenLink>
          <MethodologyOpenLink topicId="cpf-projection" className={appInlineLinkClass}>
            CPF projection →
          </MethodologyOpenLink>
        </p>
      </div>

      <nav
        aria-label="Setup sections"
        className="sticky top-2 z-20 -mx-1 overflow-x-auto rounded-xl border border-slate-200/90 bg-white/95 px-1 py-1 shadow-sm backdrop-blur"
      >
        <div className="flex min-w-max gap-1">
          <a href="#profile-assumptions" className="rounded-full px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100">
            Profile
          </a>
          <a href="#add-investment" className="rounded-full px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100">
            Add account
          </a>
          <a href="#investment-accounts" className="rounded-full px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100">
            Accounts
          </a>
          <a href="#cpf-balances" className="rounded-full px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100">
            CPF
          </a>
          <a href="#cash-liabilities" className="rounded-full px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100">
            Cash & liabilities
          </a>
          <a href="#housing-loans" className="rounded-full px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100">
            Housing loans
          </a>
          <a href="#vehicles" className="rounded-full px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100">
            Vehicles
          </a>
        </div>
      </nav>

      <PageSection
        id="profile-assumptions"
        title="Profile basics"
        description="Gross salary, birth date, and retirement targets. Currency is SGD."
      >
        <div className="space-y-6">
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
            initialRetirementWithdrawalRatePercent={
              profile?.retirement_withdrawal_rate_annual != null &&
              String(profile.retirement_withdrawal_rate_annual).trim() !== ""
                ? num(profile.retirement_withdrawal_rate_annual) * 100
                : null
            }
            cpfYearMonth={formatYearMonth(new Date())}
            currencyCode={currency}
          />
        </div>
      </PageSection>

      <section id="balances-accounts" className="scroll-mt-24 space-y-6">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
          Balances & accounts
        </h2>

        <PageSection
          id="add-investment"
          title="Add account"
          description="New accounts appear below and in dashboard projections."
        >
          <InvestmentForm />
        </PageSection>

        <PageSection id="investment-accounts" title="Accounts">
          <InvestmentBalancesList
            items={investmentBalanceRows}
            currencyCode={currency}
          />
        </PageSection>

        <PageSection
          id="cpf-balances"
          title="CPF &amp; CPFIS"
          description={
            <span className="text-xs text-zinc-600">
              OA / SA / MA and optional CPFIS assumptions.{" "}
              <MethodologyOpenLink topicId="cpf-projection" className={appInlineLinkClass}>
                Details
              </MethodologyOpenLink>
            </span>
          }
        >
          <CpfBalancesForm row={cpfRow} />
        </PageSection>

        <PageSection id="cash-liabilities" title="Cash &amp; liabilities">
          <CashAndLiabilitiesPanels
            cashRows={cashBalanceRows}
            liabilityRows={liabilityBalanceRows}
            currencyCode={currency}
          />
        </PageSection>

        <PageSection
          id="housing-loans"
          title="Housing loans"
          description={
            <span className="text-xs text-zinc-600">
              Mortgages and OA instalment assumptions.{" "}
              <MethodologyOpenLink
                topicId="cpf-housing-mortgage"
                className={appInlineLinkClass}
              >
                How housing OA works →
              </MethodologyOpenLink>
            </span>
          }
        >
          <HousingLoansPanel loans={housingLoans} currencyCode={currency} />
        </PageSection>

        <PageSection
          id="vehicles"
          title="Vehicles (Singapore)"
          description={
            <span className="text-xs text-zinc-600">
              Market estimate, PARF/COE + terminal ramp, or OTR→terminal.
            </span>
          }
        >
          <VehiclesPanel vehicles={vehicleRows} currencyCode={currency} />
        </PageSection>
      </section>
      <ScrollToTopButton />
    </div>
  );
}
