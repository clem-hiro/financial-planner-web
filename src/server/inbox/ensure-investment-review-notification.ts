import type { SupabaseClient } from "@supabase/supabase-js";
import { upsertByDedupeKey } from "@/data/repositories/inbox-notifications";
import type { InvestmentRow } from "@/data/supabase/types";
import {
  countStaleInvestments,
  investmentReviewDedupeKeyForYear,
  shouldPromptInvestmentReview,
} from "@/domain/finance/investment-review";

export type InvestmentReviewProfile = {
  id: string;
  last_investment_review_at: string | null;
};

/**
 * Layout-time gate: one inbox row per calendar year when any investment account
 * has not been updated in 12+ months and the user has not acknowledged recently.
 */
export async function ensureInvestmentReviewNotification(
  supabase: SupabaseClient,
  profile: InvestmentReviewProfile,
  investments: InvestmentRow[],
  now: Date = new Date()
): Promise<void> {
  if (
    !shouldPromptInvestmentReview({
      investments,
      lastInvestmentReviewAt: profile.last_investment_review_at,
      now,
    })
  ) {
    return;
  }

  const staleCount = countStaleInvestments(investments, now);
  const year = now.getFullYear();
  const accountLabel =
    staleCount === 1 ? "1 account" : `${staleCount} accounts`;

  try {
    await upsertByDedupeKey(supabase, profile.id, {
      kind: "investment_review_due",
      dedupe_key: investmentReviewDedupeKeyForYear(year),
      title: "Review investment assumptions",
      body: `${accountLabel} ha${staleCount === 1 ? "s" : "ve"} not been updated in over a year. Confirm balances and expected returns so net worth and retirement illustrations stay useful.`,
      cta_label: "Review investments",
      cta_href: "/setup?tab=add-account&from=investment-review#add-investment",
    });
  } catch (error) {
    console.error("[ensureInvestmentReviewNotification] upsert failed", error);
  }
}
