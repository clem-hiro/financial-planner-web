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
  /** Nominal annual expense growth as decimal (e.g. 0.02); null = read-time 2% default. */
  expense_growth_nominal: string | null;
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
  /** Calendar month (1-12) when the user expects their salary review; null = opt-out. */
  salary_increment_month: number | null;
  /** ISO timestamp of the most recent salary-review acknowledgement. */
  last_salary_review_at: string | null;
  created_at: string;
};

export type AdvisorAccessKeyRow = {
  id: string;
  advisor_user_id: string;
  purchase_id: string | null;
  access_key: string;
  status: "available" | "claimed" | "expired";
  claimed_by_user_id: string | null;
  claimed_at: string | null;
  expires_at: string | null;
  created_at: string;
};

export type AdvisorQrShareTokenRow = {
  token_hash: string;
  access_key: string;
  advisor_user_id: string;
  expires_at: string;
  consumed_at: string | null;
  claimed_by_user_id: string | null;
  created_at: string;
};

export type PurchaseStatus =
  | "pending"
  | "paid"
  | "fulfilled"
  | "failed"
  | "refunded";

export type PaymentProvider = "mock" | "stripe";

export type PricingRow = {
  product_code: string;
  price_cents: number;
  currency: string;
  updated_at: string;
};

export type CouponKind = "discount_percent" | "free_keys";

export type CouponRow = {
  id: string;
  advisor_user_id: string | null;
  code: string;
  kind: CouponKind;
  discount_percent: number;
  free_key_quantity: number | null;
  remaining_redemptions: number | null;
  expires_at: string | null;
  archived_at: string | null;
  created_at: string;
};

export type PurchaseRow = {
  id: string;
  advisor_user_id: string;
  product_code: string;
  idempotency_key: string;
  requested_quantity: number;
  free_key_quantity: number;
  paid_key_quantity: number;
  unit_price_cents: number;
  gross_cents: number;
  discount_cents: number;
  net_cents: number;
  currency: string;
  coupon_id: string | null;
  payment_provider: PaymentProvider;
  payment_intent_id: string | null;
  status: PurchaseStatus;
  created_at: string;
  paid_at: string | null;
  fulfilled_at: string | null;
};

export type CouponRedemptionRow = {
  id: string;
  advisor_user_id: string;
  coupon_id: string;
  purchase_id: string;
  redeemed_at: string;
};

export type CouponValidationAttemptRow = {
  id: string;
  advisor_user_id: string;
  attempted_at: string;
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
  source_liability_id?: string | null;
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
  category?:
    | "property"
    | "vehicle"
    | "personal"
    | "credit_card"
    | "renovation"
    | "education"
    | "other"
    | null;
  loan_type?: "amortized" | "flat_rate" | "revolving" | null;
  interest_rate_annual?: string | null;
  remaining_tenure_months?: number | null;
  monthly_repayment?: string | null;
  repayment_override?: boolean;
  start_date?: string | null;
  notes?: string | null;
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

export type AdvisorProposalStatus =
  | "draft"
  | "pending"
  | "accepted"
  | "rejected"
  | "withdrawn";

/** Advisor proposal header (migration `20260524000000`). */
export type AdvisorProposalRow = {
  id: string;
  advisor_user_id: string;
  client_user_id: string;
  status: AdvisorProposalStatus;
  advisor_note: string | null;
  submitted_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AdvisorProposalChangeRow = {
  id: string;
  proposal_id: string;
  section: string;
  entity_type: "profile" | "budget_line" | "goal" | "investment";
  entity_id: string | null;
  field_key: string;
  field_label: string;
  old_value: string | null;
  new_value: string | null;
  explanation: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type AdvisorProposalSectionNoteRow = {
  proposal_id: string;
  section: string;
  note: string;
};

/** Generic inbox row (migration `20260519000000`). Dedupe-keyed per user. */
export type InboxNotificationRow = {
  id: string;
  user_id: string;
  /** Producer label; consumers use this to know which mark-as-read action to call. */
  kind: string;
  title: string;
  body: string | null;
  cta_label: string | null;
  cta_href: string | null;
  /** Unique per `user_id`; producers re-upsert idempotently with `ignoreDuplicates`. */
  dedupe_key: string;
  read_at: string | null;
  created_at: string;
  updated_at: string;
};

/** Singapore income tax inputs (migration `20260518000000`). One row per user. */
export type IncomeTaxConfigRow = {
  id: string;
  user_id: string;
  year_of_assessment: number;
  spouse_relief_sgd: string;
  qualifying_child_relief_sgd: string;
  handicapped_child_relief_sgd: string;
  working_mother_child_relief_sgd: string;
  parent_relief_sgd: string;
  grandparent_caregiver_relief_sgd: string;
  handicapped_sibling_relief_sgd: string;
  cpf_cash_topup_self_sgd: string;
  cpf_cash_topup_family_sgd: string;
  srs_contribution_sgd: string;
  cpf_medisave_voluntary_sgd: string;
  nsman_self_relief_sgd: string;
  nsman_wife_relief_sgd: string;
  nsman_parent_relief_sgd: string;
  course_fees_relief_sgd: string;
  life_insurance_relief_sgd: string;
  other_reliefs_amount_sgd: string;
  other_reliefs_notes: string | null;
  /** Both rebate fields are set together or both null (DB CHECK + Zod superRefine). */
  tax_rebate_percent: string | null;
  tax_rebate_cap_sgd: string | null;
  payment_method: "monthly_giro" | "one_time";
  created_at: string;
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
  /** Present when saved via guided property flow (migration `20260516000000`). */
  property_purchase_price?: string | null;
  property_kind?: string | null;
  downpayment_guidance_preset?: string | null;
  downpayment_guidance_custom_percent?: string | null;
  downpayment_guidance_custom_amount?: string | null;
  buyers_stamp_duty?: string | null;
  financing_includes_bsd?: boolean;
  /** When true, estimated BSD was saved as paid from OA (rolled into fees_from_oa). */
  buyers_stamp_duty_paid_from_cpf_oa?: boolean;
  /** `cash` | `cpf_oa` | `split`; null = legacy (infer from oa_share_of_payment). */
  payment_source?: "cash" | "cpf_oa" | "split" | null;
  /** Monthly OA instalment when `payment_source` is `split`. */
  cpf_oa_payment?: string | null;
  /** Monthly cash instalment when `payment_source` is `split`. */
  cash_payment?: string | null;
};
