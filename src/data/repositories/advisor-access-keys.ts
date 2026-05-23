import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdvisorAccessKeyRow } from "@/data/supabase/types";

export type AdvisorAccessKeyStatusCounts = {
  total: number;
  available: number;
  claimed: number;
  expired: number;
};

/** Unclaimed keys first so advisors can copy available keys from the top of the list. */
const ACCESS_KEY_STATUS_SORT_ORDER: Record<AdvisorAccessKeyRow["status"], number> = {
  available: 0,
  claimed: 1,
  expired: 2,
};

export function sortAdvisorAccessKeysForDisplay(
  keys: AdvisorAccessKeyRow[]
): AdvisorAccessKeyRow[] {
  return [...keys].sort((a, b) => {
    const byStatus =
      ACCESS_KEY_STATUS_SORT_ORDER[a.status] - ACCESS_KEY_STATUS_SORT_ORDER[b.status];
    if (byStatus !== 0) return byStatus;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

export async function listAdvisorAccessKeysForAdvisor(
  supabase: SupabaseClient,
  advisorUserId: string
): Promise<AdvisorAccessKeyRow[]> {
  const { data, error } = await supabase
    .from("advisor_access_keys")
    .select("*")
    .eq("advisor_user_id", advisorUserId);
  if (error) throw error;
  return sortAdvisorAccessKeysForDisplay((data ?? []) as AdvisorAccessKeyRow[]);
}

export async function countAdvisorAccessKeyStatuses(
  supabase: SupabaseClient,
  advisorUserId: string
): Promise<AdvisorAccessKeyStatusCounts> {
  const { data, error } = await supabase
    .from("advisor_access_keys")
    .select("status")
    .eq("advisor_user_id", advisorUserId);
  if (error) throw error;
  const rows = (data ?? []) as Pick<AdvisorAccessKeyRow, "status">[];
  const counts: AdvisorAccessKeyStatusCounts = {
    total: rows.length,
    available: 0,
    claimed: 0,
    expired: 0,
  };
  for (const r of rows) {
    if (r.status === "available") counts.available += 1;
    else if (r.status === "claimed") counts.claimed += 1;
    else if (r.status === "expired") counts.expired += 1;
  }
  return counts;
}

export async function insertAdvisorAccessKeys(
  supabase: SupabaseClient,
  advisorUserId: string,
  accessKeys: string[]
): Promise<void> {
  if (accessKeys.length === 0) return;
  const rows = accessKeys.map((access_key) => ({
    advisor_user_id: advisorUserId,
    access_key,
    status: "available" as const,
  }));
  const { error } = await supabase.from("advisor_access_keys").insert(rows);
  if (error) throw error;
}
