import Link from "next/link";
import { listClientsForAdvisor } from "@/data/repositories/advisor-clients";
import { getProfileById } from "@/data/repositories/profiles";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { appInlineLinkClass } from "@/ui/app-link-styles";
import { isSupabaseConfigured } from "@/lib/env";
import { isAdvisor } from "@/lib/profile-role";
import { redirect } from "next/navigation";

function onboardingLabel(row: {
  onboarding_required: boolean;
  onboarding_completed_at: string | null;
}) {
  if (row.onboarding_completed_at) return "Onboarded";
  if (row.onboarding_required) return "Pending";
  return "—";
}

export default async function AdvisorClientsPage() {
  if (!isSupabaseConfigured()) {
    return (
      <p className="text-sm text-zinc-600">Configure Supabase to load clients.</p>
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

  const clients = await listClientsForAdvisor(supabase, user.id);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Clients</h1>
        <p className="mt-1 text-sm text-zinc-600">
          High-level roster only — no balances or goals here yet. Future: notes, documents, and
          reviews.
        </p>
      </div>

      {clients.length === 0 ? (
        <p className="text-sm text-zinc-600">
          No invited clients yet. Issue keys from{" "}
          <Link href="/advisor/access-keys" className={appInlineLinkClass}>
            Access keys
          </Link>
          .
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50/90 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Onboarding</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Last active</th>
                <th className="hidden px-4 py-3 sm:table-cell">Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {clients.map((c) => (
                <tr key={c.id} className="text-zinc-800">
                  <td className="px-4 py-3">
                    <Link
                      href={`/advisor/client/${c.id}`}
                      className={`font-medium text-zinc-900 ${appInlineLinkClass}`}
                    >
                      {c.display_name?.trim() || "Unnamed client"}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">{onboardingLabel(c)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-600">
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-zinc-500">—</td>
                  <td className="hidden px-4 py-3 text-zinc-500 sm:table-cell">
                    <span className="text-xs">Insights coming later</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
