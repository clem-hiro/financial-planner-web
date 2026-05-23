import type { SupabaseClient } from "@supabase/supabase-js";
import type { CashAccountPurpose, CashAccountRow } from "@/data/supabase/types";
import { insertCashAccountSnapshot } from "@/data/repositories/cash-account-snapshots";

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
  row: { name: string; balance: number; purpose: CashAccountPurpose }
): Promise<CashAccountRow> {
  const { data, error } = await supabase
    .from("financial_cash_accounts")
    .insert({
      user_id: userId,
      name: row.name,
      balance: row.balance,
      purpose: row.purpose,
    })
    .select()
    .single();
  if (error) throw error;
  const account = data as CashAccountRow;
  await insertCashAccountSnapshot(supabase, userId, account.id, row.balance);
  return account;
}

export async function updateCashAccount(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  patch: { name: string; balance: number; purpose: CashAccountPurpose }
): Promise<void> {
  const { error } = await supabase
    .from("financial_cash_accounts")
    .update(patch)
    .eq("user_id", userId)
    .eq("id", id);
  if (error) throw error;
  await insertCashAccountSnapshot(supabase, userId, id, patch.balance);
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
