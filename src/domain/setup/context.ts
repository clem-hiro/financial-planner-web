import type {
  BudgetLineRow,
  CashAccountRow,
  CpfBalanceRow,
  FinancialGoalRow,
  HousingLoanRow,
  InvestmentRow,
  LiabilityRow,
  ProfileRow,
  VehicleRow,
} from "@/data/supabase/types";

/**
 * Read-only inputs for setup status evaluators.
 * Loaded once per hub request; advisor views pass the same shape for a client user id.
 */
export type SetupEvaluationContext = {
  profile: ProfileRow | null;
  investments: InvestmentRow[];
  cashAccounts: CashAccountRow[];
  liabilities: LiabilityRow[];
  housingLoans: HousingLoanRow[];
  vehicles: VehicleRow[];
  cpf: CpfBalanceRow | null;
  goals: FinancialGoalRow[];
  budgetLines: BudgetLineRow[];
};
