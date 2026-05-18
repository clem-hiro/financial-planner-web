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

  const keysClaimedButNoClientsVisible =
    data.totalClients === 0 && data.keyCounts.claimed > 0;

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

      {keysClaimedButNoClientsVisible ? (
        <div
          className="rounded-2xl border border-amber-200 bg-amber-50/95 px-4 py-4 text-sm leading-relaxed text-amber-950 sm:px-5"
          role="status"
        >
          <p className="font-semibold text-amber-950">
            You have claimed access keys, but no client is linked to this advisor account yet.
          </p>
          <p className="mt-2">
            A key shows as <strong>claimed</strong> once someone starts signing up with it. A
            client only appears here after they finish signup and their profile links to your
            advisor account — a signup still in progress will show up once completed.
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>
              Confirm you are signed in as the advisor the keys were issued to. Keys claimed
              under a different advisor account will not surface clients here.{" "}
              <span className="font-medium">Your current session id:</span>{" "}
              <code className="rounded bg-white/90 px-1 py-0.5 text-[11px] break-all">{user.id}</code>
            </li>
            <li>
              Linked clients always appear here by name, even before they grant consent —
              consent only gates each client&apos;s <strong>financial detail</strong>, not their
              presence in this list. Review and request consent per client under{" "}
              <Link href="/advisor/clients" className={appInlineLinkClass}>
                Clients
              </Link>
              .
            </li>
          </ul>
        </div>
      ) : null}

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
          keysClaimedButNoClientsVisible ? (
            <p className="text-sm text-slate-600">
              No client is linked to this advisor account yet. See the note above on claimed
              keys and advisor account match.
            </p>
          ) : (
            <p className="text-sm text-slate-600">
              No clients yet. Buy keys under{" "}
              <Link href="/advisor/buy-keys" className={appInlineLinkClass}>
                Buy keys
              </Link>{" "}
              and share one per signup.
            </p>
          )
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
