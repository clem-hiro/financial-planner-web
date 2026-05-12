import type { FinancialProfileType, ProfileRow } from "@/data/supabase/types";

export function normalizeFinancialProfileType(
  value: string | null | undefined
): FinancialProfileType {
  return value === "client" ? "client" : "advisor";
}

/** Resolved role from a loaded profile row, or null if the profile is missing. */
export function getCurrentUserRole(
  profile: ProfileRow | null | undefined
): FinancialProfileType | null {
  if (!profile) return null;
  return normalizeFinancialProfileType(profile.profile_type);
}

export function isAdvisor(profile: ProfileRow | null | undefined): boolean {
  return getCurrentUserRole(profile) === "advisor";
}

export function isClient(profile: ProfileRow | null | undefined): boolean {
  return getCurrentUserRole(profile) === "client";
}

export function isAdvisorProfile(profile: ProfileRow | null): boolean {
  return isAdvisor(profile);
}

export function isClientProfile(profile: ProfileRow | null): boolean {
  return isClient(profile);
}

/** True when a client row is correctly linked to an advisor, or the user is not a client. */
export function clientAdvisorRelationshipOk(profile: ProfileRow | null): boolean {
  if (!isClient(profile)) return true;
  return (
    profile?.advisor_user_id != null &&
    String(profile.advisor_user_id).trim() !== ""
  );
}
