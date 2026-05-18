import type { SupabaseClient } from "@supabase/supabase-js";
import type { FinancialGoalRow } from "@/data/supabase/types";

export async function listFinancialGoals(
  supabase: SupabaseClient,
  userId: string
): Promise<FinancialGoalRow[]> {
  const { data, error } = await supabase
    .from("financial_goals")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as FinancialGoalRow[];
}

/**
 * Consent-gated advisor read. Drop-in for `listFinancialGoals` on the advisor
 * path: RPC `returns setof financial_goals` ⇒ identical `FinancialGoalRow`
 * shape. Not consented ⇒ zero rows (fail-closed).
 */
export async function advisorReadGoals(
  supabase: SupabaseClient,
  clientId: string
): Promise<FinancialGoalRow[]> {
  const { data, error } = await supabase.rpc("advisor_read_goals", {
    p_client: clientId,
  });
  if (error) throw error;
  return (data ?? []) as FinancialGoalRow[];
}

export async function getFinancialGoalById(
  supabase: SupabaseClient,
  userId: string,
  goalId: string
): Promise<FinancialGoalRow | null> {
  const { data, error } = await supabase
    .from("financial_goals")
    .select("*")
    .eq("user_id", userId)
    .eq("id", goalId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as FinancialGoalRow | null;
}

export type NewFinancialGoal = {
  title: string;
  target_amount: number;
  target_date?: string | null;
  linked_investment_id?: string | null;
  current_amount?: number;
  monthly_contribution?: number;
  expected_annual_return?: number;
};

export type UpdateFinancialGoalInput = {
  title?: string;
  target_amount?: number;
  target_date?: string | null;
  linked_investment_id?: string | null;
  current_amount?: number;
  monthly_contribution?: number;
  expected_annual_return?: number;
};

export async function insertFinancialGoal(
  supabase: SupabaseClient,
  userId: string,
  row: NewFinancialGoal
): Promise<FinancialGoalRow> {
  const { data, error } = await supabase
    .from("financial_goals")
    .insert({
      user_id: userId,
      title: row.title,
      target_amount: row.target_amount,
      target_date: row.target_date ?? null,
      linked_investment_id: row.linked_investment_id ?? null,
      current_amount: row.current_amount ?? 0,
      monthly_contribution: row.monthly_contribution ?? 0,
      expected_annual_return: row.expected_annual_return ?? 0,
    })
    .select()
    .single();
  if (error) throw error;
  return data as FinancialGoalRow;
}

export async function insertFinancialGoalsBulk(
  supabase: SupabaseClient,
  userId: string,
  rows: NewFinancialGoal[]
): Promise<FinancialGoalRow[]> {
  if (rows.length === 0) return [];
  const payload = rows.map((row) => ({
    user_id: userId,
    title: row.title,
    target_amount: row.target_amount,
    target_date: row.target_date ?? null,
    linked_investment_id: row.linked_investment_id ?? null,
    current_amount: row.current_amount ?? 0,
    monthly_contribution: row.monthly_contribution ?? 0,
    expected_annual_return: row.expected_annual_return ?? 0,
  }));
  const { data, error } = await supabase
    .from("financial_goals")
    .insert(payload)
    .select();
  if (error) throw error;
  return (data ?? []) as FinancialGoalRow[];
}

export async function updateFinancialGoal(
  supabase: SupabaseClient,
  userId: string,
  goalId: string,
  patch: UpdateFinancialGoalInput
): Promise<FinancialGoalRow> {
  const payload: Record<string, unknown> = {};
  if (patch.title !== undefined) payload.title = patch.title;
  if (patch.target_amount !== undefined)
    payload.target_amount = patch.target_amount;
  if (patch.target_date !== undefined) payload.target_date = patch.target_date;
  if (patch.linked_investment_id !== undefined) {
    payload.linked_investment_id = patch.linked_investment_id;
  }
  if (patch.current_amount !== undefined) {
    payload.current_amount = patch.current_amount;
  }
  if (patch.monthly_contribution !== undefined) {
    payload.monthly_contribution = patch.monthly_contribution;
  }
  if (patch.expected_annual_return !== undefined) {
    payload.expected_annual_return = patch.expected_annual_return;
  }

  const { data, error } = await supabase
    .from("financial_goals")
    .update(payload)
    .eq("user_id", userId)
    .eq("id", goalId)
    .select()
    .single();
  if (error) throw error;
  return data as FinancialGoalRow;
}
