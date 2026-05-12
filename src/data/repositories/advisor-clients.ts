import type { SupabaseClient } from "@supabase/supabase-js";

/** Safe, non-financial fields for advisor workspace lists (expand deliberately later). */
export type AdvisorClientListRow = {
  id: string;
  display_name: string | null;
  profile_type: "client";
  onboarding_required: boolean;
  onboarding_completed_at: string | null;
  created_at: string;
};

/** Row from `advisor_client_list_metrics` RPC (requires migration `20260513000000`). */
export type AdvisorClientWorkspaceListRow = {
  id: string;
  display_name: string | null;
  profile_type: string;
  onboarding_required: boolean;
  onboarding_completed_at: string | null;
  created_at: string;
  monthly_income: string | null;
  savings_target_monthly: string | null;
  fixed_expenses_monthly: string | null;
  monthly_gross_salary: string | null;
  last_expense_spent_at: string | null;
  expense_count: string;
  total_count: string;
};

export type AdvisorClientListSort =
  | "created_desc"
  | "name_asc"
  | "last_active_desc";

export async function listClientsForAdvisor(
  supabase: SupabaseClient,
  advisorUserId: string
): Promise<AdvisorClientListRow[]> {
  const { data, error } = await supabase
    .from("financial_profiles")
    .select(
      "id, display_name, profile_type, onboarding_required, onboarding_completed_at, created_at"
    )
    .eq("advisor_user_id", advisorUserId)
    .eq("profile_type", "client")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as AdvisorClientListRow[];
}

/**
 * Paginated roster for advisor workspace (server-side search, sort, counts).
 * Falls back to simple list when RPC is not deployed (older DB).
 */
export async function listAdvisorClientsWorkspace(
  supabase: SupabaseClient,
  advisorUserId: string,
  options: {
    limit?: number;
    offset?: number;
    search?: string | null;
    sort?: AdvisorClientListSort;
  }
): Promise<{ rows: AdvisorClientWorkspaceListRow[]; totalCount: number }> {
  const limit = Math.min(200, Math.max(1, options.limit ?? 48));
  const offset = Math.max(0, options.offset ?? 0);
  const search = options.search?.trim() || null;
  const sort = options.sort ?? "created_desc";

  const { data, error } = await supabase.rpc("advisor_client_list_metrics", {
    p_limit: limit,
    p_offset: offset,
    p_search: search,
    p_sort: sort,
  });

  if (error) {
    const msg = error.message?.toLowerCase() ?? "";
    if (
      msg.includes("advisor_client_list_metrics") ||
      msg.includes("function") ||
      msg.includes("schema cache")
    ) {
      let fallback = await listClientsForAdvisor(supabase, advisorUserId);
      if (search) {
        const q = search.toLowerCase();
        fallback = fallback.filter((r) =>
          (r.display_name ?? "").toLowerCase().includes(q)
        );
      }
      if (sort === "name_asc") {
        fallback = [...fallback].sort((a, b) =>
          (a.display_name ?? "").localeCompare(b.display_name ?? "", undefined, {
            sensitivity: "base",
          })
        );
      }
      const sliced = fallback.slice(offset, offset + limit);
      const rows: AdvisorClientWorkspaceListRow[] = sliced.map((r) => ({
        id: r.id,
        display_name: r.display_name,
        profile_type: "client",
        onboarding_required: r.onboarding_required,
        onboarding_completed_at: r.onboarding_completed_at,
        created_at: r.created_at,
        monthly_income: null,
        savings_target_monthly: null,
        fixed_expenses_monthly: null,
        monthly_gross_salary: null,
        last_expense_spent_at: null,
        expense_count: "0",
        total_count: String(fallback.length),
      }));
      return { rows, totalCount: fallback.length };
    }
    throw error;
  }

  const raw = (data ?? []) as AdvisorClientWorkspaceListRow[];
  let totalCount = 0;
  if (raw.length > 0) {
    totalCount = Number(raw[0].total_count ?? 0);
  } else {
    const { data: countData, error: countErr } = await supabase.rpc(
      "advisor_client_list_count",
      { p_search: search }
    );
    if (countErr) {
      totalCount = 0;
    } else {
      totalCount = Number(countData ?? 0);
    }
  }

  return { rows: raw, totalCount };
}

export async function getClientProfileForAdvisor(
  supabase: SupabaseClient,
  advisorUserId: string,
  clientUserId: string
): Promise<AdvisorClientListRow | null> {
  const { data, error } = await supabase
    .from("financial_profiles")
    .select(
      "id, display_name, profile_type, onboarding_required, onboarding_completed_at, created_at"
    )
    .eq("id", clientUserId)
    .eq("advisor_user_id", advisorUserId)
    .eq("profile_type", "client")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return data as AdvisorClientListRow;
}
