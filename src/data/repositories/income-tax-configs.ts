import type { SupabaseClient } from "@supabase/supabase-js";
import type { IncomeTaxConfigRow } from "@/data/supabase/types";

/** Patch shape mirrors writable columns; nulls clear, undefined leaves untouched. */
export type IncomeTaxConfigPatch = {
  year_of_assessment?: number;
  spouse_relief_sgd?: number | null;
  qualifying_child_relief_sgd?: number | null;
  handicapped_child_relief_sgd?: number | null;
  working_mother_child_relief_sgd?: number | null;
  parent_relief_sgd?: number | null;
  grandparent_caregiver_relief_sgd?: number | null;
  handicapped_sibling_relief_sgd?: number | null;
  cpf_cash_topup_self_sgd?: number | null;
  cpf_cash_topup_family_sgd?: number | null;
  srs_contribution_sgd?: number | null;
  cpf_medisave_voluntary_sgd?: number | null;
  nsman_self_relief_sgd?: number | null;
  nsman_wife_relief_sgd?: number | null;
  nsman_parent_relief_sgd?: number | null;
  course_fees_relief_sgd?: number | null;
  life_insurance_relief_sgd?: number | null;
  other_reliefs_amount_sgd?: number | null;
  other_reliefs_notes?: string | null;
  tax_rebate_percent?: number | null;
  tax_rebate_cap_sgd?: number | null;
  payment_method?: "monthly_giro" | "one_time";
};

export async function getIncomeTaxConfig(
  supabase: SupabaseClient,
  userId: string
): Promise<IncomeTaxConfigRow | null> {
  const { data, error } = await supabase
    .from("financial_income_tax_configs")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as IncomeTaxConfigRow | null) ?? null;
}

/**
 * Singleton upsert keyed on `user_id` (DB has `unique(user_id)`). Caller-supplied
 * fields override defaults; missing fields keep their existing values on update
 * because Supabase upsert sends only the listed columns.
 */
export async function upsertIncomeTaxConfig(
  supabase: SupabaseClient,
  userId: string,
  patch: IncomeTaxConfigPatch
): Promise<IncomeTaxConfigRow> {
  const { data, error } = await supabase
    .from("financial_income_tax_configs")
    .upsert(
      { user_id: userId, ...patch, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    )
    .select()
    .single();
  if (error) throw error;
  return data as IncomeTaxConfigRow;
}
