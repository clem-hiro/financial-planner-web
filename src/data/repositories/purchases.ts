import type { SupabaseClient } from "@supabase/supabase-js";
import type { PurchaseRow } from "@/data/supabase/types";

export async function listPurchasesForAdvisor(
  supabase: SupabaseClient,
  advisorUserId: string,
  limit = 10
): Promise<PurchaseRow[]> {
  const { data, error } = await supabase
    .from("purchases")
    .select("*")
    .eq("advisor_user_id", advisorUserId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as PurchaseRow[];
}
