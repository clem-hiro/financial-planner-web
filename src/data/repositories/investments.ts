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
      msg.includes("contribution_type") ||
      msg.includes("contribution_start_date") ||
      msg.includes("contribution_end_date") ||
      msg.includes("plan_nature") ||
      msg.includes("contribution_growth_annual") ||
      msg.includes("investment_income_rate_annual") ||
      msg.includes("withdrawal_monthly") ||
      msg.includes("withdrawal_annual") ||
      msg.includes("withdrawal_start_years")) &&
    (msg.includes("schema cache") ||
      msg.includes("Could not find") ||
      msg.includes("column"))
  );
}

const MIGRATION_HINT =
  "Run Supabase investment planning migrations (or `supabase db push`) so contribution phases, step-ups, investment income, and withdrawals can be stored.";

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

/**
 * Consent-gated advisor read. Drop-in for `listInvestments` on the advisor
 * path: the RPC `returns setof financial_investments` => identical
 * `InvestmentRow` shape, so the shared overlay mapper composes unchanged (C6).
 * Not consented => the SECURITY DEFINER fn returns zero rows (fail-closed).
 */
export async function advisorReadInvestments(
  supabase: SupabaseClient,
  clientId: string
): Promise<InvestmentRow[]> {
  const { data, error } = await supabase.rpc("advisor_read_investments", {
    p_client: clientId,
  });
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
  investment_income_rate_annual?: number | null;
  contribution_growth_annual?: number | null;
  contribution_type?: string | null;
  contribution_duration_years?: number | null;
  contribution_start_date?: string | null;
  contribution_end_date?: string | null;
  plan_nature?: string | null;
  withdrawal_monthly?: number | null;
  withdrawal_annual?: number | null;
  withdrawal_start_years?: number | null;
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
    investment_income_rate_annual: row.investment_income_rate_annual ?? 0,
    contribution_growth_annual: row.contribution_growth_annual ?? 0,
    contribution_type: row.contribution_type ?? null,
    contribution_duration_years: row.contribution_duration_years ?? null,
    contribution_start_date: row.contribution_start_date ?? null,
    contribution_end_date: row.contribution_end_date ?? null,
    plan_nature: row.plan_nature ?? null,
    withdrawal_annual: row.withdrawal_annual ?? 0,
    withdrawal_monthly:
      row.withdrawal_monthly ?? (row.withdrawal_annual ?? 0) / 12,
    withdrawal_start_years: row.withdrawal_start_years ?? null,
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
        Number.isFinite(row.contribution_duration_years)) ||
      (row.contribution_start_date != null && row.contribution_start_date !== "") ||
      (row.contribution_end_date != null && row.contribution_end_date !== "") ||
      (row.plan_nature != null && row.plan_nature !== "") ||
      (row.contribution_growth_annual != null &&
        Number.isFinite(row.contribution_growth_annual) &&
        row.contribution_growth_annual !== 0) ||
      (row.investment_income_rate_annual != null &&
        Number.isFinite(row.investment_income_rate_annual) &&
        row.investment_income_rate_annual !== 0) ||
      (row.withdrawal_annual != null &&
        Number.isFinite(row.withdrawal_annual) &&
        row.withdrawal_annual !== 0) ||
      (row.withdrawal_monthly != null &&
        Number.isFinite(row.withdrawal_monthly) &&
        row.withdrawal_monthly !== 0) ||
      (row.withdrawal_start_years != null &&
        Number.isFinite(row.withdrawal_start_years))
    ) {
      throw new Error(
        `Advanced investment planning requires newer database columns. ${MIGRATION_HINT}`
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
  investment_income_rate_annual?: number | null;
  contribution_growth_annual?: number | null;
  contribution_type?: string | null;
  contribution_duration_years?: number | null;
  contribution_start_date?: string | null;
  contribution_end_date?: string | null;
  plan_nature?: string | null;
  withdrawal_monthly?: number | null;
  withdrawal_annual?: number | null;
  withdrawal_start_years?: number | null;
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
    contribution_start_date: csd,
    contribution_end_date: ced,
    plan_nature: pn,
    contribution_growth_annual: cga,
    investment_income_rate_annual: iira,
    withdrawal_monthly: wm,
    withdrawal_annual: wa,
    withdrawal_start_years: wsy,
    ...rest
  } = patch;

  const fullPatch: Record<string, unknown> = { ...rest };
  if ("contribution_type" in patch) fullPatch.contribution_type = ct ?? null;
  if ("contribution_duration_years" in patch) {
    fullPatch.contribution_duration_years = cdy ?? null;
  }
  if ("contribution_start_date" in patch) {
    fullPatch.contribution_start_date = csd ?? null;
  }
  if ("contribution_end_date" in patch) {
    fullPatch.contribution_end_date = ced ?? null;
  }
  if ("plan_nature" in patch) fullPatch.plan_nature = pn ?? null;
  if ("contribution_growth_annual" in patch) {
    fullPatch.contribution_growth_annual = cga ?? 0;
  }
  if ("investment_income_rate_annual" in patch) {
    fullPatch.investment_income_rate_annual = iira ?? 0;
  }
  if ("withdrawal_annual" in patch) {
    fullPatch.withdrawal_annual = wa ?? 0;
    fullPatch.withdrawal_monthly = wm ?? (wa ?? 0) / 12;
  }
  if ("withdrawal_monthly" in patch) {
    fullPatch.withdrawal_monthly = wm ?? 0;
  }
  if ("withdrawal_start_years" in patch) {
    fullPatch.withdrawal_start_years = wsy ?? null;
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
        Number.isFinite(patch.contribution_duration_years)) ||
      ("contribution_start_date" in patch &&
        patch.contribution_start_date != null &&
        patch.contribution_start_date !== "") ||
      ("contribution_end_date" in patch &&
        patch.contribution_end_date != null &&
        patch.contribution_end_date !== "") ||
      ("plan_nature" in patch &&
        patch.plan_nature != null &&
        patch.plan_nature !== "") ||
      ("contribution_growth_annual" in patch &&
        patch.contribution_growth_annual != null &&
        Number.isFinite(patch.contribution_growth_annual) &&
        patch.contribution_growth_annual !== 0) ||
      ("investment_income_rate_annual" in patch &&
        patch.investment_income_rate_annual != null &&
        Number.isFinite(patch.investment_income_rate_annual) &&
        patch.investment_income_rate_annual !== 0) ||
      ("withdrawal_annual" in patch &&
        patch.withdrawal_annual != null &&
        Number.isFinite(patch.withdrawal_annual) &&
        patch.withdrawal_annual !== 0) ||
      ("withdrawal_monthly" in patch &&
        patch.withdrawal_monthly != null &&
        Number.isFinite(patch.withdrawal_monthly) &&
        patch.withdrawal_monthly !== 0) ||
      ("withdrawal_start_years" in patch &&
        patch.withdrawal_start_years != null &&
        Number.isFinite(patch.withdrawal_start_years));
    if (wantsPhases) {
      throw new Error(
        `Advanced investment planning requires newer database columns. ${MIGRATION_HINT}`
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

export async function deleteInvestment(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<void> {
  const { error } = await supabase
    .from("financial_investments")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);
  if (error) throw error;
}
