import Link from "next/link";
import { getAdvisorDashboardData } from "@/data/repositories/advisor-dashboard";
import { getProfileById } from "@/data/repositories/profiles";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { appInlineLinkClass } from "@/ui/app-link-styles";
import { isSupabaseConfigured } from "@/lib/env";
import { isAdvisor } from "@/lib/profile-role";
import { redirect } from "next/navigation";

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-slate-900">
        {value}
      </p>
    </div>
  );
}

export default async function AdvisorDashboardPage() {
  if (!isSupabaseConfigured()) {
    return (
      <p className="text-sm text-zinc-600">Configure Supabase to use the advisor workspace.</p>
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

  const data = await getAdvisorDashboardData(supabase, user.id);

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm sm:px-6">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
          Advisor Workspace
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
          Operations overview
        </h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Operational snapshot of client onboarding and access keys. Personal planning tools remain
          in the client experience.
        </p>
      </div>

      <section aria-labelledby="advisor-metrics">
        <h2 id="advisor-metrics" className="sr-only">
          Key metrics
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Total clients" value={data.totalClients} />
          <StatCard label="Clients onboarded" value={data.clientsOnboarded} />
          <StatCard label="Pending onboarding" value={data.clientsPendingOnboarding} />
          <StatCard label="Keys available" value={data.keyCounts.available} />
          <StatCard label="Keys claimed" value={data.keyCounts.claimed} />
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Recent client activity
            </p>
            <p className="mt-2 text-sm font-medium text-slate-700">Work in Progress</p>
            <p className="mt-1 text-xs text-slate-500">
              Timeline and interaction feeds are being designed for a future release.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">Recently joined clients</h2>
          <Link href="/advisor/clients" className={`text-sm ${appInlineLinkClass}`}>
            View all →
          </Link>
        </div>
        {data.recentlyJoinedClients.length === 0 ? (
          <p className="text-sm text-slate-600">
            No clients yet. Generate keys under{" "}
            <Link href="/advisor/access-keys" className={appInlineLinkClass}>
              Access keys
            </Link>{" "}
            and share one per signup.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {data.recentlyJoinedClients.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3.5">
                <div>
                  <p className="font-medium text-slate-900">
                    {c.display_name?.trim() || "Unnamed client"}
                  </p>
                  <p className="text-xs text-slate-500">
                    Joined {new Date(c.created_at).toLocaleDateString()}
                  </p>
                </div>
                <p className="text-xs font-medium text-slate-600">
                  {c.onboarding_completed_at
                    ? "Onboarded"
                    : c.onboarding_required
                      ? "Onboarding"
                      : "—"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
