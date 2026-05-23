import type { SupabaseClient } from "@supabase/supabase-js";
import { markAsReadByDedupeKey } from "@/data/repositories/inbox-notifications";
import { updateProfile } from "@/data/repositories/profiles";
import {
  CPF_RULES_VERSION,
  cpfRulesReviewDedupeKey,
} from "@/domain/finance/cpf-rules-review";

/** Records that the user reviewed CPF assumptions against the current rules baseline. */
export async function acknowledgeCpfRulesReview(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date()
): Promise<void> {
  await updateProfile(supabase, userId, {
    last_cpf_rules_review_at: now.toISOString(),
    last_cpf_rules_review_version: CPF_RULES_VERSION,
  });
  await markAsReadByDedupeKey(
    supabase,
    userId,
    cpfRulesReviewDedupeKey(now.getFullYear())
  );
}
