import type { SupabaseClient } from "@supabase/supabase-js";
import { markAsReadByDedupeKey } from "@/data/repositories/inbox-notifications";
import { updateProfile } from "@/data/repositories/profiles";
import { investmentReviewDedupeKeyForYear } from "@/domain/finance/investment-review";

/** Records that the user reviewed investment assumptions and clears the inbox row. */
export async function acknowledgeInvestmentReview(
  supabase: SupabaseClient,
  userId: string,
  now: Date = new Date()
): Promise<void> {
  await updateProfile(supabase, userId, {
    last_investment_review_at: now.toISOString(),
  });
  await markAsReadByDedupeKey(
    supabase,
    userId,
    investmentReviewDedupeKeyForYear(now.getFullYear())
  );
}
