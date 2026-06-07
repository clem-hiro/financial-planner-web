import { num } from "@/data/mappers";
import type { ProfileRow } from "@/data/supabase/types";

/** Map profile row → props for `RetirementTargetsForm` / `FinancialGoalsPanels`. */
export function profileRetirementTargetsProps(profile: ProfileRow | null) {
  return {
    initialTargetRetirementAge:
      profile?.target_retirement_age != null
        ? Number(profile.target_retirement_age)
        : null,
    initialRetirementMonthlySpendGoal:
      profile?.retirement_monthly_spend_goal != null &&
      String(profile.retirement_monthly_spend_goal).trim() !== ""
        ? num(profile.retirement_monthly_spend_goal)
        : null,
    initialExpenseGrowthPercent:
      profile?.expense_growth_nominal != null &&
      String(profile.expense_growth_nominal).trim() !== ""
        ? num(profile.expense_growth_nominal) * 100
        : null,
    initialRetirementDividendYieldPercent:
      profile?.retirement_dividend_yield_annual != null &&
      String(profile.retirement_dividend_yield_annual).trim() !== ""
        ? num(profile.retirement_dividend_yield_annual) * 100
        : null,
    initialRetirementWithdrawalRatePercent:
      profile?.retirement_withdrawal_rate_annual != null &&
      String(profile.retirement_withdrawal_rate_annual).trim() !== ""
        ? num(profile.retirement_withdrawal_rate_annual) * 100
        : null,
  };
}
