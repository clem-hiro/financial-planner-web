import type { SupabaseClient } from "@supabase/supabase-js";
import type { CashAccountRow } from "@/data/supabase/types";

export async function listCashAccounts(
  supabase: SupabaseClient,
  userId: string
): Promise<CashAccountRow[]> {
  const { data, error } = await supabase
    .from("financial_cash_accounts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CashAccountRow[];
}

/**
 * Consent-gated advisor read. Drop-in for `listCashAccounts` on the advisor
 * path: RPC `returns setof financial_cash_accounts` ⇒ identical
 * `CashAccountRow` shape. Not consented ⇒ zero rows (fail-closed).
 */
export async function advisorReadCashAccounts(
  supabase: SupabaseClient,
  clientId: string
): Promise<CashAccountRow[]> {
  const { data, error } = await supabase.rpc("advisor_read_cash_accounts", {
    p_client: clientId,
  });
  if (error) throw error;
  return (data ?? []) as CashAccountRow[];
}

export async function insertCashAccount(
  supabase: SupabaseClient,
  userId: string,
  row: { name: string; balance: number }
): Promise<CashAccountRow> {
  const { data, error } = await supabase
    .from("financial_cash_accounts")
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
    .from("financial_cash_accounts")
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
    .from("financial_cash_accounts")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);
  if (error) throw error;
}
