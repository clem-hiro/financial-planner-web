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
    .order("display_order", { ascending: true })
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

async function nextGoalDisplayOrder(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { data, error } = await supabase
    .from("financial_goals")
    .select("display_order")
    .eq("user_id", userId)
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.display_order ?? -1) + 1;
}

export async function reorderFinancialGoal(
  supabase: SupabaseClient,
  userId: string,
  goalId: string,
  direction: "up" | "down"
): Promise<void> {
  const goals = await listFinancialGoals(supabase, userId);
  const index = goals.findIndex((g) => g.id === goalId);
  if (index < 0) return;
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= goals.length) return;

  const current = goals[index];
  const neighbor = goals[swapIndex];
  const { error: e1 } = await supabase
    .from("financial_goals")
    .update({ display_order: neighbor.display_order })
    .eq("user_id", userId)
    .eq("id", current.id);
  if (e1) throw e1;
  const { error: e2 } = await supabase
    .from("financial_goals")
    .update({ display_order: current.display_order })
    .eq("user_id", userId)
    .eq("id", neighbor.id);
  if (e2) throw e2;
}

export async function insertFinancialGoal(
  supabase: SupabaseClient,
  userId: string,
  row: NewFinancialGoal
): Promise<FinancialGoalRow> {
  const displayOrder = await nextGoalDisplayOrder(supabase, userId);
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
      display_order: displayOrder,
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
  let nextOrder = await nextGoalDisplayOrder(supabase, userId);
  const payload = rows.map((row) => {
    const item = {
      user_id: userId,
      title: row.title,
      target_amount: row.target_amount,
      target_date: row.target_date ?? null,
      linked_investment_id: row.linked_investment_id ?? null,
      current_amount: row.current_amount ?? 0,
      monthly_contribution: row.monthly_contribution ?? 0,
      expected_annual_return: row.expected_annual_return ?? 0,
      display_order: nextOrder,
    };
    nextOrder += 1;
    return item;
  });
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
