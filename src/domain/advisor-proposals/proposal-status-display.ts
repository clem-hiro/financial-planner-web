import type { AdvisorProposalStatus } from "@/data/supabase/types";

/**
 * Single source for proposal status → label + badge tone, in both advisor
 * and client voice. `tone` values are a strict subset of the `AdvisorBadge`
 * tones so a display can be handed straight to `<AdvisorBadge tone={...}>`.
 *
 * Centralised so a future status (e.g. `expired`) is added in exactly one
 * place and both surfaces stay in sync.
 */
export type ProposalStatusTone = "neutral" | "positive" | "warning" | "slate";

export type ProposalStatusVoice = "advisor" | "client";

export type ProposalStatusDisplay = {
  label: string;
  tone: ProposalStatusTone;
};

const ADVISOR_VOICE: Record<AdvisorProposalStatus, ProposalStatusDisplay> = {
  draft: { label: "Draft", tone: "neutral" },
  pending: { label: "Pending review", tone: "warning" },
  accepted: { label: "Accepted", tone: "positive" },
  rejected: { label: "Rejected", tone: "slate" },
  withdrawn: { label: "Withdrawn", tone: "slate" },
  accepting: { label: "Applying — rebuild if stuck", tone: "warning" },
};

const CLIENT_VOICE: Record<AdvisorProposalStatus, ProposalStatusDisplay> = {
  // A client never reaches a draft (not yet submitted); kept as a defensive
  // fallback so the map is total over the status enum.
  draft: { label: "Not yet sent", tone: "neutral" },
  pending: { label: "Awaiting your review", tone: "warning" },
  accepted: { label: "Accepted", tone: "positive" },
  rejected: { label: "Declined", tone: "slate" },
  withdrawn: { label: "Withdrawn by advisor", tone: "slate" },
  // Client never acts on this state; advisor must rebuild & resubmit.
  accepting: { label: "Being applied", tone: "warning" },
};

export function proposalStatusDisplay(
  status: AdvisorProposalStatus,
  voice: ProposalStatusVoice
): ProposalStatusDisplay {
  return (voice === "advisor" ? ADVISOR_VOICE : CLIENT_VOICE)[status];
}
