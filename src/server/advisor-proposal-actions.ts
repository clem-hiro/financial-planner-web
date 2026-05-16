"use server";

import { revalidatePath } from "next/cache";
import { applyAcceptedProposalChanges } from "@/domain/advisor-proposals/apply-changes";
import { getClientProfileForAdvisor } from "@/data/repositories/advisor-clients";
import {
  deleteProposalChangesByEntity,
  deleteProposalChangesBySection,
  getProposalById,
  listChangesForProposal,
  resolveProposal,
  submitProposal,
  upsertSectionNote,
} from "@/data/repositories/advisor-proposals";
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
  revalidatePath("/dashboard");
  revalidatePath("/budget");
  revalidatePath("/planning/future");
  revalidateSetupAndPlanning();
}

async function requireAdvisorDraftProposal(proposalId: string) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Sign in required" };

  const me = await getProfileById(supabase, user.id);
  if (!isAdvisor(me)) return { ok: false as const, error: "Not allowed" };

  const proposal = await getProposalById(supabase, proposalId);
  if (!proposal || proposal.advisor_user_id !== user.id) {
    return { ok: false as const, error: "Proposal not found" };
  }
  if (proposal.status !== "draft") {
    return { ok: false as const, error: "This proposal can no longer be edited" };
  }

  const link = await getClientProfileForAdvisor(
    supabase,
    user.id,
    proposal.client_user_id
  );
  if (!link) return { ok: false as const, error: "Client not found" };

  return { ok: true as const, supabase, proposal, advisorUserId: user.id };
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

export async function acceptAdvisorProposalAction(
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

  const me = await getProfileById(supabase, user.id);
  if (!isClient(me)) return { error: "Not allowed" };

  const proposal = await getProposalById(supabase, proposalId);
  if (!proposal || proposal.client_user_id !== user.id) {
    return { error: "Proposal not found" };
  }
  if (proposal.status !== "pending") {
    return { error: "This proposal is no longer open for review" };
  }

  const changes = await listChangesForProposal(supabase, proposalId);
  if (changes.length === 0) return { error: "No changes to apply" };

  try {
    await applyAcceptedProposalChanges(supabase, user.id, changes);
    await resolveProposal(supabase, proposalId, "accepted");
    await markAsReadByDedupeKey(supabase, user.id, `advisor_proposal:${proposalId}`);
  } catch (e) {
    console.error(e);
    return { error: "Could not apply changes. Please try again or contact support." };
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

  const me = await getProfileById(supabase, user.id);
  if (!isClient(me)) return { error: "Not allowed" };

  const proposal = await getProposalById(supabase, proposalId);
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
