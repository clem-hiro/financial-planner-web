import type { InboxNotificationRow } from "@/data/supabase/types";
import { listUnreadByUser } from "@/data/repositories/inbox-notifications";
import { getProfileById } from "@/data/repositories/profiles";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { AppShell } from "@/features/app-shell/AppShell";
import { isSupabaseConfigured } from "@/lib/env";
import { isAdvisor } from "@/lib/profile-role";
import { ensureSalaryReviewNotification } from "@/server/inbox/ensure-salary-review-notification";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let user = null;
  let profile = null;
  let workspace: "client" | "advisor" = "client";
  let inbox: { unreadCount: number; initialItems: InboxNotificationRow[] } | null =
    null;
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
    if (user) {
      profile = await getProfileById(supabase, user.id);
      workspace = isAdvisor(profile) ? "advisor" : "client";
      // Must run before listUnreadByUser so a freshly-written reminder is visible
      // in the same request's inbox snapshot. Helper short-circuits without DB I/O
      // when no reminder is due, so the cost is one field read in the steady state.
      if (profile) {
        await ensureSalaryReviewNotification(supabase, profile);
      }
      const initialItems = await listUnreadByUser(supabase, user.id, 10);
      inbox = { unreadCount: initialItems.length, initialItems };
    }
  }

  return (
    <AppShell
      user={user}
      profile={profile}
      workspace={workspace}
      inbox={inbox}
    >
      {children}
    </AppShell>
  );
}
