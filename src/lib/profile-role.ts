import type { FinancialProfileType, ProfileRow } from "@/data/supabase/types";

export function normalizeFinancialProfileType(
  value: string | null | undefined
): FinancialProfileType {
  return value === "client" ? "client" : "advisor";
}

export function isAdvisorProfile(profile: ProfileRow | null): boolean {
  return normalizeFinancialProfileType(profile?.profile_type) === "advisor";
}

export function isClientProfile(profile: ProfileRow | null): boolean {
  return normalizeFinancialProfileType(profile?.profile_type) === "client";
}

/** True when a client row is correctly linked to an advisor, or the user is not a client. */
export function clientAdvisorRelationshipOk(profile: ProfileRow | null): boolean {
  if (!isClientProfile(profile)) return true;
  return (
    profile?.advisor_user_id != null &&
    String(profile.advisor_user_id).trim() !== ""
  );
}
