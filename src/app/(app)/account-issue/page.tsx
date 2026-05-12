import Link from "next/link";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { getProfileById } from "@/data/repositories/profiles";
import { isClientProfile } from "@/lib/profile-role";
import { isSupabaseConfigured } from "@/lib/env";
import { signOutAction } from "@/server/actions";
import { appInlineLinkClass } from "@/ui/app-link-styles";

export const dynamic = "force-dynamic";

export default async function AccountIssuePage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-semibold text-zinc-900">Account issue</h1>
        <p className="text-sm text-zinc-600">Supabase is not configured.</p>
      </div>
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-semibold text-zinc-900">Account issue</h1>
        <p className="text-sm text-zinc-600">
          <Link href="/login" className={appInlineLinkClass}>
            Sign in
          </Link>{" "}
          to continue.
        </p>
      </div>
    );
  }

  const profile = await getProfileById(supabase, user.id);
  const isClient = isClientProfile(profile);
  const missingAdvisor =
    isClient &&
    (profile?.advisor_user_id == null ||
      String(profile.advisor_user_id).trim() === "");

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <h1 className="text-2xl font-semibold text-zinc-900">Account needs attention</h1>
      {missingAdvisor ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">Your client profile is not linked to an advisor.</p>
          <p className="mt-2 text-xs text-amber-900/95">
            This usually means data was changed outside the normal signup flow. Please contact support
            or your financial advisor so your account can be repaired.
          </p>
        </div>
      ) : (
        <p className="text-sm text-zinc-600">
          No issue detected for your account. You can return to the{" "}
          <Link href="/dashboard" className={appInlineLinkClass}>
            dashboard
          </Link>
          .
        </p>
      )}
      <form action={signOutAction}>
        <button
          type="submit"
          className="text-sm font-medium text-zinc-600 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-900"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
