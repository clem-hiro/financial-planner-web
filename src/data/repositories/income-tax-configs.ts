import type { SupabaseClient } from "@supabase/supabase-js";
import type { IncomeTaxConfigRow } from "@/data/supabase/types";

/**
 * Patch shape mirrors writable columns. Relief amounts are NOT NULL DEFAULT 0
 * in the DB, so they are non-null here (blank = 0, coerced at the Zod layer).
 * Only `other_reliefs_notes` and the rebate pair are nullable (null clears).
 * An omitted key leaves the column untouched (upsert sends only listed columns).
 */
export type IncomeTaxConfigPatch = {
  year_of_assessment?: number;
  spouse_relief_sgd?: number;
  qualifying_child_relief_sgd?: number;
  handicapped_child_relief_sgd?: number;
  working_mother_child_relief_sgd?: number;
  parent_relief_sgd?: number;
  grandparent_caregiver_relief_sgd?: number;
  handicapped_sibling_relief_sgd?: number;
  cpf_cash_topup_self_sgd?: number;
  cpf_cash_topup_family_sgd?: number;
  srs_contribution_sgd?: number;
  cpf_medisave_voluntary_sgd?: number;
  nsman_self_relief_sgd?: number;
  nsman_wife_relief_sgd?: number;
  nsman_parent_relief_sgd?: number;
  course_fees_relief_sgd?: number;
  life_insurance_relief_sgd?: number;
  other_reliefs_amount_sgd?: number;
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
 * Consent-gated advisor read. Drop-in for `getIncomeTaxConfig` on the advisor
 * path: the RPC `returns setof financial_income_tax_configs` (unique per user
 * => 0 or 1 row). Not consented => zero rows => null (fail-closed; the
 * advisor's synthetic-tax projection is omitted until consent).
 */
export async function advisorReadIncomeTaxConfig(
  supabase: SupabaseClient,
  clientId: string
): Promise<IncomeTaxConfigRow | null> {
  const { data, error } = await supabase.rpc("advisor_read_income_tax_config", {
    p_client: clientId,
  });
  if (error) throw error;
  const rows = (data ?? []) as IncomeTaxConfigRow[];
  return rows[0] ?? null;
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
