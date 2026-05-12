import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProfileRow } from "@/data/supabase/types";

export async function getProfileById(
  supabase: SupabaseClient,
  userId: string
): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from("financial_profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as ProfileRow;
  return {
    ...row,
    profile_type: row.profile_type === "client" ? "client" : "advisor",
    advisor_user_id: row.advisor_user_id ?? null,
  };
}

export async function updateProfile(
  supabase: SupabaseClient,
  userId: string,
  patch: {
    display_name?: string | null;
    monthly_income?: number | null;
    salary_frequency?: "monthly" | "biweekly" | "weekly" | "annual" | null;
    annual_bonus?: number | null;
    savings_target_monthly?: number | null;
    fixed_expenses_monthly?: number | null;
    debt_obligations_monthly?: number | null;
    monthly_gross_salary?: number | null;
    cpf_age_band?: string | null;
    birth_date?: string | null;
    target_retirement_age?: number | null;
    retirement_monthly_spend_goal?: number | null;
    retirement_dividend_yield_annual?: number | null;
    retirement_withdrawal_rate_annual?: number | null;
    annual_salary_growth_nominal?: number | null;
    onboarding_required?: boolean;
    onboarding_step?: number | null;
    onboarding_completed_at?: string | null;
    base_currency?: string;
    lifestyle_profile?: string | null;
    budgeting_strategy?: string | null;
    onboarding_confidence_level?: string | null;
    budget_generation_source?: string | null;
    estimated_budget_mode?: boolean;
    food_spend_band?: string | null;
  }
): Promise<void> {
  const { error } = await supabase
    .from("financial_profiles")
    .update(patch)
    .eq("id", userId);
  if (error) throw error;
}
