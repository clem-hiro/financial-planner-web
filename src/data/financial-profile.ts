import type { ProfileRow } from "@/data/supabase/types";
import { isClientProfile } from "@/lib/profile-role";

export function needsOnboarding(profile: ProfileRow | null): boolean {
  if (!profile) return false;
  if (!isClientProfile(profile)) return false;
  return profile.onboarding_required && !profile.onboarding_completed_at;
}

export function isFinancialProfileIncomplete(profile: ProfileRow | null): boolean {
  if (!profile) return true;
  const hasIncome =
    profile.monthly_income != null && String(profile.monthly_income).trim() !== "";
  const hasCurrency =
    profile.base_currency != null && String(profile.base_currency).trim() !== "";
  return !hasIncome || !hasCurrency;
}
