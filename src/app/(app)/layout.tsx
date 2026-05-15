import { Suspense } from "react";
import { getRequestAuth } from "@/data/supabase/request-context";
import { AppShell } from "@/features/app-shell/AppShell";
import {
  AppShellInbox,
  AppShellInboxFallback,
} from "@/features/app-shell/AppShellInbox";
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
  let inboxSlot: React.ReactNode = null;

  if (isSupabaseConfigured()) {
    const auth = await getRequestAuth();
    user = auth.user;
    profile = auth.profile;
    if (user && profile) {
      workspace = isAdvisor(profile) ? "advisor" : "client";
      inboxSlot = (
        <Suspense fallback={<AppShellInboxFallback />}>
          <AppShellInbox userId={user.id} profile={profile} />
        </Suspense>
      );
    }
  }

  return (
    <AppShell
      user={user}
      profile={profile}
      workspace={workspace}
      inboxSlot={inboxSlot}
    >
      {children}
    </AppShell>
  );
}
