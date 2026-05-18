import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getCpfBalanceByUserId,
  advisorReadCpfBalances,
} from "@/data/repositories/cpf-balances";
import {
  listCashAccounts,
  advisorReadCashAccounts,
} from "@/data/repositories/cash-accounts";
import {
  listHousingLoans,
  advisorReadHousingLoans,
} from "@/data/repositories/housing-loans";
import {
  listProperties,
  advisorReadProperties,
} from "@/data/repositories/properties";
import {
  listInvestments,
  advisorReadInvestments,
} from "@/data/repositories/investments";
import {
  listLiabilities,
  advisorReadLiabilities,
} from "@/data/repositories/liabilities";
import {
  listFinancialGoals,
  advisorReadGoals,
} from "@/data/repositories/goals";
import {
  listVehicles,
  advisorReadVehicles,
} from "@/data/repositories/vehicles";
import type {
  CashAccountRow,
  CpfBalanceRow,
  FinancialGoalRow,
  HousingLoanRow,
  PropertyRow,
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
  properties: PropertyRow[];
  housingLoans: HousingLoanRow[];
  goals: FinancialGoalRow[];
};

/**
 * Loads repository data for one or more financial-setup tabs in a single round trip.
 * Mirrors the conditional fetching in `(app)/setup/page.tsx` so planning workspaces
 * can compose multiple tabs without changing business logic.
 *
 * P2-D1 consent chokepoint: `viewer:"advisor"` routes every table read through
 * the SECURITY DEFINER `advisor_read_*` RPCs with `userId` as the client id
 * (fail-closed empty when not consented). Absent ⇒ unchanged self `.from()`
 * path — byte-identical for every existing caller (all pass self today).
 */
export async function loadSetupTabBundle(
  supabase: SupabaseClient,
  userId: string,
  tabs: ReadonlySet<string>,
  viewer?: "advisor"
): Promise<SetupTabBundle> {
  const isAdvisorViewer = viewer === "advisor";
  const needInvestments =
    tabs.has("add-account") || tabs.has("goals");
  const needCash = tabs.has("cash-liabilities");
  const needLiabilities = tabs.has("cash-liabilities");
  const needVehicles = tabs.has("vehicles");
  const needCpf = tabs.has("cpf");
  const needHousing =
    tabs.has("housing") || tabs.has("housing-loans");
  const needGoals = tabs.has("goals");

  const [
    investments,
    cashAccounts,
    liabilityRows,
    vehicleRows,
    cpfRow,
    properties,
    housingLoans,
    goals,
  ] = await Promise.all([
    needInvestments
      ? (isAdvisorViewer ? advisorReadInvestments : listInvestments)(
          supabase,
          userId
        )
      : Promise.resolve([] as InvestmentRow[]),
    needCash
      ? (isAdvisorViewer ? advisorReadCashAccounts : listCashAccounts)(
          supabase,
          userId
        )
      : Promise.resolve([] as CashAccountRow[]),
    needLiabilities
      ? (isAdvisorViewer ? advisorReadLiabilities : listLiabilities)(
          supabase,
          userId
        )
      : Promise.resolve([] as LiabilityRow[]),
    needVehicles
      ? (isAdvisorViewer ? advisorReadVehicles : listVehicles)(
          supabase,
          userId
        )
      : Promise.resolve([] as VehicleRow[]),
    needCpf
      ? (isAdvisorViewer ? advisorReadCpfBalances : getCpfBalanceByUserId)(
          supabase,
          userId
        )
      : Promise.resolve(null),
    needHousing
      ? (isAdvisorViewer ? advisorReadProperties : listProperties)(
          supabase,
          userId
        )
      : Promise.resolve([] as PropertyRow[]),
    needHousing
      ? (isAdvisorViewer ? advisorReadHousingLoans : listHousingLoans)(
          supabase,
          userId
        )
      : Promise.resolve([] as HousingLoanRow[]),
    needGoals
      ? (isAdvisorViewer ? advisorReadGoals : listFinancialGoals)(
          supabase,
          userId
        )
      : Promise.resolve([] as FinancialGoalRow[]),
  ]);

  return {
    investments,
    cashAccounts,
    liabilityRows,
    vehicleRows,
    cpfRow,
    properties,
    housingLoans,
    goals,
  };
}
