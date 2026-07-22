import Link from "next/link";
import { redirect } from "next/navigation";
import {
  num,
  profileAnnualSalaryGrowthNominal,
  profileCpfAgeBand,
  profileMonthlyGross,
  profileSalaryTakeHomeMonthly,
} from "@/data/mappers";
import {
  getMyAdvisorCategoryVisibility,
  getMyConsentStatusForAdvisor,
} from "@/data/repositories/advisor-clients";
import {
  countPendingProposalsForClient,
  listProposalsForClient,
} from "@/data/repositories/advisor-proposals";
import { getIncomeTaxConfig } from "@/data/repositories/income-tax-configs";
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
import { ProtectionPlanningSection } from "@/features/planning/sections/ProtectionPlanningSection";
import {
  AccountSyncingRoadmapCard,
  AdvisorWorkspaceRoadmapCard,
  AiInsightsRoadmapCard,
  DocumentsVaultRoadmapCard,
  ReportsRoadmapCard,
  RetirementRoadmapCard,
  ScenarioSimulatorRoadmapCard,
  TaxEstimationRoadmapCard,
} from "@/features/planning/roadmap-modules";
import { MethodologyOpenLink } from "@/features/help/MethodologyOpenLink";
import { SetupTabsNav } from "@/features/setup/SetupTabsNav";
import { BudgetLensProfileForm } from "@/features/setup/BudgetLensProfileForm";
import { ClientProposalsView } from "@/features/proposals/ClientProposalsView";
import { DEFAULT_BASE_CURRENCY } from "@/lib/currency";
import { formatYearMonth, parseYearMonth, yearFromYearMonth } from "@/lib/dates";
import type { AdvisorCategoryVisibility } from "@/lib/advisor-visibility";
import { isSupabaseConfigured } from "@/lib/env";
import { isClient } from "@/lib/profile-role";
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
      <p className="text-sm text-zinc-600 dark:text-slate-300">
        Configure Supabase to edit your setup.
      </p>
    );
  }

  const { supabase, user, profile: financialProfile } = await getRequestAuth();

  if (!user) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-[#0c192f] dark:text-slate-50">
          Setup
        </h1>
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

  // Per-category advisor-visibility toggles render inline on the account tabs,
  // but only in the client's own self-view with a linked + actively-consented
  // advisor (same gate as /more#privacy-advisor-access). Null ⇒ hidden.
  const advisorUserId = financialProfile?.advisor_user_id ?? null;
  const tabUsesVisibility =
    activeTab === "cash-liabilities" ||
    activeTab === "housing" ||
    activeTab === "vehicles";
  const visibilityEligible =
    tabUsesVisibility && isClient(financialProfile) && !!advisorUserId;

  const [
    tabBundle,
    incomeTaxConfig,
    advisorProposals,
    advisorVisibility,
    pendingProposalCount,
  ] = await Promise.all([
    loadSetupTabBundle(supabase, user.id, new Set([activeTab])),
    activeTab === "income_tax"
      ? getIncomeTaxConfig(supabase, user.id)
      : Promise.resolve(null),
    activeTab === "advisor-proposals"
      ? listProposalsForClient(supabase, user.id, 25)
      : Promise.resolve([]),
    visibilityEligible && advisorUserId
      ? Promise.all([
          getMyConsentStatusForAdvisor(supabase, user.id, advisorUserId),
          getMyAdvisorCategoryVisibility(supabase, user.id, advisorUserId),
        ]).then(([status, vis]): AdvisorCategoryVisibility | null =>
          status === "active" ? vis : null
        )
      : Promise.resolve<AdvisorCategoryVisibility | null>(null),
    // Pending-proposal badge — fetched on every load (cheap head count).
    countPendingProposalsForClient(supabase, user.id),
  ]);
  const {
    investments,
    cashAccounts,
    cashSnapshots,
    liabilityRows,
    vehicleRows,
    cpfRow,
    cpfInvestments,
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
  const defaultSaMaturityMonth =
    financialProfile?.birth_date &&
    typeof financialProfile.birth_date === "string" &&
    birthDateIsValidPast(financialProfile.birth_date)
      ? formatYearMonth(
          new Date(
            Number(financialProfile.birth_date.slice(0, 4)) + 55,
            Number(financialProfile.birth_date.slice(5, 7)) - 1,
            1
          )
        )
      : null;
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

  const sectionPurpose: Record<string, string> = {
    profile:
      "Tell us about yourself so we can personalise your financial plan.",
    "add-account": "Balances and return assumptions for wealth projections.",
    cpf: "OA, SA, MA and CPF investment entries for Singapore projections.",
    income_tax: "Estimate annual tax from your saved income assumptions.",
    housing: "Properties you own and optional linked mortgages.",
    vehicles: "Vehicle loans and running costs that feed budget and net worth.",
    "cash-liabilities": "Cash buffers and debts outside housing and vehicle loans.",
    protection: "Resilience roadmap — insurance, dependents, and estate placeholders.",
    budget: "Your monthly plan and what's left to spend.",
    goals: "Savings targets, retirement assumptions, and monthly contributions.",
    "advisor-proposals": "Review plan suggestions from your linked advisor.",
  };

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-8">
      <SetupTabsNav
        tabs={setupTabs}
        activeTab={activeTab}
        overviewHref={SETUP_OVERVIEW_PATH}
        buildHref={(tabId) => setupTabPath(tabId, sp)}
        badges={{ "advisor-proposals": pendingProposalCount }}
      />

      <div className="min-w-0 flex-1 space-y-5 sm:space-y-8">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-slate-50 sm:text-[1.65rem]">
          {activeTabLabel}
        </h1>
        {sectionPurpose[activeTab] ? (
          <p className="max-w-2xl text-sm text-slate-600 dark:text-slate-300">
            {sectionPurpose[activeTab]}
            {activeTab === "add-account" ||
            activeTab === "cash-liabilities" ||
            activeTab === "housing" ||
            activeTab === "vehicles" ? (
              <> These details also feed into the net worth view on Home.</>
            ) : null}
          </p>
        ) : null}
      </header>

      <div className="flex flex-col gap-5 sm:gap-8">
      {activeTab === "profile" ? (
        <div
          id="profile-assumptions"
          className="transition-opacity duration-150 ease-out space-y-6"
        >
          <ProfileIncomeForm
            key={`${income ?? ""}-${gross ?? ""}-${cpfBand ?? ""}-${profileAnnualSalaryGrowthNominal(financialProfile)}-${financialProfile?.annual_bonus ?? ""}-${financialProfile?.other_monthly_income ?? ""}-${financialProfile?.birth_date ?? ""}-${financialProfile?.salary_increment_month ?? ""}-${financialProfile?.onboarding_completed_at ?? ""}`}
            initialIncome={income}
            initialGross={gross}
            initialCpfAgeBand={cpfBand}
            initialAnnualBonus={
              financialProfile?.annual_bonus != null &&
              String(financialProfile.annual_bonus).trim() !== ""
                ? num(financialProfile.annual_bonus)
                : null
            }
            initialOtherMonthlyIncome={
              financialProfile?.other_monthly_income != null &&
              String(financialProfile.other_monthly_income).trim() !== ""
                ? num(financialProfile.other_monthly_income)
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
            cpfYearMonth={formatYearMonth(new Date())}
            currencyCode={currency}
          />
          <BudgetLensProfileForm
            initialLifestyle={financialProfile?.lifestyle_profile ?? null}
            initialStrategy={financialProfile?.budgeting_strategy ?? null}
            initialFoodSpendBand={financialProfile?.food_spend_band ?? null}
          />
        </div>
      ) : null}

      {activeTab === "add-account" ? (
        <div className="transition-opacity duration-150 ease-out space-y-6">
          <PageSection
            id="add-investment"
            title="Investments"
            description="New accounts appear below and in dashboard projections."
          >
            <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white divide-y divide-zinc-200 dark:border-slate-700/80 dark:bg-slate-900 dark:divide-slate-700/80">
              <div className="p-4 sm:p-5">
                <InvestmentForm planningContext={investmentPlanningContext} />
              </div>
              {investmentBalanceRows.length > 0 ? (
                <div className="p-4 sm:p-5">
                  <InvestmentBalancesList
                    items={investmentBalanceRows}
                    currencyCode={currency}
                    planningContext={investmentPlanningContext}
                    showReviewPrompt={showInvestmentReviewPrompt}
                    showAssumptionBanner={false}
                  />
                </div>
              ) : null}
            </div>
          </PageSection>
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-slate-50">
              Coming soon
            </h3>
            <AccountSyncingRoadmapCard />
          </section>
        </div>
      ) : null}

      {activeTab === "cpf" ? (
        <div className="transition-opacity duration-150 ease-out">
          <PageSection
            id="cpf-balances"
            title="CPF &amp; CPF Investments"
            description={
              <span className="text-xs text-zinc-600">
                OA / SA / MA and CPF investment entries.{" "}
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
              cpfInvestments={cpfInvestments}
              defaultSaMaturityMonth={defaultSaMaturityMonth}
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
              properties={properties}
              housingLoans={housingLoans}
              vehicleRows={vehicleRows}
              currencyCode={currency}
              advisorVisibility={advisorVisibility}
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
              advisorVisibility={advisorVisibility}
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
            <VehiclesPanel
              vehicles={vehicleRows}
              currencyCode={currency}
              advisorVisibility={advisorVisibility}
            />
          </PageSection>
        </div>
      ) : null}

      {activeTab === "protection" ? (
        <div className="transition-opacity duration-150 ease-out">
          <ProtectionPlanningSection />
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
        <div className="transition-opacity duration-150 ease-out space-y-8">
          <FinancialGoalsPanels
            goals={goals}
            investments={investments}
            currency={currency}
            userId={user.id}
            {...profileRetirementTargetsProps(financialProfile)}
          />
          <section className="space-y-4">
            <h3 className="text-lg font-semibold tracking-tight text-[#0c192f] dark:text-slate-50">
              Coming modules
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              <RetirementRoadmapCard />
              <ScenarioSimulatorRoadmapCard />
              <TaxEstimationRoadmapCard />
              <ReportsRoadmapCard />
              <DocumentsVaultRoadmapCard />
            </div>
          </section>
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
      </div>
    </div>
  );
}
