import { AppShell } from "@/features/app-shell/AppShell";
import { getProfileById } from "@/data/repositories/profiles";
import { createSupabaseServerClient } from "@/data/supabase/server";
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
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
    if (user) {
      profile = await getProfileById(supabase, user.id);
      workspace = isAdvisor(profile) ? "advisor" : "client";
    }
  }

  return (
    <AppShell user={user} profile={profile} workspace={workspace}>
      {children}
    </AppShell>
  );
}
