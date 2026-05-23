import Link from "next/link";
import { redirect } from "next/navigation";
import {
  num,
  profileAnnualSalaryGrowthNominal,
  profileCpfAgeBand,
  profileMonthlyGross,
  profileSalaryTakeHomeMonthly,
} from "@/data/mappers";
import { listBudgetLines } from "@/data/repositories/budget-lines";
import { getIncomeTaxConfig } from "@/data/repositories/income-tax-configs";
import { countReplaceableMonthlyBudgetLines } from "@/domain/finance/budget-guided-setup";
import { getRequestAuth } from "@/data/supabase/request-context";
import { ProfileIncomeForm } from "@/features/dashboard/ProfileIncomeForm";
import { IncomeTaxSection } from "@/features/income-tax/IncomeTaxSection";
import { buildCashHistoryByAccountId } from "@/data/cash-account-history-build";
import {
  CashAndLiabilitiesPanels,
  type CashAccountBalanceRow,
} from "@/features/goals/CashAndLiabilitiesPanels";
import { CpfBalancesForm } from "@/features/goals/CpfBalancesForm";
import { HousingPanel } from "@/features/goals/HousingLoansPanel";
import {
  InvestmentBalancesList,
} from "@/features/goals/InvestmentBalancesList";
import { investmentRowToBalanceRow } from "@/features/goals/investment-balance-row";
import { InvestmentForm } from "@/features/goals/InvestmentForm";
import { FinancialGoalsPanels } from "@/features/goals/FinancialGoalsPanels";
import { profileRetirementTargetsProps } from "@/features/goals/profile-retirement-props";
import { VehiclesPanel } from "@/features/goals/VehiclesPanel";
import { BudgetPlanningView } from "@/features/budget/BudgetPlanningView";
import { loadSetupTabBundle } from "@/features/planning/load-setup-tab-bundle";
import { MethodologyOpenLink } from "@/features/help/MethodologyOpenLink";
import { SetupTabsNav } from "@/features/setup/SetupTabsNav";
import { BudgetLensProfileForm } from "@/features/setup/BudgetLensProfileForm";
import { DEFAULT_BASE_CURRENCY } from "@/lib/currency";
import { formatYearMonth, parseYearMonth, yearFromYearMonth } from "@/lib/dates";
import { isSupabaseConfigured } from "@/lib/env";
import { SETUP_OVERVIEW_PATH, setupTabPath } from "@/lib/setup-urls";
import { buildSetupTabs } from "@/lib/setup-tabs";
import { shouldPromptCpfRulesReview } from "@/domain/finance/cpf-rules-review";
import { shouldPromptInvestmentReview } from "@/domain/finance/investment-review";
import { birthDateIsValidPast } from "@/lib/validation";
import { appInlineLinkClass } from "@/ui/app-link-styles";
import { PageSection } from "@/ui/PageSection";

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

  const sp = await searchParams;
  if (!sp.tab && !sp.month && !sp.year) {
    redirect(SETUP_OVERVIEW_PATH);
  }

  const setupTabs = buildSetupTabs();
  const tabParam =
    sp.tab === "housing-loans" ? "housing" : sp.tab;
  const activeTab =
    tabParam && setupTabs.some((t) => t.id === tabParam) ? tabParam : "profile";
  const activeTabLabel =
    setupTabs.find((t) => t.id === activeTab)?.label ?? "Profile";
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

  const [tabBundle, incomeTaxConfig, budgetLinesForLens] = await Promise.all([
    loadSetupTabBundle(supabase, user.id, new Set([activeTab])),
    activeTab === "income_tax"
      ? getIncomeTaxConfig(supabase, user.id)
      : Promise.resolve(null),
    activeTab === "profile"
      ? listBudgetLines(supabase, user.id)
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
  const investmentBalanceRows = investments.map(investmentRowToBalanceRow);
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Financial setup
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">
              Edit {activeTabLabel}
            </h1>
            <p className="mt-1 text-sm text-zinc-600">
              This is one setup section. Use Overview to see progress and the
              next recommended step.
            </p>
          </div>
          <Link
            href={SETUP_OVERVIEW_PATH}
            className="inline-flex shrink-0 items-center text-sm font-semibold text-slate-600 transition hover:text-slate-900"
          >
            Back to overview →
          </Link>
        </div>
        <p className="mt-3 flex flex-wrap gap-x-3 text-xs text-zinc-600">
          <MethodologyOpenLink topicId="net-worth" className={appInlineLinkClass}>
            Net worth methodology →
          </MethodologyOpenLink>
        </p>
      </div>

      <div className="order-2 sm:order-3">
        <SetupTabsNav
          tabs={setupTabs}
          activeTab={activeTab}
          overviewHref={SETUP_OVERVIEW_PATH}
          buildHref={(tabId) => setupTabPath(tabId, sp)}
        />
      </div>

      <div className="order-3 flex flex-col gap-5 sm:order-4 sm:gap-8">
      {activeTab === "profile" ? (
        <div className="transition-opacity duration-150 ease-out">
          <PageSection id="profile-assumptions" title="Profile basics">
            <div className="space-y-6">
              <ProfileIncomeForm
                key={`${income ?? ""}-${gross ?? ""}-${cpfBand ?? ""}-${profileAnnualSalaryGrowthNominal(financialProfile)}-${financialProfile?.annual_bonus ?? ""}-${financialProfile?.birth_date ?? ""}-${financialProfile?.salary_increment_month ?? ""}-${financialProfile?.onboarding_completed_at ?? ""}`}
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
                initialSalaryIncrementMonth={
                  financialProfile?.salary_increment_month ?? null
                }
                onboardingCompletedAt={
                  financialProfile?.onboarding_completed_at ?? null
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
            {...profileRetirementTargetsProps(financialProfile)}
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
      </div>

    </div>
  );
}
