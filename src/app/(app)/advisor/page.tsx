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
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-4 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">
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
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Advisor overview</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Operational snapshot of clients and invite keys. Personal finance tools stay on the client
          app.
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
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-lg font-semibold text-zinc-900">Recently joined clients</h2>
          <Link href="/advisor/clients" className={`text-sm ${appInlineLinkClass}`}>
            View all →
          </Link>
        </div>
        {data.recentlyJoinedClients.length === 0 ? (
          <p className="text-sm text-zinc-600">
            No clients yet. Generate keys under{" "}
            <Link href="/advisor/access-keys" className={appInlineLinkClass}>
              Access keys
            </Link>{" "}
            and share one per signup.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 bg-white">
            {data.recentlyJoinedClients.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div>
                  <p className="font-medium text-zinc-900">
                    {c.display_name?.trim() || "Unnamed client"}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Joined {new Date(c.created_at).toLocaleDateString()}
                  </p>
                </div>
                <p className="text-xs font-medium text-zinc-600">
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
