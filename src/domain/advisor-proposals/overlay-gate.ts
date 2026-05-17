import type { AdvisorProposalRow } from "@/data/supabase/types";

export type OverlaySurface =
  | "advisor_workspace"
  | "client_review"
  | "client_dashboard";

export type OverlayGateInput = {
  viewerRole: "advisor" | "client";
  viewerId: string;
  surface: OverlaySurface;
  proposal: Pick<
    AdvisorProposalRow,
    "advisor_user_id" | "client_user_id" | "status"
  > | null;
};

/**
 * Pure role + workflow-status gate. RLS is owner-scoped only and NOT
 * status-aware (C7), so this decides whether a proposal may feed the overlay:
 *
 * - advisor workspace: own client's `draft` or `pending`
 * - client review:     own `pending` or `accepted` — never `draft`
 * - client dashboard:  never overlaid
 *
 * Loaders MUST still constrain status in the query itself; this is the
 * second, independent enforcement layer, not a substitute for it.
 */
export function resolveOverlayForViewer(input: OverlayGateInput): boolean {
  const { viewerRole, viewerId, surface, proposal } = input;
  if (!proposal) return false;

  if (surface === "advisor_workspace") {
    return (
      viewerRole === "advisor" &&
      proposal.advisor_user_id === viewerId &&
      (proposal.status === "draft" || proposal.status === "pending")
    );
  }

  if (surface === "client_review") {
    return (
      viewerRole === "client" &&
      proposal.client_user_id === viewerId &&
      (proposal.status === "pending" || proposal.status === "accepted")
    );
  }

  // client_dashboard and anything else: canonical only.
  return false;
}
