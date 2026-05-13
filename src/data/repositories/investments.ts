import type { SupabaseClient } from "@supabase/supabase-js";
import type { InvestmentRow } from "@/data/supabase/types";

/** PostgREST / Supabase when `financial_investments` has no contribution-phase columns yet. */
function isUnknownInvestmentContributionColumnError(error: unknown): boolean {
  const msg =
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
      ? (error as { message: string }).message
      : "";
  return (
    (msg.includes("contribution_duration_years") ||
      msg.includes("contribution_type")) &&
    (msg.includes("schema cache") ||
      msg.includes("Could not find") ||
      msg.includes("column"))
  );
}

const MIGRATION_HINT =
  "Run Supabase migration `20260516000000_investment_contribution_phases.sql` (or `supabase db push`) so contribution phases can be stored.";

export async function listInvestments(
  supabase: SupabaseClient,
  userId: string
): Promise<InvestmentRow[]> {
  const { data, error } = await supabase
    .from("financial_investments")
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
    .from("financial_investments")
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
  contribution_type?: string | null;
  contribution_duration_years?: number | null;
};

export async function insertInvestment(
  supabase: SupabaseClient,
  userId: string,
  row: NewInvestment
): Promise<InvestmentRow> {
  const withPhases = {
    user_id: userId,
    name: row.name,
    current_value: row.current_value,
    monthly_contribution: row.monthly_contribution,
    expected_annual_return: row.expected_annual_return,
    contribution_type: row.contribution_type ?? null,
    contribution_duration_years: row.contribution_duration_years ?? null,
  };

  let { data, error } = await supabase
    .from("financial_investments")
    .insert(withPhases)
    .select()
    .single();

  if (error && isUnknownInvestmentContributionColumnError(error)) {
    if (
      row.contribution_type === "fixed_duration" ||
      (row.contribution_duration_years != null &&
        Number.isFinite(row.contribution_duration_years))
    ) {
      throw new Error(
        `Fixed-duration contributions require newer database columns. ${MIGRATION_HINT}`
      );
    }
    const legacy = {
      user_id: userId,
      name: row.name,
      current_value: row.current_value,
      monthly_contribution: row.monthly_contribution,
      expected_annual_return: row.expected_annual_return,
    };
    ({ data, error } = await supabase
      .from("financial_investments")
      .insert(legacy)
      .select()
      .single());
  }

  if (error) throw error;
  return data as InvestmentRow;
}

export type InvestmentPatch = {
  name?: string;
  current_value?: number;
  monthly_contribution?: number;
  expected_annual_return?: number;
  contribution_type?: string | null;
  contribution_duration_years?: number | null;
};

export async function updateInvestment(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  patch: InvestmentPatch
): Promise<void> {
  const {
    contribution_type: ct,
    contribution_duration_years: cdy,
    ...rest
  } = patch;

  const fullPatch: Record<string, unknown> = { ...rest };
  if ("contribution_type" in patch) fullPatch.contribution_type = ct ?? null;
  if ("contribution_duration_years" in patch) {
    fullPatch.contribution_duration_years = cdy ?? null;
  }

  let { error } = await supabase
    .from("financial_investments")
    .update(fullPatch)
    .eq("user_id", userId)
    .eq("id", id);

  if (error && isUnknownInvestmentContributionColumnError(error)) {
    const wantsPhases =
      ("contribution_type" in patch && patch.contribution_type === "fixed_duration") ||
      ("contribution_duration_years" in patch &&
        patch.contribution_duration_years != null &&
        Number.isFinite(patch.contribution_duration_years));
    if (wantsPhases) {
      throw new Error(
        `Fixed-duration contributions require newer database columns. ${MIGRATION_HINT}`
      );
    }
    const legacyPatch = { ...rest };
    if (Object.keys(legacyPatch).length === 0) {
      return;
    }
    ({ error } = await supabase
      .from("financial_investments")
      .update(legacyPatch)
      .eq("user_id", userId)
      .eq("id", id));
  }

  if (error) throw error;
}
