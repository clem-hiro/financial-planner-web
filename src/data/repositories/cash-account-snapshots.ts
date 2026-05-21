import type { SupabaseClient } from "@supabase/supabase-js";
import type { CashAccountSnapshotRow } from "@/data/supabase/types";

const SNAPSHOT_LIST_LIMIT = 240;

export async function listCashAccountSnapshots(
  supabase: SupabaseClient,
  userId: string
): Promise<CashAccountSnapshotRow[]> {
  const { data, error } = await supabase
    .from("financial_cash_account_snapshots")
    .select("*")
    .eq("user_id", userId)
    .order("recorded_at", { ascending: false })
    .limit(SNAPSHOT_LIST_LIMIT);
  if (error) throw error;
  return (data ?? []) as CashAccountSnapshotRow[];
}

/** Consent-gated advisor read; mirrors `listCashAccountSnapshots` ordering/limit. */
export async function advisorReadCashAccountSnapshots(
  supabase: SupabaseClient,
  clientId: string
): Promise<CashAccountSnapshotRow[]> {
  const { data, error } = await supabase.rpc(
    "advisor_read_cash_account_snapshots",
    { p_client: clientId }
  );
  if (error) throw error;
  return (data ?? []) as CashAccountSnapshotRow[];
}

export async function insertCashAccountSnapshot(
  supabase: SupabaseClient,
  userId: string,
  cashAccountId: string,
  balance: number
): Promise<void> {
  const { error } = await supabase.from("financial_cash_account_snapshots").insert({
    user_id: userId,
    cash_account_id: cashAccountId,
    balance,
  });
  if (error) throw error;
}
