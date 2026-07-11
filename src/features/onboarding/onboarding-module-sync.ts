/**
 * Onboarding → app module sync (single source of truth: `financial_profiles`).
 *
 * Onboarding PATCHes `/api/profile`; there is no duplicate onboarding table.
 * Later edits in Setup / Planning update the same columns — modules read profile
 * via repositories and mappers, not a separate onboarding snapshot.
 *
 * | Onboarding capture              | Profile column(s)              | Consumed by                          |
 * |---------------------------------|--------------------------------|--------------------------------------|
 * | Gross monthly income            | `monthly_gross_salary`,        | Income (Setup profile), dashboard    |
 * | (+ default CPF band)            | `cpf_age_band`, `monthly_income` (derived take-home) | `profileSalaryTakeHomeMonthly`, budget |
 * | Bonus months / custom amount    | `annual_bonus`, `annual_bonus_months` | Income, CPF bonus, projections |
 * | Retirement targets (all fields)   | `target_retirement_age`, `retirement_monthly_spend_goal`, `expense_growth_nominal`, `retirement_dividend_yield_annual`, `retirement_withdrawal_rate_annual` | Goals → Retirement targets |
 * | Savings target                  | `savings_target_monthly`       | Setup hub emergency funds evaluator  |
 * | Debt payments                   | `debt_obligations_monthly`     | Profile commitments (not liability rows) |
 * | Allocation style                | `budgeting_strategy`           | Guided budget + Lifestyle Profile form |
 * | Lifestyle + food band           | `lifestyle_profile`, `food_spend_band` | Guided budget generator        |
 * | Currency                        | `base_currency`                | Profile / display                    |
 * | Optional guided lines           | `financial_budget_lines`       | Budget, Activity, dashboard          |
 *
 * Legacy users may only have `monthly_income` (take-home entered before gross UX).
 * Mappers fall back to stored take-home when gross + CPF band are absent.
 */

export {};
