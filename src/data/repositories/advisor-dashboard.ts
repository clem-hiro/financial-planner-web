import type { SupabaseClient } from "@supabase/supabase-js";
import {
  countAdvisorAccessKeyStatuses,
  type AdvisorAccessKeyStatusCounts,
} from "@/data/repositories/advisor-access-keys";
import {
  listAdvisorClientsWorkspace,
  type AdvisorClientListRow,
  type AdvisorClientWorkspaceListRow,
} from "@/data/repositories/advisor-clients";

export type AdvisorDashboardData = {
  totalClients: number;
  clientsOnboarded: number;
  clientsPendingOnboarding: number;
  keyCounts: AdvisorAccessKeyStatusCounts;
  recentlyJoinedClients: AdvisorClientListRow[];
};

// Consent-Gate Phase 2 dropped the `financial_profiles` advisor SELECT policy,
// so the old direct `.from("financial_profiles")` roster read is RLS-denied and
// returns 0 permanently. The dashboard now sources its roster through the same
// SECURITY DEFINER path `/advisor/clients` uses (`advisor_client_list_metrics` /
// `advisor_client_list_count` via listAdvisorClientsWorkspace), which is
// consent-independent for identity/onboarding columns and never exposes
// financial fields for a non-consented client.
//
// The metrics RPC caps p_limit at 200 — the shared product ceiling for the
// `/advisor/clients` roster. We fetch ONE page at that ceiling (no unbounded
// paging): totalClients stays authoritative at any scale, while onboarded/
// pending are scoped to the first 200 linked clients. >200 linked clients for a
// single BYOFA advisor is not a realistic scenario, and this keeps the
// dashboard consistent with the roster it links to.
const ROSTER_PAGE_SIZE = 200;

function toListRow(r: AdvisorClientWorkspaceListRow): AdvisorClientListRow {
  return {
    id: r.id,
    display_name: r.display_name,
    profile_type: "client",
    onboarding_required: r.onboarding_required,
    onboarding_completed_at: r.onboarding_completed_at,
    created_at: r.created_at,
  };
}

export async function getAdvisorDashboardData(
  supabase: SupabaseClient,
  advisorUserId: string
): Promise<AdvisorDashboardData> {
  const [page, keyCounts] = await Promise.all([
    listAdvisorClientsWorkspace(supabase, advisorUserId, {
      limit: ROSTER_PAGE_SIZE,
      sort: "created_desc",
    }),
    countAdvisorAccessKeyStatuses(supabase, advisorUserId),
  ]);

  // Authoritative count (count(*) over () / advisor_client_list_count), never
  // the truncated page length — correct at any scale.
  const totalClients = page.totalCount;

  // Onboarded/pending derived from identity-only columns of the first 200-row
  // page (the ROSTER_PAGE_SIZE ceiling documented above). Never read financial
  // columns or consent_status.
  let clientsOnboarded = 0;
  let clientsPendingOnboarding = 0;
  for (const c of page.rows) {
    if (c.onboarding_completed_at) clientsOnboarded += 1;
    else if (c.onboarding_required) clientsPendingOnboarding += 1;
  }

  const recentlyJoinedClients = page.rows.slice(0, 8).map(toListRow);

  return {
    totalClients,
    clientsOnboarded,
    clientsPendingOnboarding,
    keyCounts,
    recentlyJoinedClients,
  };
}
