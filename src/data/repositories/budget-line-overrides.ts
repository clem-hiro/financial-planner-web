import type { SupabaseClient } from "@supabase/supabase-js";
import { num } from "@/data/mappers";
import type { BudgetLineMonthOverrideRow } from "@/data/supabase/types";

export async function listBudgetLineOverridesForMonth(
  supabase: SupabaseClient,
  userId: string,
  yearMonth: string
): Promise<BudgetLineMonthOverrideRow[]> {
  const { data, error } = await supabase
    .from("financial_budget_line_month_overrides")
    .select("*")
    .eq("user_id", userId)
    .eq("year_month", yearMonth);
  if (error) throw error;
  return (data ?? []) as BudgetLineMonthOverrideRow[];
}

export function overridesToLineIdMap(
  rows: BudgetLineMonthOverrideRow[]
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    out[r.budget_line_id] = num(r.amount);
  }
  return out;
}

export async function upsertBudgetLineMonthOverride(
  supabase: SupabaseClient,
  userId: string,
  input: {
    budget_line_id: string;
    year_month: string;
    amount: number;
  }
): Promise<void> {
  const { error: delErr } = await supabase
    .from("financial_budget_line_month_overrides")
    .delete()
    .eq("user_id", userId)
    .eq("budget_line_id", input.budget_line_id)
    .eq("year_month", input.year_month);
  if (delErr) throw delErr;

  const { error } = await supabase.from("financial_budget_line_month_overrides").insert({
    user_id: userId,
    budget_line_id: input.budget_line_id,
    year_month: input.year_month,
    amount: input.amount,
  });
  if (error) throw error;
}

export async function deleteBudgetLineMonthOverride(
  supabase: SupabaseClient,
  userId: string,
  budgetLineId: string,
  yearMonth: string
): Promise<void> {
  const { error } = await supabase
    .from("financial_budget_line_month_overrides")
    .delete()
    .eq("user_id", userId)
    .eq("budget_line_id", budgetLineId)
    .eq("year_month", yearMonth);
  if (error) throw error;
}
