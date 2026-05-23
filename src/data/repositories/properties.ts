import type { SupabaseClient } from "@supabase/supabase-js";
import type { PropertyRow } from "@/data/supabase/types";

export async function listProperties(
  supabase: SupabaseClient,
  userId: string
): Promise<PropertyRow[]> {
  const { data, error } = await supabase
    .from("financial_properties")
    .select("*")
    .eq("user_id", userId)
    .order("display_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PropertyRow[];
}

export async function advisorReadProperties(
  supabase: SupabaseClient,
  clientId: string
): Promise<PropertyRow[]> {
  const { data, error } = await supabase.rpc("advisor_read_properties", {
    p_client: clientId,
  });
  if (error) throw error;
  return (data ?? []) as PropertyRow[];
}

export type PropertyInsert = {
  name: string;
  property_type: PropertyRow["property_type"];
  purchase_price: number | null;
  purchase_year?: number | null;
  current_valuation: number | null;
  ownership_percent: number;
  status: PropertyRow["status"];
  rental_income_monthly: number;
  planning_scope?: PropertyRow["planning_scope"];
  display_order?: number;
};

export async function insertProperty(
  supabase: SupabaseClient,
  userId: string,
  row: PropertyInsert
): Promise<PropertyRow> {
  const { data, error } = await supabase
    .from("financial_properties")
    .insert({
      user_id: userId,
      name: row.name,
      property_type: row.property_type,
      purchase_price: row.purchase_price,
      purchase_year: row.purchase_year ?? null,
      current_valuation: row.current_valuation,
      ownership_percent: row.ownership_percent,
      status: row.status,
      rental_income_monthly: row.rental_income_monthly,
      planning_scope: row.planning_scope ?? "current",
      display_order: row.display_order ?? 0,
    })
    .select()
    .single();
  if (error) throw error;
  return data as PropertyRow;
}

export async function updateProperty(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  patch: Partial<PropertyInsert>
): Promise<void> {
  const { error } = await supabase
    .from("financial_properties")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("id", id);
  if (error) throw error;
}

export async function deleteProperty(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<void> {
  const { error } = await supabase
    .from("financial_properties")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);
  if (error) throw error;
}
