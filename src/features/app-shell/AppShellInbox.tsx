import { listInvestments } from "@/data/repositories/investments";
import { listUnreadByUser } from "@/data/repositories/inbox-notifications";
import { getSupabaseServerClient } from "@/data/supabase/request-context";
import type { ProfileRow } from "@/data/supabase/types";
import { InboxBell } from "@/features/inbox/InboxBell";
import {
  ensureInvestmentReviewNotification,
} from "@/server/inbox/ensure-investment-review-notification";
import {
  ensureCpfRulesReviewNotification,
} from "@/server/inbox/ensure-cpf-rules-review-notification";
import {
  ensureSalaryReviewNotification,
  type SalaryReviewProfile,
} from "@/server/inbox/ensure-salary-review-notification";

const inboxMenuRowClass =
  "relative flex w-full items-center rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50";

/**
 * Inbox snapshot for the account menu. Loaded in a Suspense boundary so main
 * nav transitions are not blocked on salary-review upsert + unread list.
 */
export async function AppShellInbox({
  userId,
  profile,
}: {
  userId: string;
  profile: ProfileRow;
}) {
  const supabase = await getSupabaseServerClient();
  const salaryProfile: SalaryReviewProfile = {
    id: profile.id,
    salary_increment_month: profile.salary_increment_month,
    last_salary_review_at: profile.last_salary_review_at,
  };
  await ensureSalaryReviewNotification(supabase, salaryProfile);
  await ensureCpfRulesReviewNotification(supabase, profile);
  const investments = await listInvestments(supabase, userId);
  await ensureInvestmentReviewNotification(supabase, profile, investments);
  const initialItems = await listUnreadByUser(supabase, userId, 10);

  return (
    <InboxBell
      unreadCount={initialItems.length}
      initialItems={initialItems}
      menuButtonClassName={inboxMenuRowClass}
    />
  );
}

export function AppShellInboxFallback() {
  return (
    <div
      className={`${inboxMenuRowClass} pointer-events-none opacity-60`}
      aria-hidden
    >
      <span className="inline-flex items-center gap-2">
        <span className="h-4 w-4 animate-pulse rounded-full bg-slate-200" />
        Inbox
      </span>
    </div>
  );
}
