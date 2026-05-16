import type { SupabaseClient } from "@supabase/supabase-js";
import type { LiabilityRow } from "@/data/supabase/types";
import type { DebtCategory, LoanType } from "@/domain/finance/debt-repayment";

export type LiabilityWriteInput = {
  name: string;
  balance: number;
  category?: DebtCategory | null;
  loan_type?: LoanType | null;
  interest_rate_annual?: number | null;
  remaining_tenure_months?: number | null;
  monthly_repayment?: number | null;
  repayment_override?: boolean;
  start_date?: string | null;
  notes?: string | null;
};

function rowToDbPayload(row: LiabilityWriteInput): Record<string, unknown> {
  return {
    name: row.name,
    balance: row.balance,
    category: row.category ?? null,
    loan_type: row.loan_type ?? null,
    interest_rate_annual: row.interest_rate_annual ?? null,
    remaining_tenure_months: row.remaining_tenure_months ?? null,
    monthly_repayment: row.monthly_repayment ?? null,
    repayment_override: row.repayment_override ?? false,
    start_date: row.start_date ?? null,
    notes: row.notes ?? null,
  };
}

export async function listLiabilities(
  supabase: SupabaseClient,
  userId: string
): Promise<LiabilityRow[]> {
  const { data, error } = await supabase
    .from("financial_liabilities")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as LiabilityRow[];
}

export async function insertLiability(
  supabase: SupabaseClient,
  userId: string,
  row: LiabilityWriteInput
): Promise<LiabilityRow> {
  const { data, error } = await supabase
    .from("financial_liabilities")
    .insert({
      user_id: userId,
      ...rowToDbPayload(row),
    })
    .select()
    .single();
  if (error) throw error;
  return data as LiabilityRow;
}

export async function updateLiability(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  patch: LiabilityWriteInput
): Promise<LiabilityRow> {
  const { data, error } = await supabase
    .from("financial_liabilities")
    .update(rowToDbPayload(patch))
    .eq("user_id", userId)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as LiabilityRow;
}

export async function deleteLiability(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<void> {
  const { error } = await supabase
    .from("financial_liabilities")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);
  if (error) throw error;
}
