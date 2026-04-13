import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProfileRow } from "@/data/supabase/types";

export async function getProfileById(
  supabase: SupabaseClient,
  userId: string
): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as ProfileRow | null;
}

export async function updateProfile(
  supabase: SupabaseClient,
  userId: string,
  patch: {
    display_name?: string | null;
    monthly_income?: number | null;
    monthly_gross_salary?: number | null;
    cpf_age_band?: string | null;
    birth_date?: string | null;
    target_retirement_age?: number | null;
    retirement_monthly_spend_goal?: number | null;
    retirement_dividend_yield_annual?: number | null;
    annual_salary_growth_nominal?: number | null;
  }
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update(patch)
    .eq("id", userId);
  if (error) throw error;
}
