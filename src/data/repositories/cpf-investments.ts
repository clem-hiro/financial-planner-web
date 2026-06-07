import type { SupabaseClient } from "@supabase/supabase-js";
import type { CpfInvestmentRow } from "@/data/supabase/types";

export type CpfInvestmentWrite = {
  account: "oa" | "sa";
  purchase_month: string;
  premium_type: "single" | "regular";
  amount: number;
  projected_growth_annual: number;
  maturity_month: string;
  note?: string | null;
};

export async function listCpfInvestments(
  supabase: SupabaseClient,
  userId: string
): Promise<CpfInvestmentRow[]> {
  const { data, error } = await supabase
    .from("financial_cpf_investments")
    .select("*")
    .eq("user_id", userId)
    .order("purchase_month", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CpfInvestmentRow[];
}

export async function advisorReadCpfInvestments(
  supabase: SupabaseClient,
  clientId: string
): Promise<CpfInvestmentRow[]> {
  const { data, error } = await supabase.rpc("advisor_read_cpf_investments", {
    p_client: clientId,
  });
  if (error) throw error;
  return (data ?? []) as CpfInvestmentRow[];
}

export async function insertCpfInvestment(
  supabase: SupabaseClient,
  userId: string,
  row: CpfInvestmentWrite
): Promise<CpfInvestmentRow> {
  const { data, error } = await supabase
    .from("financial_cpf_investments")
    .insert({
      user_id: userId,
      account: row.account,
      purchase_month: row.purchase_month,
      premium_type: row.premium_type,
      amount: row.amount,
      projected_growth_annual: row.projected_growth_annual,
      maturity_month: row.maturity_month,
      note: row.note ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as CpfInvestmentRow;
}

export async function deleteCpfInvestment(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<void> {
  const { error } = await supabase
    .from("financial_cpf_investments")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);
  if (error) throw error;
}
