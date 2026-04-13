import type { SupabaseClient } from "@supabase/supabase-js";
import type { LiabilityRow } from "@/data/supabase/types";

export async function listLiabilities(
  supabase: SupabaseClient,
  userId: string
): Promise<LiabilityRow[]> {
  const { data, error } = await supabase
    .from("liabilities")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as LiabilityRow[];
}

export async function insertLiability(
  supabase: SupabaseClient,
  userId: string,
  row: { name: string; balance: number }
): Promise<LiabilityRow> {
  const { data, error } = await supabase
    .from("liabilities")
    .insert({
      user_id: userId,
      name: row.name,
      balance: row.balance,
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
  patch: { name: string; balance: number }
): Promise<void> {
  const { error } = await supabase
    .from("liabilities")
    .update(patch)
    .eq("user_id", userId)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteLiability(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<void> {
  const { error } = await supabase
    .from("liabilities")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);
  if (error) throw error;
}
