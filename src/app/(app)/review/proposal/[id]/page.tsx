import {
  getProposalById,
  listChangesForProposal,
  listSectionNotesForProposal,
} from "@/data/repositories/advisor-proposals";
import { getProfileById } from "@/data/repositories/profiles";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { ProposalReviewView } from "@/features/proposals/ProposalReviewView";
import { DEFAULT_BASE_CURRENCY } from "@/lib/currency";
import { isSupabaseConfigured } from "@/lib/env";
import { isClient } from "@/lib/profile-role";
import { notFound, redirect } from "next/navigation";

type PageProps = { params: Promise<{ id: string }> };

export default async function ProposalReviewPage({ params }: PageProps) {
  if (!isSupabaseConfigured()) {
    return (
      <p className="text-sm text-zinc-600">Configure Supabase to review plan changes.</p>
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

  if (proposal.status === "draft") {
    notFound();
  }

  const [changes, sectionNotes, advisorProfile] = await Promise.all([
    listChangesForProposal(supabase, proposalId),
    listSectionNotesForProposal(supabase, proposalId),
    getProfileById(supabase, proposal.advisor_user_id),
  ]);

  const currencyCode = me?.base_currency ?? DEFAULT_BASE_CURRENCY;

  return (
    <ProposalReviewView
      proposal={proposal}
      changes={changes}
      sectionNotes={sectionNotes}
      advisorDisplayName={advisorProfile?.display_name?.trim() || "Your advisor"}
      currencyCode={currencyCode}
    />
  );
}
