import type { SupabaseClient } from "@supabase/supabase-js";
import type { CashAccountRow } from "@/data/supabase/types";

export async function listCashAccounts(
  supabase: SupabaseClient,
  userId: string
): Promise<CashAccountRow[]> {
  const { data, error } = await supabase
    .from("cash_accounts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CashAccountRow[];
}

export async function insertCashAccount(
  supabase: SupabaseClient,
  userId: string,
  row: { name: string; balance: number }
): Promise<CashAccountRow> {
  const { data, error } = await supabase
    .from("cash_accounts")
    .insert({
      user_id: userId,
      name: row.name,
      balance: row.balance,
    })
    .select()
    .single();
  if (error) throw error;
  return data as CashAccountRow;
}

export async function updateCashAccount(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  patch: { name: string; balance: number }
): Promise<void> {
  const { error } = await supabase
    .from("cash_accounts")
    .update(patch)
    .eq("user_id", userId)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteCashAccount(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<void> {
  const { error } = await supabase
    .from("cash_accounts")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);
  if (error) throw error;
}
