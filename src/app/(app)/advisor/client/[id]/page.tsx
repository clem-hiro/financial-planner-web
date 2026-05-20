import { getDashboardPayload } from "@/data/dashboard";
import {
  getDraftProposalForClient,
  getPendingProposalForClient,
  listChangesForProposal,
} from "@/data/repositories/advisor-proposals";
import {
  advisorCanReadClient,
  getClientProfileForAdvisor,
} from "@/data/repositories/advisor-clients";
import type { AdvisorClientListRow } from "@/data/repositories/advisor-clients";
import { advisorReadBudgetLines } from "@/data/repositories/budget-lines";
import { advisorReadGoals } from "@/data/repositories/goals";
import { advisorReadInvestments } from "@/data/repositories/investments";
import { getProfileById, advisorReadProfile } from "@/data/repositories/profiles";
import type { ProfileRow } from "@/data/supabase/types";
import { DEFAULT_BASE_CURRENCY } from "@/lib/currency";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { resolveOverlayForViewer } from "@/domain/advisor-proposals/overlay-gate";
import { AdvisorClientWorkspace } from "@/features/advisor/AdvisorClientWorkspace";
import { formatYearMonth } from "@/lib/dates";
import { isSupabaseConfigured } from "@/lib/env";
import { isAdvisor } from "@/lib/profile-role";
import { redirect, notFound } from "next/navigation";

type PageProps = { params: Promise<{ id: string }> };

/**
 * Identity-only ProfileRow for the linked-but-NOT-consented gated workspace.
 * advisor_read_profile (consent-gated) returns null then, but the consent-
 * first UX must render the "consent required" state (which reads only
 * `display_name`), NOT a 404. Every financial/planning field is null by
 * construction — non-consented client data is never fetched or serialized
 * (PDPA / Pillar 2). Built from the consent-INDEPENDENT linkage identity. A
 * future ProfileRow field will fail typecheck here — resolve it explicitly
 * (null unless it is pure identity), never leak a financial default.
 */
function identityOnlyProfile(link: AdvisorClientListRow): ProfileRow {
  return {
    id: link.id,
    profile_type: "client",
    advisor_user_id: null,
    display_name: link.display_name,
    monthly_income: null,
    salary_frequency: null,
    annual_bonus: null,
    savings_target_monthly: null,
    fixed_expenses_monthly: null,
    debt_obligations_monthly: null,
    monthly_gross_salary: null,
    annual_salary_growth_nominal: null,
    expense_growth_nominal: null,
    cpf_age_band: null,
    birth_date: null,
    target_retirement_age: null,
    retirement_monthly_spend_goal: null,
    retirement_dividend_yield_annual: null,
    retirement_withdrawal_rate_annual: null,
    onboarding_required: link.onboarding_required,
    onboarding_step: null,
    onboarding_completed_at: link.onboarding_completed_at,
    lifestyle_profile: null,
    budgeting_strategy: null,
    onboarding_confidence_level: null,
    budget_generation_source: null,
    estimated_budget_mode: false,
    food_spend_band: null,
    base_currency: DEFAULT_BASE_CURRENCY,
    salary_increment_month: null,
    last_salary_review_at: null,
    last_investment_review_at: null,
    created_at: link.created_at,
  };
}

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

  const advisorProfile = await getProfileById(supabase, user.id);
  if (!isAdvisor(advisorProfile)) {
    redirect("/dashboard");
  }

  const linkOk = await getClientProfileForAdvisor(supabase, user.id, clientId);
  if (!linkOk) {
    notFound();
  }

  const month = formatYearMonth(new Date());

  const [
    clientProfile,
    payload,
    goals,
    budgetLines,
    investments,
    draftProposal,
    consentGranted,
  ] = await Promise.all([
    advisorReadProfile(supabase, clientId),
    getDashboardPayload(supabase, clientId, month, { viewer: "advisor" }),
    advisorReadGoals(supabase, clientId),
    advisorReadBudgetLines(supabase, clientId),
    advisorReadInvestments(supabase, clientId),
    getDraftProposalForClient(supabase, user.id, clientId),
    advisorCanReadClient(supabase, clientId),
  ]);

  const pendingProposal = await getPendingProposalForClient(
    supabase,
    user.id,
    clientId
  );

  const draftId = draftProposal?.id ?? null;
  const draftChanges = draftId
    ? await listChangesForProposal(supabase, draftId)
    : [];

  // linkOk (consent-independent) already 404'd a non-linked client above.
  // A linked-but-NOT-consented client has clientProfile === null (consent-
  // gated) — it must render the gated workspace, not 404. The workspace then
  // reads only display_name from this identity-only profile.
  const workspaceProfile: ProfileRow =
    clientProfile ?? identityOnlyProfile(linkOk);

  // Advisor previews their own client's draft (or pending) proposal. The gate
  // is the second enforcement layer; the proposals were already queried scoped
  // to this advisor + client.
  const overlayProposal = draftProposal ?? pendingProposal;
  const overlayChanges = draftId
    ? draftChanges
    : overlayProposal
      ? await listChangesForProposal(supabase, overlayProposal.id)
      : [];
  const hasOverlay =
    resolveOverlayForViewer({
      viewerRole: "advisor",
      viewerId: user.id,
      surface: "advisor_workspace",
      proposal: overlayProposal,
    }) && overlayChanges.length > 0;
  const payloadProposed = hasOverlay
    ? await getDashboardPayload(supabase, clientId, month, {
        proposalOverlay: overlayChanges,
        viewer: "advisor",
      })
    : payload;

  return (
    <AdvisorClientWorkspace
      clientId={clientId}
      consentGranted={consentGranted}
      profile={workspaceProfile}
      payload={payload}
      payloadProposed={payloadProposed}
      hasOverlay={hasOverlay}
      goals={goals}
      budgetLines={budgetLines}
      investments={investments}
      month={month}
      draftProposalId={draftId}
      draftChanges={draftChanges}
      hasPendingProposal={!!pendingProposal}
    />
  );
}
