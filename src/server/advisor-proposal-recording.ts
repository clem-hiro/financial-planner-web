import {
  getOrCreateDraftProposal,
  upsertProposalChange,
  type ProposalChangeInput,
} from "@/data/repositories/advisor-proposals";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function recordAdvisorProposalChanges(
  supabase: SupabaseClient,
  advisorUserId: string,
  clientUserId: string,
  changes: ProposalChangeInput[]
): Promise<{ proposalId: string; changeCount: number }> {
  const proposal = await getOrCreateDraftProposal(supabase, advisorUserId, clientUserId);
  for (const c of changes) {
    await upsertProposalChange(supabase, proposal.id, c);
  }
  const { count } = await supabase
    .from("advisor_proposal_changes")
    .select("id", { count: "exact", head: true })
    .eq("proposal_id", proposal.id);
  return { proposalId: proposal.id, changeCount: count ?? 0 };
}
