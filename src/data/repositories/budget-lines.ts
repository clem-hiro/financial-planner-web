import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeCategory } from "@/domain/finance/budget";
import type { BudgetLineRow } from "@/data/supabase/types";

export async function listBudgetLines(
  supabase: SupabaseClient,
  userId: string
): Promise<BudgetLineRow[]> {
  const { data, error } = await supabase
    .from("financial_budget_lines")
    .select("*")
    .eq("user_id", userId)
    .order("cadence", { ascending: true })
    .order("category", { ascending: true });
  if (error) throw error;
  return (data ?? []) as BudgetLineRow[];
}

/**
 * Consent-gated advisor read. Drop-in for `listBudgetLines` on the advisor
 * path: RPC `returns setof financial_budget_lines` ⇒ identical `BudgetLineRow`
 * shape. Not consented ⇒ zero rows (fail-closed).
 */
export async function advisorReadBudgetLines(
  supabase: SupabaseClient,
  clientId: string
): Promise<BudgetLineRow[]> {
  const { data, error } = await supabase.rpc("advisor_read_budget_lines", {
    p_client: clientId,
  });
  if (error) throw error;
  return (data ?? []) as BudgetLineRow[];
}

export async function getBudgetLineBySourceLiabilityId(
  supabase: SupabaseClient,
  userId: string,
  liabilityId: string
): Promise<BudgetLineRow | null> {
  const { data, error } = await supabase
    .from("financial_budget_lines")
    .select("*")
    .eq("user_id", userId)
    .eq("source_liability_id", liabilityId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as BudgetLineRow | null;
}

export async function getBudgetLineById(
  supabase: SupabaseClient,
  userId: string,
  lineId: string
): Promise<BudgetLineRow | null> {
  const { data, error } = await supabase
    .from("financial_budget_lines")
    .select("*")
    .eq("user_id", userId)
    .eq("id", lineId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as BudgetLineRow | null;
}

export type NewBudgetLine = {
  category: string;
  cadence: "monthly" | "annual";
  amount: number;
  calendar_year: number | null;
  start_year_month?: string | null;
  end_year_month?: string | null;
  source_liability_id?: string | null;
};

export async function insertBudgetLine(
  supabase: SupabaseClient,
  userId: string,
  row: NewBudgetLine
): Promise<BudgetLineRow> {
  const category = normalizeCategory(row.category);
  if (!category) throw new Error("Category is required");

  const payload: Record<string, unknown> = {
    user_id: userId,
    category,
    cadence: row.cadence,
    amount: row.amount,
    calendar_year:
      row.cadence === "annual" ? row.calendar_year : null,
    start_year_month:
      row.cadence === "monthly" ? row.start_year_month ?? null : null,
    end_year_month:
      row.cadence === "monthly" ? row.end_year_month ?? null : null,
    source_liability_id: row.source_liability_id ?? null,
  };
  if (row.cadence === "annual" && row.calendar_year == null) {
    throw new Error("calendar_year is required for annual budget lines");
  }

  const { data, error } = await supabase
    .from("financial_budget_lines")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data as BudgetLineRow;
}

export async function updateBudgetLine(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  patch: Partial<
    Pick<
      NewBudgetLine,
      | "category"
      | "amount"
      | "calendar_year"
      | "start_year_month"
      | "end_year_month"
    >
  >
): Promise<void> {
  const updatePayload: Record<string, unknown> = {};
  if (patch.category !== undefined) {
    const c = normalizeCategory(patch.category);
    if (!c) throw new Error("Category is required");
    updatePayload.category = c;
  }
  if (patch.amount !== undefined) updatePayload.amount = patch.amount;
  if (patch.calendar_year !== undefined) {
    updatePayload.calendar_year = patch.calendar_year;
  }
  if (patch.start_year_month !== undefined) {
    updatePayload.start_year_month = patch.start_year_month;
  }
  if (patch.end_year_month !== undefined) {
    updatePayload.end_year_month = patch.end_year_month;
  }

  if (Object.keys(updatePayload).length === 0) return;

  const { error } = await supabase
    .from("financial_budget_lines")
    .update(updatePayload)
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function deleteBudgetLine(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<void> {
  const { error } = await supabase
    .from("financial_budget_lines")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;
}
