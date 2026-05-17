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
import { listBudgetLines } from "@/data/repositories/budget-lines";
import { listFinancialGoals } from "@/data/repositories/goals";
import { advisorReadInvestments } from "@/data/repositories/investments";
import { getProfileById } from "@/data/repositories/profiles";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { resolveOverlayForViewer } from "@/domain/advisor-proposals/overlay-gate";
import { AdvisorClientWorkspace } from "@/features/advisor/AdvisorClientWorkspace";
import { formatYearMonth } from "@/lib/dates";
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
    getProfileById(supabase, clientId),
    getDashboardPayload(supabase, clientId, month, { viewer: "advisor" }),
    listFinancialGoals(supabase, clientId),
    listBudgetLines(supabase, clientId),
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

  if (!clientProfile) {
    notFound();
  }

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
      profile={clientProfile}
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
