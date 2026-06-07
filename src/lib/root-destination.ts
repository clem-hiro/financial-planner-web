import type { User } from "@supabase/supabase-js";
import type { ProfileRow } from "@/data/supabase/types";

export type RootDestination =
  | { kind: "splash" }
  | { kind: "redirect"; pathname: string };

/**
 * Mirrors `middleware.ts` role / onboarding routing for authenticated visitors.
 * Unsigned visitors see the root splash instead of redirecting.
 */
export function resolveRootDestination(
  user: User | null,
  profile: ProfileRow | null
): RootDestination {
  if (!user) {
    return { kind: "splash" };
  }

  const profileType =
    profile?.profile_type === "client" ? "client" : "advisor";

  if (profileType === "advisor") {
    return { kind: "redirect", pathname: "/advisor" };
  }

  const clientMissingAdvisor =
    profile?.advisor_user_id == null ||
    String(profile.advisor_user_id).trim() === "";

  if (clientMissingAdvisor) {
    return { kind: "redirect", pathname: "/account-issue" };
  }

  const needsOnboarding =
    !!profile?.onboarding_required && !profile?.onboarding_completed_at;

  if (needsOnboarding) {
    return { kind: "redirect", pathname: "/onboarding" };
  }

  return { kind: "redirect", pathname: "/dashboard" };
}
