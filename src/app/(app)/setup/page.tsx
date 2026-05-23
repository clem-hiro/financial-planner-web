import Link from "next/link";
import {
  num,
  profileAnnualSalaryGrowthNominal,
  profileExpenseGrowthNominal,
  profileCpfAgeBand,
  profileMonthlyGross,
  profileSalaryTakeHomeMonthly,
} from "@/data/mappers";
import { listProposalsForClient } from "@/data/repositories/advisor-proposals";
import { listBudgetLines } from "@/data/repositories/budget-lines";
import { getIncomeTaxConfig } from "@/data/repositories/income-tax-configs";
import { countReplaceableMonthlyBudgetLines } from "@/domain/finance/budget-guided-setup";
import { getRequestAuth } from "@/data/supabase/request-context";
import { ProfileIncomeForm } from "@/features/dashboard/ProfileIncomeForm";
import { IncomeTaxSection } from "@/features/income-tax/IncomeTaxSection";
import {
  CashAndLiabilitiesPanels,
  buildCashHistoryByAccountId,
  type CashAccountBalanceRow,
} from "@/features/goals/CashAndLiabilitiesPanels";
import { CpfBalancesForm } from "@/features/goals/CpfBalancesForm";
import { HousingPanel } from "@/features/goals/HousingLoansPanel";
import {
  InvestmentBalancesList,
  type InvestmentBalanceRow,
} from "@/features/goals/InvestmentBalancesList";
import { InvestmentForm } from "@/features/goals/InvestmentForm";
import { FinancialGoalsPanels } from "@/features/goals/FinancialGoalsPanels";
import { VehiclesPanel } from "@/features/goals/VehiclesPanel";
import { BudgetPlanningView } from "@/features/budget/BudgetPlanningView";
import { loadSetupTabBundle } from "@/features/planning/load-setup-tab-bundle";
import { MethodologyOpenLink } from "@/features/help/MethodologyOpenLink";
import { SetupTabsNav } from "@/features/setup/SetupTabsNav";
import { BudgetLensProfileForm } from "@/features/setup/BudgetLensProfileForm";
import { ClientProposalsView } from "@/features/proposals/ClientProposalsView";
import { DEFAULT_BASE_CURRENCY } from "@/lib/currency";
import { formatYearMonth, parseYearMonth, yearFromYearMonth } from "@/lib/dates";
import { isSupabaseConfigured } from "@/lib/env";
import { setupTabPath } from "@/lib/setup-urls";
import { shouldPromptCpfRulesReview } from "@/domain/finance/cpf-rules-review";
import { shouldPromptInvestmentReview } from "@/domain/finance/investment-review";
import { birthDateIsValidPast } from "@/lib/validation";
import { appInlineLinkClass } from "@/ui/app-link-styles";
import { PageSection } from "@/ui/PageSection";

type SetupTabDef = { id: string; label: string };

