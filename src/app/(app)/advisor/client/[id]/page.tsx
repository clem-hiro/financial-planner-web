import Link from "next/link";
import { getClientProfileForAdvisor } from "@/data/repositories/advisor-clients";
import { getProfileById } from "@/data/repositories/profiles";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { appInlineLinkClass } from "@/ui/app-link-styles";
import { isSupabaseConfigured } from "@/lib/env";
import { isAdvisor } from "@/lib/profile-role";
import { redirect, notFound } from "next/navigation";

type PageProps = { params: Promise<{ id: string }> };

export default async function AdvisorClientDetailPage({ params }: PageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <p className="text-sm text-zinc-600">Configure Supabase to open client records.</p>
    );
  }

  const { id: clientId } = await params;

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

  const clientRow = await getClientProfileForAdvisor(supabase, user.id, clientId);
  if (!clientRow) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <p className="text-sm">
        <Link href="/advisor/clients" className={appInlineLinkClass}>
          ← Clients
        </Link>
      </p>
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">
          {clientRow.display_name?.trim() || "Client"}
        </h1>
        <p className="mt-1 text-sm text-zinc-600">
          Placeholder workspace for future portfolio reviews, notes, and meetings. No financial
          detail surface yet.
        </p>
      </div>
      <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/50 px-4 py-8 text-center text-sm text-zinc-600">
        <p className="font-medium text-zinc-800">Client workspace</p>
        <p className="mt-2 max-w-md mx-auto">
          Onboarding:{" "}
          {clientRow.onboarding_completed_at
            ? "complete"
            : clientRow.onboarding_required
              ? "in progress"
              : "—"}
          . Aggregated insights and vault will plug in here.
        </p>
      </div>
    </div>
  );
}
