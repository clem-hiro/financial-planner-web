import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExpenseRow } from "@/data/supabase/types";

function monthRange(ym: string): { start: string; end: string } {
  const [y, m] = ym.split("-").map(Number);
  const start = `${ym}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${ym}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

export async function listExpensesForMonth(
  supabase: SupabaseClient,
  userId: string,
  yearMonth: string
): Promise<ExpenseRow[]> {
  const { start, end } = monthRange(yearMonth);
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("user_id", userId)
    .gte("spent_at", start)
    .lte("spent_at", end)
    .order("spent_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ExpenseRow[];
}

export async function listExpensesForYear(
  supabase: SupabaseClient,
  userId: string,
  year: number
): Promise<ExpenseRow[]> {
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("user_id", userId)
    .gte("spent_at", start)
    .lte("spent_at", end)
    .order("spent_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ExpenseRow[];
}

export type NewExpense = {
  amount: number;
  category: string;
  spent_at: string;
  note?: string | null;
  spend_period?: "monthly" | "annual";
};

export async function insertExpense(
  supabase: SupabaseClient,
  userId: string,
  row: NewExpense
): Promise<ExpenseRow> {
  const { data, error } = await supabase
    .from("expenses")
    .insert({
      user_id: userId,
      amount: row.amount,
      category: row.category,
      spent_at: row.spent_at,
      note: row.note ?? null,
      spend_period: row.spend_period ?? "monthly",
    })
    .select()
    .single();
  if (error) throw error;
  return data as ExpenseRow;
}

export async function getExpenseById(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<ExpenseRow | null> {
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as ExpenseRow | null;
}

export type ExpensePatch = {
  amount?: number;
  category?: string;
  spent_at?: string;
  note?: string | null;
  spend_period?: "monthly" | "annual";
};

export async function updateExpense(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  patch: ExpensePatch
): Promise<ExpenseRow> {
  const payload: Record<string, unknown> = {};
  if (patch.amount !== undefined) payload.amount = patch.amount;
  if (patch.category !== undefined) payload.category = patch.category;
  if (patch.spent_at !== undefined) payload.spent_at = patch.spent_at;
  if (patch.note !== undefined) payload.note = patch.note;
  if (patch.spend_period !== undefined) {
    payload.spend_period = patch.spend_period;
  }

  const { data, error } = await supabase
    .from("expenses")
    .update(payload)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();
  if (error) throw error;
  return data as ExpenseRow;
}

export async function deleteExpense(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<void> {
  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}