function buildSetupTabs(): readonly SetupTabDef[] {
  return [
    { id: "profile", label: "Profile" },
    { id: "add-account", label: "Investments" },
    { id: "cpf", label: "CPF" },
    { id: "income_tax", label: "Income tax" },
    { id: "cash-liabilities", label: "Cash and debts" },
    { id: "housing", label: "Housing" },
    { id: "vehicles", label: "Vehicles" },
    { id: "budget", label: "Budget" },
    { id: "goals", label: "Goals" },
    { id: "advisor-proposals", label: "Advisor proposals" },
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

  const { supabase, user, profile: financialProfile } = await getRequestAuth();

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

  const setupTabs = buildSetupTabs();

  const sp = await searchParams;
  const tabParam =
    sp.tab === "housing-loans" ? "housing" : sp.tab;
  const activeTab =
    tabParam && setupTabs.some((t) => t.id === tabParam) ? tabParam : "profile";
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

  const [tabBundle, incomeTaxConfig, budgetLinesForLens, advisorProposals] =
    await Promise.all([
      loadSetupTabBundle(supabase, user.id, new Set([activeTab])),
      activeTab === "income_tax"
        ? getIncomeTaxConfig(supabase, user.id)
        : Promise.resolve(null),
      activeTab === "profile"
        ? listBudgetLines(supabase, user.id)
        : Promise.resolve([]),
      activeTab === "advisor-proposals"
        ? listProposalsForClient(supabase, user.id, 25)
        : Promise.resolve([]),
    ]);
  const replaceableMonthlyLineCount =
    activeTab === "profile"
      ? countReplaceableMonthlyBudgetLines(budgetLinesForLens)
      : 0;
  const {
    investments,
    cashAccounts,
    cashSnapshots,
    liabilityRows,
    vehicleRows,
    cpfRow,
    properties,
    housingLoans,
    goals,
  } = tabBundle;

  const income = profileSalaryTakeHomeMonthly(financialProfile, budgetMonth);
  const gross = profileMonthlyGross(financialProfile);
  const cpfBand = profileCpfAgeBand(financialProfile);
  const currency = financialProfile?.base_currency ?? DEFAULT_BASE_CURRENCY;
  const investmentBalanceRows: InvestmentBalanceRow[] = investments.map((i) => ({
    id: i.id,
    name: i.name,
    current_value: num(i.current_value),
    monthly_contribution: num(i.monthly_contribution),
    expected_annual_return: num(i.expected_annual_return),
    contribution_growth_annual: num(i.contribution_growth_annual),
    contribution_type: i.contribution_type ?? null,
    contribution_duration_years:
      i.contribution_duration_years != null &&
      String(i.contribution_duration_years).trim() !== ""
        ? num(i.contribution_duration_years as string)
        : null,
    withdrawal_monthly: num(i.withdrawal_monthly),
    withdrawal_start_years:
      i.withdrawal_start_years != null &&
      String(i.withdrawal_start_years).trim() !== ""
        ? num(i.withdrawal_start_years)
        : null,
    updated_at: i.updated_at ?? null,
    created_at: i.created_at ?? null,
  }));
  const showInvestmentReviewPrompt = shouldPromptInvestmentReview({
    investments,
    lastInvestmentReviewAt: financialProfile?.last_investment_review_at ?? null,
  });
  const showCpfRulesReviewPrompt = shouldPromptCpfRulesReview({
    lastCpfRulesReviewAt: financialProfile?.last_cpf_rules_review_at ?? null,
    lastCpfRulesReviewVersion:
      financialProfile?.last_cpf_rules_review_version ?? null,
  });
  const investmentPlanningContext =
    financialProfile?.birth_date &&
    typeof financialProfile.birth_date === "string" &&
    birthDateIsValidPast(financialProfile.birth_date) &&
    financialProfile.target_retirement_age != null
      ? {
          birthDate: financialProfile.birth_date,
          targetRetirementAge: Number(financialProfile.target_retirement_age),
        }
      : null;
  const cashBalanceRows: CashAccountBalanceRow[] = cashAccounts.map((r) => ({
    id: r.id,
    name: r.name,
    balance: num(r.balance),
    purpose: r.purpose ?? "other",
  }));
  const cashHistoryByAccountId = buildCashHistoryByAccountId(cashSnapshots);

  return (
    <div className="flex flex-col gap-5 sm:gap-8">
      <div className="order-1 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-6 sm:py-5">
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">
          Financial setup
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Keep balances, budgets, savings goals, and profile assumptions in one place.
        </p>
        <p className="mt-2 flex flex-wrap gap-x-3 text-xs text-zinc-600">
          <MethodologyOpenLink topicId="net-worth" className={appInlineLinkClass}>
            Net worth methodology →
          </MethodologyOpenLink>
        </p>
      </div>

      <div className="order-2 sm:order-3">
        <SetupTabsNav
          tabs={setupTabs}
          activeTab={activeTab}
          buildHref={(tabId) => setupTabPath(tabId, sp)}
        />
      </div>

      <div className="order-3 flex flex-col gap-5 sm:order-4 sm:gap-8">
      {activeTab === "profile" ? (
        <div className="transition-opacity duration-150 ease-out">
          <PageSection id="profile-assumptions" title="Profile basics">
            <div className="space-y-6">
              <ProfileIncomeForm
                key={`${income ?? ""}-${gross ?? ""}-${cpfBand ?? ""}-${profileAnnualSalaryGrowthNominal(financialProfile)}-${profileExpenseGrowthNominal(financialProfile)}-${financialProfile?.annual_bonus ?? ""}-${financialProfile?.birth_date ?? ""}-${financialProfile?.target_retirement_age ?? ""}-${financialProfile?.retirement_monthly_spend_goal ?? ""}-${financialProfile?.retirement_dividend_yield_annual ?? ""}-${financialProfile?.salary_increment_month ?? ""}`}
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
                initialExpenseGrowthPercent={
                  financialProfile?.expense_growth_nominal != null &&
                  String(financialProfile.expense_growth_nominal).trim() !== ""
                    ? num(financialProfile.expense_growth_nominal) * 100
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
                initialSalaryIncrementMonth={
                  financialProfile?.salary_increment_month ?? null
                }
                cpfYearMonth={formatYearMonth(new Date())}
                currencyCode={currency}
              />
              <BudgetLensProfileForm
                initialLifestyle={financialProfile?.lifestyle_profile ?? null}
                initialStrategy={financialProfile?.budgeting_strategy ?? null}
                initialConfidence={
                  financialProfile?.onboarding_confidence_level ?? null
                }
                initialFoodSpendBand={financialProfile?.food_spend_band ?? null}
                monthlyIncome={income}
                currency={currency}
                replaceableMonthlyLineCount={replaceableMonthlyLineCount}
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
                    planningContext={investmentPlanningContext}
                    showReviewPrompt={showInvestmentReviewPrompt}
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
            <CpfBalancesForm
              row={cpfRow}
              showRulesReviewPrompt={showCpfRulesReviewPrompt}
            />
          </PageSection>
        </div>
      ) : null}

      {activeTab === "cash-liabilities" ? (
        <div className="transition-opacity duration-150 ease-out">
          <PageSection id="cash-liabilities" title="Cash and debts">
            <CashAndLiabilitiesPanels
              cashRows={cashBalanceRows}
              cashHistoryByAccountId={cashHistoryByAccountId}
              liabilityRows={liabilityRows}
              currencyCode={currency}
            />
          </PageSection>
        </div>
      ) : null}

      {activeTab === "housing" ? (
        <div className="transition-opacity duration-150 ease-out">
          <PageSection
            id="housing"
            title="Housing"
            description={
              <span className="text-xs text-zinc-600">
                Properties you own and optional linked mortgages. OA instalment
                assumptions feed CPF and cash-flow projections.{" "}
                <MethodologyOpenLink
                  topicId="cpf-housing-mortgage"
                  className={appInlineLinkClass}
                >
                  How housing OA works →
                </MethodologyOpenLink>
              </span>
            }
          >
            <HousingPanel
              properties={properties}
              loans={housingLoans}
              currencyCode={currency}
            />
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
            userId={user.id}
          />
        </div>
      ) : null}

      {activeTab === "income_tax" ? (
        <div className="transition-opacity duration-150 ease-out">
          <IncomeTaxSection
            profile={financialProfile}
            config={incomeTaxConfig}
            referenceYearMonth={budgetMonth}
          />
        </div>
      ) : null}

      {activeTab === "advisor-proposals" ? (
        <div className="transition-opacity duration-150 ease-out">
          <PageSection
            id="advisor-proposals"
            title="Advisor proposals"
            description="Plan suggestions from your advisor — pending, accepted, rejected, and withdrawn. Always available here, even after you dismiss the inbox notification."
          >
            <ClientProposalsView proposals={advisorProposals} />
          </PageSection>
        </div>
      ) : null}
      </div>

      <section className="order-4 grid gap-2.5 sm:order-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">
            Core setup
          </p>
          <p className="mt-0.5 text-sm text-slate-700 sm:mt-1">
            Profile, CPF, balances, budget, goals.
          </p>
        </div>
        <div className="rounded-xl border border-dashed border-slate-300/90 bg-slate-50/90 p-3 sm:p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 sm:text-xs">
            Risk scoring
          </p>
          <p className="mt-0.5 text-sm font-medium text-slate-500 sm:mt-1">Coming soon</p>
        </div>
        <div className="rounded-xl border border-dashed border-slate-300/90 bg-slate-50/90 p-3 sm:p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 sm:text-xs">
            Portfolio insights
          </p>
          <p className="mt-0.5 text-sm font-medium text-slate-500 sm:mt-1">Work in progress</p>
        </div>
        <Link
          href="/setup?tab=advisor-proposals"
          className="group rounded-xl border border-slate-200 bg-white p-3 transition hover:border-slate-300 hover:bg-slate-50/70 sm:p-4"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">
            Advisor proposals
          </p>
          <p className="mt-0.5 text-sm font-medium text-slate-700 group-hover:text-slate-900 sm:mt-1">
            Review plan suggestions →
          </p>
        </Link>
      </section>
    </div>
  );
}
