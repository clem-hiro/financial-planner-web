import type { InboxNotificationRow } from "@/data/supabase/types";
import { listUnreadByUser } from "@/data/repositories/inbox-notifications";
import { getProfileById } from "@/data/repositories/profiles";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { AppShell } from "@/features/app-shell/AppShell";
import { isSupabaseConfigured } from "@/lib/env";
import { isAdvisor } from "@/lib/profile-role";

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
      const [profileRow, initialItems] = await Promise.all([
        getProfileById(supabase, user.id),
        listUnreadByUser(supabase, user.id, 10),
      ]);
      profile = profileRow;
      workspace = isAdvisor(profile) ? "advisor" : "client";
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
