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
): Promise<{ proposalId: string }> {
  const proposal = await getOrCreateDraftProposal(supabase, advisorUserId, clientUserId);
  // Each change targets a distinct identity key (entity + field) within the
  // proposal, so the upserts are independent — run them concurrently.
  await Promise.all(
    changes.map((c) => upsertProposalChange(supabase, proposal.id, c))
  );
  return { proposalId: proposal.id };
}
