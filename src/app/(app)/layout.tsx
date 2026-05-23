import { Suspense } from "react";
import {
  getRequestAuth,
  getSupabaseServerClient,
} from "@/data/supabase/request-context";
import { ensureAndCheckClientConsentPrompt } from "@/server/inbox/ensure-advisor-consent-notification";
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
  let clientConsentNeeded = false;

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
      // Ensure the re-consent inbox prompt + subtle account-menu cue. Non-client /
      // unlinked short-circuits with zero DB hops.
      const supabase = await getSupabaseServerClient();
      clientConsentNeeded = await ensureAndCheckClientConsentPrompt(
        supabase,
        profile
      );
    }
  }

  return (
    <AppShell
      user={user}
      profile={profile}
      workspace={workspace}
      inboxSlot={inboxSlot}
      clientConsentNeeded={clientConsentNeeded}
    >
      {children}
    </AppShell>
  );
}
