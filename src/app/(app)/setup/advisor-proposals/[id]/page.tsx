import type { ReactNode } from "react";
import {
  getProposalById,
  listChangesForProposal,
  listSectionNotesForProposal,
} from "@/data/repositories/advisor-proposals";
import { getProfileById } from "@/data/repositories/profiles";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { getDashboardPayload } from "@/data/dashboard";
import { resolveOverlayForViewer } from "@/domain/advisor-proposals/overlay-gate";
import { DashboardRetirementSection } from "@/features/dashboard/DashboardRetirementSection";
import { ClientProposalReviewView } from "@/features/proposals/ClientProposalReviewView";
import { DEFAULT_BASE_CURRENCY } from "@/lib/currency";
import { formatYearMonth } from "@/lib/dates";
import { isSupabaseConfigured } from "@/lib/env";
import { isClient } from "@/lib/profile-role";
import { notFound, redirect } from "next/navigation";

type PageProps = { params: Promise<{ id: string }> };

export default async function ClientProposalReviewPage({ params }: PageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <p className="text-sm text-zinc-600">
        Configure Supabase to review plan changes.
      </p>
    );
  }

  const { id: proposalId } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const me = await getProfileById(supabase, user.id);
  if (!isClient(me)) redirect("/advisor");

  const proposal = await getProposalById(supabase, proposalId);
  if (!proposal || proposal.client_user_id !== user.id) {
    notFound();
  }
  // Drafts are advisor-only and never client-visible (status-gate is the
  // authorization boundary — client SELECT RLS is not status-scoped).
  if (proposal.status === "draft") {
    notFound();
  }

  const [changes, sectionNotes, advisorProfile] = await Promise.all([
    listChangesForProposal(supabase, proposalId),
    listSectionNotesForProposal(supabase, proposalId),
    getProfileById(supabase, proposal.advisor_user_id),
  ]);

  const currencyCode = me?.base_currency ?? DEFAULT_BASE_CURRENCY;

  const showProjection =
    resolveOverlayForViewer({
      viewerRole: "client",
      viewerId: user.id,
      surface: "client_review",
      proposal,
    }) && changes.length > 0;

  let actualProjection: ReactNode = null;
  let proposedProjection: ReactNode = null;
  if (showProjection) {
    const month = formatYearMonth(new Date());
    const [payloadActual, payloadProposed] = await Promise.all([
      getDashboardPayload(supabase, user.id, month),
      getDashboardPayload(supabase, user.id, month, {
        proposalOverlay: changes,
      }),
    ]);
    actualProjection = (
      <DashboardRetirementSection payload={payloadActual} profile={me} />
    );
    proposedProjection = (
      <DashboardRetirementSection payload={payloadProposed} profile={me} />
    );
  }

  return (
    <ClientProposalReviewView
      proposal={proposal}
      changes={changes}
      sectionNotes={sectionNotes}
      advisorDisplayName={advisorProfile?.display_name?.trim() || "Your advisor"}
      currencyCode={currencyCode}
      hasProjection={showProjection}
      actualProjection={actualProjection}
      proposedProjection={proposedProjection}
    />
  );
}
