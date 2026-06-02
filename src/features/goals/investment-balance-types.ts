export type InvestmentBalanceRow = {
  id: string;
  name: string;
  current_value: number;
  monthly_contribution: number;
  expected_annual_return: number;
  investment_income_rate_annual: number;
  contribution_growth_annual: number;
  contribution_type?: string | null;
  contribution_duration_years?: number | null;
  contribution_start_date?: string | null;
  contribution_end_date?: string | null;
  plan_nature?: string | null;
  withdrawal_annual: number;
  withdrawal_monthly: number;
  withdrawal_start_years?: number | null;
  updated_at?: string | null;
  created_at?: string | null;
};
