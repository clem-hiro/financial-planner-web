import type { SupabaseClient } from "@supabase/supabase-js";
import { getMyConsentStatusForAdvisor } from "@/data/repositories/advisor-clients";
import { upsertByDedupeKey } from "@/data/repositories/inbox-notifications";

/**
 * Helper only reads these three fields; narrowing the parameter makes the
 * dependency explicit and the test fixture trivial.
 */
export type ConsentPromptProfile = {
  id: string;
  profile_type: string;
  advisor_user_id: string | null;
};

/**
 * Layout-time gate for the consent-first re-consent prompt. For a linked
 * client whose latest consent event is NOT active (never granted, or
 * withdrawn), ensures one inbox row exists (deduped per advisor) and returns
 * `true` so the shell renders the consent banner. The
 * `recordAdvisorConsentAction` grant path clears the same dedupe key.
 *
 * Perf invariant (mirrors ensureSalaryReviewNotification): non-client /
 * unlinked renders short-circuit with ZERO DB hops. Best-effort: an upsert
 * failure never throws into the layout render.
 */
export async function ensureAndCheckClientConsentPrompt(
  supabase: SupabaseClient,
  profile: ConsentPromptProfile | null
): Promise<boolean> {
  if (!profile || profile.profile_type !== "client") return false;
  const advisorUserId = profile.advisor_user_id;
  if (!advisorUserId || advisorUserId.trim() === "") return false;

  const status = await getMyConsentStatusForAdvisor(
    supabase,
    profile.id,
    advisorUserId
  );
  if (status === "active") return false;

  try {
    await upsertByDedupeKey(supabase, profile.id, {
      kind: "advisor_consent_request",
      dedupe_key: `advisor_consent_request:${advisorUserId}`,
      title: "Your advisor needs your consent",
      body: "Your linked advisor can't see your financial data or prepare suggestions until you grant consent. You can withdraw it anytime.",
      cta_label: "Review consent",
      cta_href: "/more#privacy-advisor-access",
    });
  } catch (error) {
    console.error("[ensureAndCheckClientConsentPrompt] upsert failed", error);
  }
  return true;
}
