import type { SupabaseClient } from "@supabase/supabase-js";
import { upsertByDedupeKey } from "@/data/repositories/inbox-notifications";
import {
  CPF_RULES_VERSION,
  cpfRulesReviewDedupeKey,
  shouldPromptCpfRulesReview,
  type CpfRulesReviewProfile,
} from "@/domain/finance/cpf-rules-review";

/**
 * Layout-time gate: one inbox row per CPF rules version/year when app CPF
 * assumptions have not been confirmed against the current calculation baseline.
 */
export async function ensureCpfRulesReviewNotification(
  supabase: SupabaseClient,
  profile: CpfRulesReviewProfile,
  now: Date = new Date()
): Promise<void> {
  if (
    !shouldPromptCpfRulesReview({
      lastCpfRulesReviewAt: profile.last_cpf_rules_review_at,
      lastCpfRulesReviewVersion: profile.last_cpf_rules_review_version,
      now,
    })
  ) {
    return;
  }

  const year = now.getFullYear();

  try {
    await upsertByDedupeKey(supabase, profile.id, {
      kind: "cpf_rules_review_due",
      dedupe_key: cpfRulesReviewDedupeKey(year),
      title: "Review CPF rules assumptions",
      body: `CPF calculations are using the ${CPF_RULES_VERSION} rules baseline. Confirm CPF balances, age band, contribution, interest, and retirement-sum assumptions against current CPF guidance.`,
      cta_label: "Review CPF assumptions",
      cta_href: "/setup?tab=cpf&from=cpf-rules-review#cpf-rules-review",
    });
  } catch (error) {
    console.error("[ensureCpfRulesReviewNotification] upsert failed", error);
  }
}
