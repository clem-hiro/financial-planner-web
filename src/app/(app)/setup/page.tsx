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
import { listFinancialGoals } from "@/data/repositories/goals";
import { getProfileById } from "@/data/repositories/profiles";
import { listVehicles } from "@/data/repositories/vehicles";
import { createSupabaseServerClient } from "@/data/supabase/server";
import type {
  CashAccountRow,
  FinancialGoalRow,
  HousingLoanRow,
  InvestmentRow,
  LiabilityRow,
  VehicleRow,
} from "@/data/supabase/types";
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
import { FinancialGoalsPanels } from "@/features/goals/FinancialGoalsPanels";
import { VehiclesPanel } from "@/features/goals/VehiclesPanel";
import { BudgetPlanningView } from "@/features/budget/BudgetPlanningView";
import { MethodologyOpenLink } from "@/features/help/MethodologyOpenLink";
import { SetupTabsNav } from "@/features/setup/SetupTabsNav";
import { DEFAULT_BASE_CURRENCY } from "@/lib/currency";
import { formatYearMonth, parseYearMonth, yearFromYearMonth } from "@/lib/dates";
import { isSupabaseConfigured } from "@/lib/env";
import { setupTabPath } from "@/lib/setup-urls";
import { appInlineLinkClass } from "@/ui/app-link-styles";
import { PageSection } from "@/ui/PageSection";

type SetupTabDef = { id: string; label: string };

function buildSetupTabs(): readonly SetupTabDef[] {
  return [
    { id: "profile", label: "Profile" },
    { id: "add-account", label: "Investments" },
    { id: "cpf", label: "CPF" },
    { id: "cash-liabilities", label: "Cash and debts" },
    { id: "housing-loans", label: "Housing loans" },
    { id: "vehicles", label: "Vehicles" },
    { id: "budget", label: "Budget" },
    { id: "goals", label: "Goals" },
  ] as const;
}

type PageProps = {
  searchParams: Promise<{ tab?: string; month?: string; year?: string }>;
};

