import Link from "next/link";
import { num } from "@/data/mappers";
import { getProfileById } from "@/data/repositories/profiles";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { loadSetupTabBundle } from "@/features/planning/load-setup-tab-bundle";
import {
  CashAndLiabilitiesPanels,
  type CashAccountBalanceRow,
} from "@/features/goals/CashAndLiabilitiesPanels";
import { buildCashHistoryByAccountId } from "@/features/goals/cash-history";
import { CpfBalancesForm } from "@/features/goals/CpfBalancesForm";
import { HousingPanel } from "@/features/goals/HousingLoansPanel";
import {
  InvestmentBalancesList,
  type InvestmentBalanceRow,
} from "@/features/goals/InvestmentBalancesList";
import { InvestmentForm } from "@/features/goals/InvestmentForm";
import { VehiclesPanel } from "@/features/goals/VehiclesPanel";
import { MethodologyOpenLink } from "@/features/help/MethodologyOpenLink";
import { AccountSyncingRoadmapCard } from "@/features/planning/roadmap-modules";
import { DEFAULT_BASE_CURRENCY } from "@/lib/currency";
import { shouldPromptCpfRulesReview } from "@/domain/finance/cpf-rules-review";
import { shouldPromptInvestmentReview } from "@/domain/finance/investment-review";
import { birthDateIsValidPast } from "@/lib/validation";
import { appInlineLinkClass } from "@/ui/app-link-styles";
import { PageSection } from "@/ui/PageSection";

const WEALTH_TABS = new Set([
  "add-account",
  "cpf",
  "cash-liabilities",
  "housing",
  "vehicles",
]);

export async function WealthPlanningSection() {
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
        to edit wealth details.
      </p>
    );
  }

  const [financialProfile, bundle] = await Promise.all([
    getProfileById(supabase, user.id),
    loadSetupTabBundle(supabase, user.id, WEALTH_TABS),
  ]);

  const currency = financialProfile?.base_currency ?? DEFAULT_BASE_CURRENCY;
  const investmentBalanceRows: InvestmentBalanceRow[] = bundle.investments.map(
    (i) => ({
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
    })
  );
  const showInvestmentReviewPrompt = shouldPromptInvestmentReview({
    investments: bundle.investments,
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
  const cashBalanceRows: CashAccountBalanceRow[] = bundle.cashAccounts.map(
    (r) => ({
      id: r.id,
      name: r.name,
      balance: num(r.balance),
      purpose: r.purpose ?? "other",
    })
  );
  const cashHistoryByAccountId = buildCashHistoryByAccountId(
    bundle.cashSnapshots
  );

  return (
    <div className="space-y-10">
      <header className="max-w-2xl space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          Level 2 · Balance sheet workspace
        </p>
        <h2 className="text-2xl font-semibold tracking-tight text-[#0c192f] sm:text-3xl">
          Investments, CPF, property, vehicles, debts
        </h2>
        <p className="text-sm leading-relaxed text-slate-600">
          The same editors as Financial setup — reorganized as modular cards for faster
          scanning.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <PageSection
            id="wealth-investments"
            title="Investments"
            description="New accounts appear here and in dashboard projections."
          >
            <div className="overflow-hidden rounded-2xl bg-white/90 ring-1 ring-slate-200/70 divide-y divide-slate-200/80">
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

          <PageSection
            id="wealth-cpf"
            title="CPF & CPFIS"
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
              row={bundle.cpfRow}
              showRulesReviewPrompt={showCpfRulesReviewPrompt}
            />
          </PageSection>

          <PageSection id="wealth-cash-debts" title="Cash and debts">
            <CashAndLiabilitiesPanels
              cashRows={cashBalanceRows}
              cashHistoryByAccountId={cashHistoryByAccountId}
              liabilityRows={bundle.liabilityRows}
              currencyCode={currency}
            />
          </PageSection>

          <PageSection
            id="wealth-housing"
            title="Housing"
            description={
              <span className="text-xs text-zinc-600">
                Properties you own and linked mortgages. OA instalments feed CPF
                and cash-flow projections.{" "}
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
              properties={bundle.properties}
              loans={bundle.housingLoans}
              currencyCode={currency}
            />
          </PageSection>

          <PageSection
            id="wealth-vehicles"
            title="Vehicles (Singapore)"
            description={
              <span className="text-xs text-zinc-600">
                Fill market value for the quickest setup. Use other fields only if
                needed.
              </span>
            }
          >
            <VehiclesPanel vehicles={bundle.vehicleRows} currencyCode={currency} />
          </PageSection>
        </div>
        <aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-2xl bg-slate-50/80 p-4 text-sm text-slate-600 ring-1 ring-slate-200/70">
            <p className="font-semibold text-[#0c192f]">Classic setup path</p>
            <p className="mt-2 leading-relaxed">
              Deep links still resolve: use{" "}
              <Link href="/setup?tab=add-account" className={appInlineLinkClass}>
                Financial setup
              </Link>{" "}
              if you prefer the original tab layout.
            </p>
          </div>
          <AccountSyncingRoadmapCard />
        </aside>
      </div>
    </div>
  );
}
