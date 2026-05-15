import { listUnreadByUser } from "@/data/repositories/inbox-notifications";
import { getSupabaseServerClient } from "@/data/supabase/request-context";
import { InboxBell } from "@/features/inbox/InboxBell";
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
  profile: SalaryReviewProfile;
}) {
  const supabase = await getSupabaseServerClient();
  await ensureSalaryReviewNotification(supabase, profile);
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

