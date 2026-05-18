import type { SupabaseClient } from "@supabase/supabase-js";
import type { HousingLoanRow } from "@/data/supabase/types";

export async function listHousingLoans(
  supabase: SupabaseClient,
  userId: string
): Promise<HousingLoanRow[]> {
  const { data, error } = await supabase
    .from("financial_housing_loans")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as HousingLoanRow[];
}

/**
 * Consent-gated advisor read. Drop-in for `listHousingLoans` on the advisor
 * path: RPC `returns setof financial_housing_loans` ⇒ identical
 * `HousingLoanRow` shape. Not consented ⇒ zero rows (fail-closed).
 */
export async function advisorReadHousingLoans(
  supabase: SupabaseClient,
  clientId: string
): Promise<HousingLoanRow[]> {
  const { data, error } = await supabase.rpc("advisor_read_housing_loans", {
    p_client: clientId,
  });
  if (error) throw error;
  return (data ?? []) as HousingLoanRow[];
}

export async function insertHousingLoan(
  supabase: SupabaseClient,
  userId: string,
  row: {
    label: string;
    principal: number;
    annual_nominal_rate: number;
    term_months: number;
    completion_month: string;
    first_payment_month: string;
    downpayment_from_oa: number;
    fees_from_oa: number;
    oa_share_of_payment: number;
    max_oa_per_month: number | null;
    lender_type: HousingLoanRow["lender_type"];
    original_loan_principal: number | null;
    principal_repaid_before_schedule: number;
    property_purchase_price?: number | null;
    property_kind?: string | null;
    downpayment_guidance_preset?: string | null;
    downpayment_guidance_custom_percent?: number | null;
    downpayment_guidance_custom_amount?: number | null;
    buyers_stamp_duty?: number | null;
    financing_includes_bsd?: boolean;
    buyers_stamp_duty_paid_from_cpf_oa?: boolean;
  }
): Promise<HousingLoanRow> {
  const { data, error } = await supabase
    .from("financial_housing_loans")
    .insert({
      user_id: userId,
      label: row.label,
      principal: row.principal,
      annual_nominal_rate: row.annual_nominal_rate,
      term_months: row.term_months,
      completion_month: row.completion_month,
      first_payment_month: row.first_payment_month,
      downpayment_from_oa: row.downpayment_from_oa,
      fees_from_oa: row.fees_from_oa,
      oa_share_of_payment: row.oa_share_of_payment,
      max_oa_per_month: row.max_oa_per_month,
      lender_type: row.lender_type,
      original_loan_principal: row.original_loan_principal,
      principal_repaid_before_schedule: row.principal_repaid_before_schedule,
      property_purchase_price: row.property_purchase_price ?? null,
      property_kind: row.property_kind ?? null,
      downpayment_guidance_preset: row.downpayment_guidance_preset ?? null,
      downpayment_guidance_custom_percent:
        row.downpayment_guidance_custom_percent ?? null,
      downpayment_guidance_custom_amount:
        row.downpayment_guidance_custom_amount ?? null,
      buyers_stamp_duty: row.buyers_stamp_duty ?? null,
      financing_includes_bsd: row.financing_includes_bsd ?? false,
      buyers_stamp_duty_paid_from_cpf_oa:
        row.buyers_stamp_duty_paid_from_cpf_oa ?? false,
    })
    .select()
    .single();
  if (error) throw error;
  return data as HousingLoanRow;
}

export async function updateHousingLoan(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  patch: Partial<{
    label: string;
    principal: number;
    annual_nominal_rate: number;
    term_months: number;
    completion_month: string;
    first_payment_month: string;
    downpayment_from_oa: number;
    fees_from_oa: number;
    oa_share_of_payment: number;
    max_oa_per_month: number | null;
    lender_type: HousingLoanRow["lender_type"];
    original_loan_principal: number | null;
    principal_repaid_before_schedule: number;
    property_purchase_price?: number | null;
    property_kind?: string | null;
    downpayment_guidance_preset?: string | null;
    downpayment_guidance_custom_percent?: number | null;
    downpayment_guidance_custom_amount?: number | null;
    buyers_stamp_duty?: number | null;
    financing_includes_bsd?: boolean;
    buyers_stamp_duty_paid_from_cpf_oa?: boolean;
  }>
): Promise<void> {
  const { error } = await supabase
    .from("financial_housing_loans")
    .update(patch)
    .eq("user_id", userId)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteHousingLoan(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<void> {
  const { error } = await supabase
    .from("financial_housing_loans")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);
  if (error) throw error;
}
