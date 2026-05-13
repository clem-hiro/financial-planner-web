import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getCpfBalanceByUserId } from "@/data/repositories/cpf-balances";
import { listCashAccounts } from "@/data/repositories/cash-accounts";
import { listHousingLoans } from "@/data/repositories/housing-loans";
import { listInvestments } from "@/data/repositories/investments";
import { listLiabilities } from "@/data/repositories/liabilities";
import { listFinancialGoals } from "@/data/repositories/goals";
import { listVehicles } from "@/data/repositories/vehicles";
import type {
  CashAccountRow,
  CpfBalanceRow,
  FinancialGoalRow,
  HousingLoanRow,
  InvestmentRow,
  LiabilityRow,
  VehicleRow,
} from "@/data/supabase/types";

export type SetupTabBundle = {
  investments: InvestmentRow[];
  cashAccounts: CashAccountRow[];
  liabilityRows: LiabilityRow[];
  vehicleRows: VehicleRow[];
  cpfRow: CpfBalanceRow | null;
  housingLoans: HousingLoanRow[];
  goals: FinancialGoalRow[];
};

/**
 * Loads repository data for one or more financial-setup tabs in a single round trip.
 * Mirrors the conditional fetching in `(app)/setup/page.tsx` so planning workspaces
 * can compose multiple tabs without changing business logic.
 */
export async function loadSetupTabBundle(
  supabase: SupabaseClient,
  userId: string,
  tabs: ReadonlySet<string>
): Promise<SetupTabBundle> {
  const needInvestments =
    tabs.has("add-account") || tabs.has("goals");
  const needCash = tabs.has("cash-liabilities");
  const needLiabilities = tabs.has("cash-liabilities");
  const needVehicles = tabs.has("vehicles");
  const needCpf = tabs.has("cpf");
  const needHousing = tabs.has("housing-loans");
  const needGoals = tabs.has("goals");

  const [
    investments,
    cashAccounts,
    liabilityRows,
    vehicleRows,
    cpfRow,
    housingLoans,
    goals,
  ] = await Promise.all([
    needInvestments
      ? listInvestments(supabase, userId)
      : Promise.resolve([] as InvestmentRow[]),
    needCash
      ? listCashAccounts(supabase, userId)
      : Promise.resolve([] as CashAccountRow[]),
    needLiabilities
      ? listLiabilities(supabase, userId)
      : Promise.resolve([] as LiabilityRow[]),
    needVehicles
      ? listVehicles(supabase, userId)
      : Promise.resolve([] as VehicleRow[]),
    needCpf
      ? getCpfBalanceByUserId(supabase, userId)
      : Promise.resolve(null),
    needHousing
      ? listHousingLoans(supabase, userId)
      : Promise.resolve([] as HousingLoanRow[]),
    needGoals
      ? listFinancialGoals(supabase, userId)
      : Promise.resolve([] as FinancialGoalRow[]),
  ]);

  return {
    investments,
    cashAccounts,
    liabilityRows,
    vehicleRows,
    cpfRow,
    housingLoans,
    goals,
  };
}
