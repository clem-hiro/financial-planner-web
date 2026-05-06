import type { SupabaseClient } from "@supabase/supabase-js";
import type { CpfBalanceRow } from "@/data/supabase/types";

export async function getCpfBalanceByUserId(
  supabase: SupabaseClient,
  userId: string
): Promise<CpfBalanceRow | null> {
  const { data, error } = await supabase
    .from("financial_cpf_balances")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as CpfBalanceRow) ?? null;
}

export async function upsertCpfBalance(
  supabase: SupabaseClient,
  userId: string,
  row: {
    oa: number;
    sa: number;
    ma: number;
    oa_annual_rate: number | null;
    sa_annual_rate: number | null;
    ma_annual_rate: number | null;
    cpfis_monthly_from_oa: number;
    cpfis_notional_balance: number;
    cpfis_annual_return: number;
  }
): Promise<CpfBalanceRow> {
  const { data, error } = await supabase
    .from("financial_cpf_balances")
    .upsert(
      {
        user_id: userId,
        oa: row.oa,
        sa: row.sa,
        ma: row.ma,
        oa_annual_rate: row.oa_annual_rate,
        sa_annual_rate: row.sa_annual_rate,
        ma_annual_rate: row.ma_annual_rate,
        cpfis_monthly_from_oa: row.cpfis_monthly_from_oa,
        cpfis_notional_balance: row.cpfis_notional_balance,
        cpfis_annual_return: row.cpfis_annual_return,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    .select()
    .single();
  if (error) throw error;
  return data as CpfBalanceRow;
}

export async function deleteCpfBalance(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from("financial_cpf_balances")
    .delete()
    .eq("user_id", userId);
  if (error) throw error;
}
