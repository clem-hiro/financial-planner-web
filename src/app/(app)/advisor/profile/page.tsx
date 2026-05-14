import { getProfileById } from "@/data/repositories/profiles";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { AdvisorPhoneVerificationForm } from "@/features/advisor/AdvisorPhoneVerificationForm";
import { isSupabaseConfigured } from "@/lib/env";
import { isAdvisor } from "@/lib/profile-role";
import { redirect } from "next/navigation";

export default async function AdvisorProfilePage() {
  if (!isSupabaseConfigured()) {
    return (
      <p className="text-sm text-zinc-600">Configure Supabase to update advisor profile.</p>
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await getProfileById(supabase, user.id);
  if (!profile || !isAdvisor(profile)) {
    redirect("/dashboard");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Advisor profile</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Manage the contact details clients can use from their workspace.
        </p>
      </div>
      <AdvisorPhoneVerificationForm profile={profile} />
    </div>
  );
}
