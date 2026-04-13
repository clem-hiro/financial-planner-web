import type { SupabaseClient } from "@supabase/supabase-js";
import type { InvestmentRow } from "@/data/supabase/types";

export async function listInvestments(
  supabase: SupabaseClient,
  userId: string
): Promise<InvestmentRow[]> {
  const { data, error } = await supabase
    .from("investments")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as InvestmentRow[];
}

export async function getInvestmentById(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<InvestmentRow | null> {
  const { data, error } = await supabase
    .from("investments")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as InvestmentRow | null;
}

export type NewInvestment = {
  name: string;
  current_value: number;
  monthly_contribution: number;
  expected_annual_return: number;
};

export async function insertInvestment(
  supabase: SupabaseClient,
  userId: string,
  row: NewInvestment
): Promise<InvestmentRow> {
  const { data, error } = await supabase
    .from("investments")
    .insert({
      user_id: userId,
      name: row.name,
      current_value: row.current_value,
      monthly_contribution: row.monthly_contribution,
      expected_annual_return: row.expected_annual_return,
    })
    .select()
    .single();
  if (error) throw error;
  return data as InvestmentRow;
}

export type InvestmentPatch = {
  name?: string;
  current_value?: number;
  monthly_contribution?: number;
  expected_annual_return?: number;
};

export async function updateInvestment(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  patch: InvestmentPatch
): Promise<void> {
  const { error } = await supabase
    .from("investments")
    .update(patch)
    .eq("user_id", userId)
    .eq("id", id);
  if (error) throw error;
}
