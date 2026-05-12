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
