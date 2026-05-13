export type FinancialProfileType = "advisor" | "client";

export type ProfileRow = {
  id: string;
  /** `advisor` (default) or `client` (signup via advisor access key). */
  profile_type: FinancialProfileType;
  /** For clients: issuing advisor's auth user id. */
  advisor_user_id: string | null;
  display_name: string | null;
  monthly_income: string | null;
  salary_frequency: "monthly" | "biweekly" | "weekly" | "annual" | null;
  annual_bonus: string | null;
  savings_target_monthly: string | null;
  fixed_expenses_monthly: string | null;
  debt_obligations_monthly: string | null;
  monthly_gross_salary: string | null;
  /** Nominal annual raise as decimal (e.g. 0.02); null = no growth in CPF projection. */
  annual_salary_growth_nominal: string | null;
  cpf_age_band: string | null;
  /** `YYYY-MM-DD` when set. */
  birth_date: string | null;
  target_retirement_age: number | null;
  /** Desired monthly spend in retirement (major units); optional. */
  retirement_monthly_spend_goal: string | null;
  /** Annual dividend yield on investments in retirement (0–0.25); optional. */
  retirement_dividend_yield_annual: string | null;
  /** Annual withdrawal rate used for simplified retirement spend checks. */
  retirement_withdrawal_rate_annual: string | null;
  onboarding_required: boolean;
  onboarding_step: number | null;
  onboarding_completed_at: string | null;
  /** Guided budget setup — optional preset; see domain `LifestyleProfileId`. */
  lifestyle_profile: string | null;
  /** Needs / wants / savings style; see domain `BudgetingStrategyId`. */
  budgeting_strategy: string | null;
  /** How precise the user wants to be during onboarding (rough estimates ok). */
  onboarding_confidence_level: string | null;
  /** Where monthly budget lines came from (manual vs guided, etc.). */
  budget_generation_source: string | null;
  /** When true, UI may emphasize ranges and estimates over exact figures. */
  estimated_budget_mode: boolean;
  /** Optional rough monthly food spend band (SGD-oriented labels in UI). */
  food_spend_band: string | null;
  base_currency: string;
  created_at: string;
};

export type AdvisorAccessKeyRow = {
  id: string;
  advisor_user_id: string;
  access_key: string;
  status: "available" | "claimed" | "expired";
  claimed_by_user_id: string | null;
  claimed_at: string | null;
  expires_at: string | null;
  created_at: string;
};

export type ExpenseRow = {
  id: string;
  user_id: string;
  amount: string;
  category: string;
  spent_at: string;
  note: string | null;
  created_at: string;
  spend_period?: "monthly" | "annual";
};

export type BudgetLineRow = {
  id: string;
  user_id: string;
  category: string;
  cadence: "monthly" | "annual";
  amount: string;
  calendar_year: number | null;
  start_year_month?: string | null;
  end_year_month?: string | null;
  created_at: string;
};

export type BudgetLineMonthOverrideRow = {
  id: string;
  user_id: string;
  budget_line_id: string;
  year_month: string;
  amount: string;
  created_at: string;
};

export type InvestmentRow = {
  id: string;
  user_id: string;
  name: string;
  current_value: string;
  monthly_contribution: string;
  expected_annual_return: string;
  /** until_retirement | fixed_duration; null = legacy / same as until retirement. */
  contribution_type?: string | null;
  /** Years of monthly contributions when type is fixed_duration. */
  contribution_duration_years?: string | null;
  /** Reserved for future age-based contribution end. */
  contribution_end_age?: number | null;
  /** Reserved for calendar-based contribution end. */
  contribution_end_date?: string | null;
  created_at: string;
  updated_at: string;
};

export type CashAccountRow = {
  id: string;
  user_id: string;
  name: string;
  balance: string;
  created_at: string;
};

export type LiabilityRow = {
  id: string;
  user_id: string;
  name: string;
  balance: string;
  created_at: string;
};

export type VehicleRow = {
  id: string;
  user_id: string;
  label: string;
  vehicle_status: "active" | "planned";
  /** When set, gross asset = this (e.g. motorcycle market / listing). */
  current_market_value?: string | null;
  first_registration_ym: string | null;
  on_the_road_paid: string;
  arf_for_parf: string | null;
  body_open_market_at_purchase: string | null;
  body_depreciation_years: number;
  /** COE expiry month YYYY-MM (informational). */
  coe_expiry_ym?: string | null;
  /** From OneMotoring / LTA — when either value is set, drives asset instead of modelled body+PARF. */
  parf_if_deregistered_today?: string | null;
  coe_if_deregistered_today?: string | null;
  /** Scrap / body (not on LTA PARF); added to gross with PARF+COE when using anchors. */
  body_scrap_if_deregistered_today?: string | null;
  loan_balance: string;
  loan_monthly_payment: string;
  loan_months_remaining: number | null;
  /** Derive months remaining for PV vs `formatYearMonth(asOf)` when set. */
  loan_end_ym?: string | null;
  /** When true, `loan_balance` is used instead of PV from instalment. */
  loan_prefer_stored_balance?: boolean;
  /** When true (and not prefer stored), loan = instalment × months left (no PV). */
  loan_simple_remaining_estimate?: boolean;
  /** Rebates + body expected at COE expiry; drives OTR→terminal straight-line gross. */
  terminal_recovery_at_coe_expiry?: string | null;
  loan_annual_nominal_rate: string | null;
  display_order: number;
  created_at: string;
};

export type FinancialGoalRow = {
  id: string;
  user_id: string;
  title: string;
  target_amount: string;
  target_date: string | null;
  linked_investment_id: string | null;
  current_amount: string;
  monthly_contribution: string;
  expected_annual_return: string;
  created_at: string;
};

export type CpfBalanceRow = {
  user_id: string;
  oa: string;
  sa: string;
  ma: string;
  oa_annual_rate: string | null;
  sa_annual_rate: string | null;
  ma_annual_rate: string | null;
  cpfis_monthly_from_oa: string;
  cpfis_notional_balance: string;
  cpfis_annual_return: string;
  updated_at: string;
};

export type HousingLoanRow = {
  id: string;
  user_id: string;
  label: string;
  /** Outstanding balance when scheduled repayments start (drives amortization). */
  principal: string;
  annual_nominal_rate: string;
  term_months: number;
  completion_month: string;
  first_payment_month: string;
  downpayment_from_oa: string;
  fees_from_oa: string;
  oa_share_of_payment: string;
  max_oa_per_month: string | null;
  lender_type: "hdb" | "bank" | "other";
  original_loan_principal: string | null;
  principal_repaid_before_schedule: string;
  created_at: string;
};
