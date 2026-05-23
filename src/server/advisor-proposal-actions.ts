"use server";

import { revalidatePath } from "next/cache";
import {
  applyAcceptedProposalChanges,
  detectAcceptConflicts,
  nameConflictFromWriteError,
  type ProposalConflict,
} from "@/domain/advisor-proposals/apply-changes";
import { getClientProfileForAdvisor } from "@/data/repositories/advisor-clients";
import { assertConsent } from "@/server/advisor-consent";
import {
  claimAdvisorProposalForAccept,
  deleteProposalChangesByEntity,
  deleteProposalChangesBySection,
  finalizeAdvisorProposalAccept,
  getProposalById,
  listChangesForProposal,
  notifyAdvisorProposalConflict,
  resolveProposal,
  submitProposal,
  upsertSectionNote,
  withdrawProposal,
} from "@/data/repositories/advisor-proposals";
import type { AdvisorProposalStatus } from "@/data/supabase/types";
import type { ProposalEntityType } from "@/domain/advisor-proposals/sections";
import { markAsReadByDedupeKey } from "@/data/repositories/inbox-notifications";
import { getProfileById } from "@/data/repositories/profiles";
import { createSupabaseServerClient } from "@/data/supabase/server";
import { revalidateSetupAndPlanning } from "@/lib/planning-revalidate";
import { isAdvisor, isClient } from "@/lib/profile-role";

function revalidateProposalViews(clientId: string, proposalId: string) {
  revalidatePath("/advisor/clients");
  revalidatePath(`/advisor/client/${clientId}`);
  revalidatePath(`/review/proposal/${proposalId}`);
  revalidatePath(`/setup/advisor-proposals/${proposalId}`);
  revalidatePath("/dashboard");
  revalidatePath("/budget");
  revalidatePath("/planning/future");
  revalidateSetupAndPlanning();
}

async function requireAdvisorProposalInStatus(
  proposalId: string,
  allowed: AdvisorProposalStatus[],
  notAllowedError: string
) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Sign in required" };

  // me + proposal are independent reads (only need user.id / proposalId).
  const [me, proposal] = await Promise.all([
    getProfileById(supabase, user.id),
    getProposalById(supabase, proposalId),
  ]);
  if (!isAdvisor(me)) return { ok: false as const, error: "Not allowed" };

  if (!proposal || proposal.advisor_user_id !== user.id) {
    return { ok: false as const, error: "Proposal not found" };
  }
  if (!allowed.includes(proposal.status)) {
    return { ok: false as const, error: notAllowedError };
  }

  // link + consent are independent (both keyed on proposal.client_user_id).
  const [link, consent] = await Promise.all([
    getClientProfileForAdvisor(supabase, user.id, proposal.client_user_id),
    // Consent-first trust boundary: acting on a proposal is "proposing a
    // plan" — blocked until the client (resolved via the proposal row, not
    // client input) has granted active consent.
    assertConsent(supabase, proposal.client_user_id),
  ]);
  if (!link) return { ok: false as const, error: "Client not found" };
  if (!consent.ok) return { ok: false as const, error: consent.error };

  return { ok: true as const, supabase, proposal, advisorUserId: user.id };
}

function requireAdvisorDraftProposal(proposalId: string) {
  return requireAdvisorProposalInStatus(
    proposalId,
    ["draft"],
    "This proposal can no longer be edited"
  );
}

function requireAdvisorOpenProposal(proposalId: string) {
  return requireAdvisorProposalInStatus(
    proposalId,
    ["draft", "pending"],
    "This proposal can no longer be withdrawn"
  );
}

export async function removeAdvisorProposalSectionAction(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const proposalId = String(formData.get("proposal_id") ?? "").trim();
  const section = String(formData.get("section") ?? "").trim();
  if (!proposalId || !section) return { error: "Missing fields" };

  const ctx = await requireAdvisorDraftProposal(proposalId);
  if (!ctx.ok) return { error: ctx.error };

  try {
    await deleteProposalChangesBySection(ctx.supabase, proposalId, section);
  } catch (e) {
    console.error(e);
    return { error: "Could not remove section" };
  }

  revalidateProposalViews(ctx.proposal.client_user_id, proposalId);
  return { error: null };
}

export async function removeAdvisorProposalEntityAction(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const proposalId = String(formData.get("proposal_id") ?? "").trim();
  const entityType = String(formData.get("entity_type") ?? "").trim() as ProposalEntityType;
  const entityIdRaw = String(formData.get("entity_id") ?? "").trim();
  const entityId = entityIdRaw === "" || entityIdRaw === "profile" ? null : entityIdRaw;

  if (!proposalId || !entityType) return { error: "Missing fields" };

  const ctx = await requireAdvisorDraftProposal(proposalId);
  if (!ctx.ok) return { error: ctx.error };

  try {
    await deleteProposalChangesByEntity(ctx.supabase, proposalId, entityType, entityId);
  } catch (e) {
    console.error(e);
    return { error: "Could not remove change" };
  }

  revalidateProposalViews(ctx.proposal.client_user_id, proposalId);
  return { error: null };
}

export async function submitAdvisorProposalAction(
  _prev: { error: string | null; success?: boolean },
  formData: FormData
): Promise<{ error: string | null; success?: boolean }> {
  const proposalId = String(formData.get("proposal_id") ?? "").trim();
  const advisorNote = String(formData.get("advisor_note") ?? "").trim();

  if (!proposalId) return { error: "Missing proposal" };

  const ctx = await requireAdvisorDraftProposal(proposalId);
  if (!ctx.ok) return { error: ctx.error };

  try {
    await submitProposal(ctx.supabase, proposalId, advisorNote || null);

    const sectionNotesRaw = formData.get("section_notes_json");
    if (sectionNotesRaw && typeof sectionNotesRaw === "string") {
      try {
        const parsed = JSON.parse(sectionNotesRaw) as Record<string, string>;
        for (const [section, note] of Object.entries(parsed)) {
          if (note?.trim()) {
            await upsertSectionNote(ctx.supabase, proposalId, section, note);
          }
        }
      } catch {
        /* optional payload */
      }
    }
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "Could not submit proposal";
    return { error: msg };
  }

  revalidateProposalViews(ctx.proposal.client_user_id, proposalId);
  return { error: null, success: true };
}

