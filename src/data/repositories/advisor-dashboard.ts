import type { SupabaseClient } from "@supabase/supabase-js";
import {
  countAdvisorAccessKeyStatuses,
  type AdvisorAccessKeyStatusCounts,
} from "@/data/repositories/advisor-access-keys";
import {
  listClientsForAdvisor,
  type AdvisorClientListRow,
} from "@/data/repositories/advisor-clients";

export type AdvisorDashboardData = {
  totalClients: number;
  clientsOnboarded: number;
  clientsPendingOnboarding: number;
  keyCounts: AdvisorAccessKeyStatusCounts;
  recentlyJoinedClients: AdvisorClientListRow[];
};

export async function getAdvisorDashboardData(
  supabase: SupabaseClient,
  advisorUserId: string
): Promise<AdvisorDashboardData> {
  const [clients, keyCounts] = await Promise.all([
    listClientsForAdvisor(supabase, advisorUserId),
    countAdvisorAccessKeyStatuses(supabase, advisorUserId),
  ]);

  let clientsOnboarded = 0;
  let clientsPendingOnboarding = 0;
  for (const c of clients) {
    if (c.onboarding_completed_at) {
      clientsOnboarded += 1;
    } else if (c.onboarding_required) {
      clientsPendingOnboarding += 1;
    }
  }

  const recentlyJoinedClients = clients.slice(0, 8);

  return {
    totalClients: clients.length,
    clientsOnboarded,
    clientsPendingOnboarding,
    keyCounts,
    recentlyJoinedClients,
  };
}
