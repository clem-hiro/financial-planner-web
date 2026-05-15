import { AdvisorAccessKeysSection } from "@/features/advisor/AdvisorAccessKeysSection";
import { getProfileById } from "@/data/repositories/profiles";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { isAdvisor } from "@/lib/profile-role";
import { buildShareData } from "@/server/advisor-qr-share";
import type { SerializableQrShareData } from "@/server/advisor-qr-share-actions";
import { redirect } from "next/navigation";

export default async function AdvisorAccessKeysPage() {
  if (!isSupabaseConfigured()) {
    return (
      <p className="text-sm text-zinc-600">Configure Supabase to manage access keys.</p>
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
  if (!isAdvisor(profile)) {
    redirect("/dashboard");
  }

  // Untrusted-host throws fall to null (empty state); the section still renders.
  let initialShareData: SerializableQrShareData | null = null;
  try {
    const data = await buildShareData(supabase, user.id, profile?.display_name ?? null);
    if (data) {
      initialShareData = { ...data, expiresAt: data.expiresAt.toISOString() };
    }
  } catch (e) {
    console.error("buildShareData failed on advisor access-keys page", e);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Access keys</h1>
        <p className="mt-1 text-sm text-slate-600">
          Invite clients with one-time keys created through coupon-backed advisor purchases.
        </p>
      </div>
      <AdvisorAccessKeysSection
        supabase={supabase}
        userId={user.id}
        initialShareData={initialShareData}
      />
    </div>
  );
}