export type AcceptProposalState = {
  error: string | null;
  conflicts?: ProposalConflict[];
};

export async function withdrawAdvisorProposalAction(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const proposalId = String(formData.get("proposal_id") ?? "").trim();
  if (!proposalId) return { error: "Missing proposal" };

  const ctx = await requireAdvisorOpenProposal(proposalId);
  if (!ctx.ok) return { error: ctx.error };

  try {
    await withdrawProposal(ctx.supabase, proposalId);
  } catch (e) {
    console.error(e);
    return { error: "Could not withdraw proposal" };
  }

  revalidateProposalViews(ctx.proposal.client_user_id, proposalId);
  return { error: null };
}

export async function acceptAdvisorProposalAction(
  _prev: AcceptProposalState,
  formData: FormData
): Promise<AcceptProposalState> {
  const proposalId = String(formData.get("proposal_id") ?? "").trim();
  if (!proposalId) return { error: "Missing proposal" };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required" };

  // me + proposal + changes are independent reads — batch them.
  const [me, proposal, changes] = await Promise.all([
    getProfileById(supabase, user.id),
    getProposalById(supabase, proposalId),
    listChangesForProposal(supabase, proposalId),
  ]);
  if (!isClient(me)) return { error: "Not allowed" };

  if (!proposal || proposal.client_user_id !== user.id) {
    return { error: "Proposal not found" };
  }
  if (proposal.status !== "pending") {
    return { error: "This proposal is no longer open for review" };
  }

  if (changes.length === 0) return { error: "No changes to apply" };

  // Pre-claim, while still 'pending': optimistic-concurrency pre-flight. A
  // benign baseline-moved conflict must leave the proposal pending (advisor
  // re-baselines) — never park it. Zero writes here.
  const { conflicts, base } = await detectAcceptConflicts(
    supabase,
    user.id,
    changes
  );
  if (conflicts.length > 0) {
    // Best-effort advisor re-baseline alert (B8) — a notify failure must not
    // mask the conflict response.
    try {
      await notifyAdvisorProposalConflict(supabase, proposalId);
    } catch (e) {
      console.error(e);
    }
    return {
      error:
        "Your plan changed since this proposal was prepared. Ask your advisor to refresh it before accepting.",
      conflicts,
    };
  }

  // C1 claim — atomically GATE the writes: pending->'accepting' under a row
  // lock. If a withdraw won the race this RAISEs and ZERO writes occur.
  try {
    await claimAdvisorProposalForAccept(supabase, proposalId);
  } catch (e) {
    console.error(e);
    return {
      error:
        "This proposal changed while you were reviewing it (it may have been withdrawn). Reopen it to see the latest.",
    };
  }

  // Claimed: status='accepting', withdraw can no longer race. Past here a
  // failure leaves the proposal parked in 'accepting' — the C2 terminal
  // non-acceptable state (not re-acceptable; no create-op duplication).
  try {
    await applyAcceptedProposalChanges(supabase, user.id, changes, base);
    // Fail-loud accepting->accepted; never a false success.
    await finalizeAdvisorProposalAccept(supabase, proposalId);
  } catch (e) {
    console.error(e);
    // TOCTOU: a colliding name slipped past the pre-claim check and the unique
    // index threw mid-write. Surface the same friendly name_in_use conflict
    // instead of the generic park message. The proposal still parks in
    // 'accepting' (C2) — we only improve the message, not the state machine.
    const nameConflicts = nameConflictFromWriteError(e, changes);
    if (nameConflicts) {
      return {
        error:
          "A name in this proposal is already in use in your plan. Ask your advisor to rename it before accepting.",
        conflicts: nameConflicts,
      };
    }
    return {
      error:
        "We couldn’t finish applying this proposal. It’s been flagged for your advisor to rebuild.",
    };
  }

  // Accepted. Inbox cleanup is best-effort — its failure must not flip the
  // (already committed) accept into the failure path.
  try {
    await markAsReadByDedupeKey(
      supabase,
      user.id,
      `advisor_proposal:${proposalId}`
    );
  } catch (e) {
    console.error(e);
  }

  revalidateProposalViews(user.id, proposalId);
  return { error: null };
}

export async function rejectAdvisorProposalAction(
  _prev: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const proposalId = String(formData.get("proposal_id") ?? "").trim();
  if (!proposalId) return { error: "Missing proposal" };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required" };

  const [me, proposal] = await Promise.all([
    getProfileById(supabase, user.id),
    getProposalById(supabase, proposalId),
  ]);
  if (!isClient(me)) return { error: "Not allowed" };

  if (!proposal || proposal.client_user_id !== user.id) {
    return { error: "Proposal not found" };
  }
  if (proposal.status !== "pending") {
    return { error: "This proposal is no longer open for review" };
  }

  try {
    await resolveProposal(supabase, proposalId, "rejected");
    await markAsReadByDedupeKey(supabase, user.id, `advisor_proposal:${proposalId}`);
  } catch (e) {
    console.error(e);
    return { error: "Could not reject proposal" };
  }

  revalidateProposalViews(user.id, proposalId);
  return { error: null };
}