export default async function SetupPage({ searchParams }: PageProps) {
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

  const financialProfile = await getProfileById(supabase, user.id);
  const setupTabs = buildSetupTabs();

  const sp = await searchParams;
  const activeTab =
    sp.tab && setupTabs.some((t) => t.id === sp.tab) ? sp.tab : "profile";
  const budgetMonth =
    sp.month && parseYearMonth(sp.month)
      ? sp.month
      : formatYearMonth(new Date());
  const budgetYearParsed = sp.year != null ? Number(sp.year) : NaN;
  const budgetCalendarYear =
    Number.isFinite(budgetYearParsed) &&
    budgetYearParsed >= 2000 &&
    budgetYearParsed <= 2100
      ? budgetYearParsed
      : yearFromYearMonth(budgetMonth);

  const [
    investments,
    cashAccounts,
    liabilityRows,
    vehicleRows,
    cpfRow,
    housingLoans,
    goals,
  ] = await Promise.all([
    activeTab === "add-account" || activeTab === "goals"
      ? listInvestments(supabase, user.id)
      : Promise.resolve([] as InvestmentRow[]),
    activeTab === "cash-liabilities"
      ? listCashAccounts(supabase, user.id)
      : Promise.resolve([] as CashAccountRow[]),
    activeTab === "cash-liabilities"
      ? listLiabilities(supabase, user.id)
      : Promise.resolve([] as LiabilityRow[]),
    activeTab === "vehicles"
      ? listVehicles(supabase, user.id)
      : Promise.resolve([] as VehicleRow[]),
    activeTab === "cpf"
      ? getCpfBalanceByUserId(supabase, user.id)
      : Promise.resolve(null),
    activeTab === "housing-loans"
      ? listHousingLoans(supabase, user.id)
      : Promise.resolve([] as HousingLoanRow[]),
    activeTab === "goals"
      ? listFinancialGoals(supabase, user.id)
      : Promise.resolve([] as FinancialGoalRow[]),
  ]);

  const income = profileMonthlyIncome(financialProfile);
  const gross = profileMonthlyGross(financialProfile);
  const cpfBand = profileCpfAgeBand(financialProfile);
  const currency = financialProfile?.base_currency ?? DEFAULT_BASE_CURRENCY;
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
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Financial setup</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Keep balances, budgets, savings goals, and profile assumptions in one place.
        </p>
        <p className="mt-2 flex flex-wrap gap-x-3 text-xs text-zinc-600">
          <MethodologyOpenLink topicId="net-worth" className={appInlineLinkClass}>
            Net worth methodology →
          </MethodologyOpenLink>
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Core setup</p>
          <p className="mt-1 text-sm text-slate-700">Profile, CPF, balances, budget, goals.</p>
        </div>
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Risk scoring</p>
          <p className="mt-1 text-sm text-slate-700">Coming Soon</p>
        </div>
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Portfolio insights</p>
          <p className="mt-1 text-sm text-slate-700">Work in Progress</p>
        </div>
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Automation</p>
          <p className="mt-1 text-sm text-slate-700">Coming Soon</p>
        </div>
      </section>

      <SetupTabsNav
        tabs={setupTabs}
        activeTab={activeTab}
        buildHref={(tabId) => setupTabPath(tabId, sp)}
      />

      {activeTab === "profile" ? (
        <div className="transition-opacity duration-150 ease-out">
          <PageSection id="profile-assumptions" title="Profile basics">
            <div className="space-y-6">
              <ProfileIncomeForm
                key={`${income ?? ""}-${gross ?? ""}-${cpfBand ?? ""}-${profileAnnualSalaryGrowthNominal(financialProfile)}-${financialProfile?.annual_bonus ?? ""}-${financialProfile?.birth_date ?? ""}-${financialProfile?.target_retirement_age ?? ""}-${financialProfile?.retirement_monthly_spend_goal ?? ""}-${financialProfile?.retirement_dividend_yield_annual ?? ""}`}
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
                  String(financialProfile.annual_salary_growth_nominal).trim() !== ""
                    ? num(financialProfile.annual_salary_growth_nominal) * 100
                    : null
                }
                initialBirthDate={financialProfile?.birth_date ?? null}
                initialTargetRetirementAge={
                  financialProfile?.target_retirement_age != null
                    ? Number(financialProfile.target_retirement_age)
                    : null
                }
                initialRetirementMonthlySpendGoal={
                  financialProfile?.retirement_monthly_spend_goal != null &&
                  String(financialProfile.retirement_monthly_spend_goal).trim() !== ""
                    ? num(financialProfile.retirement_monthly_spend_goal)
                    : null
                }
                initialRetirementDividendYieldPercent={
                  financialProfile?.retirement_dividend_yield_annual != null &&
                  String(financialProfile.retirement_dividend_yield_annual).trim() !== ""
                    ? num(financialProfile.retirement_dividend_yield_annual) * 100
                    : null
                }
                initialRetirementWithdrawalRatePercent={
                  financialProfile?.retirement_withdrawal_rate_annual != null &&
                  String(financialProfile.retirement_withdrawal_rate_annual).trim() !== ""
                    ? num(financialProfile.retirement_withdrawal_rate_annual) * 100
                    : null
                }
                cpfYearMonth={formatYearMonth(new Date())}
                currencyCode={currency}
              />
            </div>
          </PageSection>
        </div>
      ) : null}

      {activeTab === "add-account" ? (
        <div className="transition-opacity duration-150 ease-out">
          <PageSection
            id="add-investment"
            title="Investments"
            description="New accounts appear below and in dashboard projections."
          >
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white divide-y divide-zinc-200">
              <div className="p-4 sm:p-5">
                <InvestmentForm />
              </div>
              {investmentBalanceRows.length > 0 ? (
                <div className="p-4 sm:p-5">
                  <InvestmentBalancesList
                    items={investmentBalanceRows}
                    currencyCode={currency}
                  />
                </div>
              ) : null}
            </div>
          </PageSection>
        </div>
      ) : null}

      {activeTab === "cpf" ? (
        <div className="transition-opacity duration-150 ease-out">
          <PageSection
            id="cpf-balances"
            title="CPF &amp; CPFIS"
            description={
              <span className="text-xs text-zinc-600">
                OA / SA / MA and optional CPFIS assumptions.{" "}
                <MethodologyOpenLink
                  topicId="cpf-projection"
                  className={appInlineLinkClass}
                >
                  Details
                </MethodologyOpenLink>
              </span>
            }
          >
            <CpfBalancesForm row={cpfRow} />
          </PageSection>
        </div>
      ) : null}

      {activeTab === "cash-liabilities" ? (
        <div className="transition-opacity duration-150 ease-out">
          <PageSection id="cash-liabilities" title="Cash and debts">
            <CashAndLiabilitiesPanels
              cashRows={cashBalanceRows}
              liabilityRows={liabilityBalanceRows}
              currencyCode={currency}
            />
          </PageSection>
        </div>
      ) : null}

      {activeTab === "housing-loans" ? (
        <div className="transition-opacity duration-150 ease-out">
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
        </div>
      ) : null}

      {activeTab === "vehicles" ? (
        <div className="transition-opacity duration-150 ease-out">
          <PageSection
            id="vehicles"
            title="Vehicles (Singapore)"
            description={
              <span className="text-xs text-zinc-600">
                Fill market value for the quickest setup. Use other fields only if needed.
              </span>
            }
          >
            <VehiclesPanel vehicles={vehicleRows} currencyCode={currency} />
          </PageSection>
        </div>
      ) : null}

      {activeTab === "budget" ? (
        <div className="transition-opacity duration-150 ease-out">
          <BudgetPlanningView
            month={budgetMonth}
            calendarYear={budgetCalendarYear}
          />
        </div>
      ) : null}

      {activeTab === "goals" ? (
        <div className="transition-opacity duration-150 ease-out">
          <FinancialGoalsPanels
            goals={goals}
            investments={investments}
            currency={currency}
          />
        </div>
      ) : null}
    </div>
  );
}
