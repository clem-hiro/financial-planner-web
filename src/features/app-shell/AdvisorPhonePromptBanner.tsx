"use client";

import Link from "next/link";
import type { ProfileRow } from "@/data/supabase/types";

export function AdvisorPhonePromptBanner({
  profile,
}: {
  profile: ProfileRow | null;
}) {
  if (!profile || profile.profile_type !== "advisor") return null;
  if (profile.phone_e164 && profile.phone_verified_at) return null;

  return (
    <div className="border-b border-amber-200/80 bg-amber-50/90">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm text-amber-950 sm:px-8">
        <span>Verify your advisor WhatsApp contact before clients need to reach you.</span>
        <Link
          href="/advisor/profile"
          className="rounded-full bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-950"
        >
          Verify contact
        </Link>
      </div>
    </div>
  );
}
