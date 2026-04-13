import Link from "next/link";
import { num } from "@/data/mappers";
import { getCpfBalanceByUserId } from "@/data/repositories/cpf-balances";
import { listCashAccounts } from "@/data/repositories/cash-accounts";
import { listInvestments } from "@/data/repositories/investments";
import { listHousingLoans } from "@/data/repositories/housing-loans";
import { listLiabilities } from "@/data/repositories/liabilities";
import { listVehicles } from "@/data/repositories/vehicles";
import { getProfileById } from "@/data/repositories/profiles";
import { createSupabaseServerClient } from "@/data/supabase/server";
import {
  CashAndLiabilitiesPanels,
  type CashAccountBalanceRow,
  type LiabilityBalanceRow,
} from "@/features/goals/CashAndLiabilitiesPanels";
import { CpfBalancesForm } from "@/features/goals/CpfBalancesForm";
import { HousingLoansPanel } from "@/features/goals/HousingLoansPanel";
import { VehiclesPanel } from "@/features/goals/VehiclesPanel";
import {
  InvestmentBalancesList,
  type InvestmentBalanceRow,
} from "@/features/goals/InvestmentBalancesList";
import { InvestmentForm } from "@/features/goals/InvestmentForm";
import { MethodologyOpenLink } from "@/features/help/MethodologyOpenLink";
import { DEFAULT_BASE_CURRENCY } from "@/lib/currency";
import { isSupabaseConfigured } from "@/lib/env";
import { appInlineLinkClass } from "@/ui/app-link-styles";
import { PageSection } from "@/ui/PageSection";

export default async function BalancesPage() {
  if (!isSupabaseConfigured()) {
    return (
      <p className="text-sm text-zinc-600">
        Configure Supabase environment variables to track balances.
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
        <h1 className="text-2xl font-semibold">Balances</h1>
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
  const currency = profile?.base_currency ?? DEFAULT_BASE_CURRENCY;

  const investmentBalanceRows: InvestmentBalanceRow[] = investments.map(
    (i) => ({
      id: i.id,
      name: i.name,
      current_value: num(i.current_value),
      monthly_contribution: num(i.monthly_contribution),
      expected_annual_return: num(i.expected_annual_return),
    })
  );

  const cashBalanceRows: CashAccountBalanceRow[] = cashAccounts.map((r) => ({
    id: r.id,
    name: r.name,
    balance: num(r.balance),
  }));

  const liabilityBalanceRows: LiabilityBalanceRow[] = liabilityRows.map(
    (r) => ({
      id: r.id,
      name: r.name,
      balance: num(r.balance),
    })
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Balances</h1>
        <p className="mt-1 text-sm text-zinc-500">
          <strong>Assets &amp; liabilities</strong> you track here feed{" "}
          <Link href="/dashboard" className={appInlineLinkClass}>
            net worth
          </Link>
          .{" "}
          <Link href="#housing-loans" className={appInlineLinkClass}>
            Housing loans
          </Link>{" "}
          (mortgages) sit with other debts below. Savings targets:{" "}
          <Link href="/goals" className={appInlineLinkClass}>
            Goals
          </Link>
          .
        </p>
        <p className="mt-2 flex flex-wrap gap-x-3 text-xs text-zinc-600">
          <MethodologyOpenLink topicId="net-worth" className={appInlineLinkClass}>
            How net worth uses these accounts →
          </MethodologyOpenLink>
          <MethodologyOpenLink topicId="cpf-projection" className={appInlineLinkClass}>
            CPF projection →
          </MethodologyOpenLink>
          <MethodologyOpenLink topicId="vehicles-sg" className={appInlineLinkClass}>
            Vehicles (SG) →
          </MethodologyOpenLink>
        </p>
      </div>

      <section id="assets-liabilities" className="scroll-mt-24 space-y-6">
        <h2 className="text-lg font-semibold tracking-tight text-zinc-900">
          Assets &amp; liabilities
        </h2>

        <PageSection
          title="Add investment account"
          description="New accounts appear below and in dashboard projections."
        >
          <InvestmentForm />
        </PageSection>

        <PageSection title="Investment accounts">
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
              OA / SA / MA and optional CPFIS assumptions. Used in net worth and
              CPF-by-age when salary + birth date are set on the dashboard.{" "}
              <MethodologyOpenLink topicId="cpf-projection" className={appInlineLinkClass}>
                Details
              </MethodologyOpenLink>
            </span>
          }
        >
          <CpfBalancesForm row={cpfRow} />
        </PageSection>

        <PageSection title="Cash &amp; liabilities">
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
              Mortgages and OA instalment assumptions. These drive OA draws in
              your CPF-by-age chart when gross salary and birth date are set on
              the dashboard.{" "}
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
          title="Vehicles (Singapore)"
          description={
            <span className="text-xs text-zinc-600">
              Market estimate, PARF/COE + terminal ramp, or OTR→terminal. Planned
              vehicles stay off net worth until Active.
            </span>
          }
        >
          <VehiclesPanel vehicles={vehicleRows} currencyCode={currency} />
        </PageSection>
      </section>
    </div>
  );
}
