import type { SupabaseClient } from "@supabase/supabase-js";
import { upsertByDedupeKey } from "@/data/repositories/inbox-notifications";

/**
 * Helper only reads these three fields; narrowing the parameter makes the
 * dependency explicit and the test fixture trivial.
 */
export type SalaryReviewProfile = {
  id: string;
  salary_increment_month: number | null;
  last_salary_review_at: string | null;
};

/**
 * Layout-time gate: ensures at most one "confirm your salary" inbox row per
 * calendar year, from the user's chosen increment month onward. Returns
 * without touching Supabase whenever the gate short-circuits — the perf
 * invariant is that no-op renders cost zero DB hops.
 */
export async function ensureSalaryReviewNotification(
  supabase: SupabaseClient,
  profile: SalaryReviewProfile,
  now: Date = new Date()
): Promise<void> {
  const incrementMonth = profile.salary_increment_month;
  if (incrementMonth == null) return;

  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  if (currentMonth < incrementMonth) return;

  if (profile.last_salary_review_at != null) {
    const last = new Date(profile.last_salary_review_at);
    if (
      last.getFullYear() === currentYear &&
      last.getMonth() + 1 >= incrementMonth
    ) {
      return;
    }
  }

  const monthLabel = new Date(2000, incrementMonth - 1, 1).toLocaleString(
    "en-US",
    { month: "long" }
  );
  try {
    await upsertByDedupeKey(supabase, profile.id, {
      kind: "salary_review_due",
      dedupe_key: `salary_review_due:${currentYear}`,
      title: "Confirm your new salary",
      body: `${monthLabel} is when raises typically take effect for you. Confirm your salary so projections stay accurate.`,
      cta_label: "Update salary",
      cta_href: "/setup?tab=profile&from=salary-review#salary",
    });
  } catch (error) {
    console.error("[ensureSalaryReviewNotification] upsert failed", error);
  }
}
