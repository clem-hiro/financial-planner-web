import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fieldMeta,
  serializeProposalValue,
  valuesEqual,
} from "@/domain/advisor-proposals/field-registry";
import type {
  AdvisorProposalChangeRow,
  AdvisorProposalRow,
  AdvisorProposalSectionNoteRow,
  AdvisorProposalStatus,
} from "@/data/supabase/types";
import type { ProposalEntityType } from "@/domain/advisor-proposals/sections";

export type ProposalChangeInput = {
  entityType: ProposalEntityType;
  entityId: string | null;
  fieldKey: string;
  oldValue: unknown;
  newValue: unknown;
  explanation?: string | null;
  /** For budget lines / goals — shown in review UI. */
  contextLabel?: string | null;
};

export async function getProposalById(
  supabase: SupabaseClient,
  proposalId: string
): Promise<AdvisorProposalRow | null> {
  const { data, error } = await supabase
    .from("advisor_proposals")
    .select("*")
    .eq("id", proposalId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as AdvisorProposalRow | null;
}

export async function getPendingProposalForClient(
  supabase: SupabaseClient,
  advisorUserId: string,
  clientUserId: string
): Promise<AdvisorProposalRow | null> {
  const { data, error } = await supabase
    .from("advisor_proposals")
    .select("*")
    .eq("advisor_user_id", advisorUserId)
    .eq("client_user_id", clientUserId)
    .eq("status", "pending")
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as AdvisorProposalRow | null;
}

export async function getDraftProposalForClient(
  supabase: SupabaseClient,
  advisorUserId: string,
  clientUserId: string
): Promise<AdvisorProposalRow | null> {
  const { data, error } = await supabase
    .from("advisor_proposals")
    .select("*")
    .eq("advisor_user_id", advisorUserId)
    .eq("client_user_id", clientUserId)
    .eq("status", "draft")
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as AdvisorProposalRow | null;
}

export async function getOrCreateDraftProposal(
  supabase: SupabaseClient,
  advisorUserId: string,
  clientUserId: string
): Promise<AdvisorProposalRow> {
  const existing = await getDraftProposalForClient(supabase, advisorUserId, clientUserId);
  if (existing) return existing;

  const { data, error } = await supabase
    .from("advisor_proposals")
    .insert({
      advisor_user_id: advisorUserId,
      client_user_id: clientUserId,
      status: "draft",
    })
    .select()
    .single();
  if (error) throw error;
  return data as AdvisorProposalRow;
}

export async function listChangesForProposal(
  supabase: SupabaseClient,
  proposalId: string
): Promise<AdvisorProposalChangeRow[]> {
  const { data, error } = await supabase
    .from("advisor_proposal_changes")
    .select("*")
    .eq("proposal_id", proposalId)
    .order("section")
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as AdvisorProposalChangeRow[];
}

export async function listSectionNotesForProposal(
  supabase: SupabaseClient,
  proposalId: string
): Promise<AdvisorProposalSectionNoteRow[]> {
  const { data, error } = await supabase
    .from("advisor_proposal_section_notes")
    .select("*")
    .eq("proposal_id", proposalId);
  if (error) throw error;
  return (data ?? []) as AdvisorProposalSectionNoteRow[];
}

export async function countChangesForProposal(
  supabase: SupabaseClient,
  proposalId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("advisor_proposal_changes")
    .select("id", { count: "exact", head: true })
    .eq("proposal_id", proposalId);
  if (error) throw error;
  return count ?? 0;
}

/**
 * Upserts a field-level change on a draft proposal. Reverts to canonical when
 * new value equals old (removes the change row).
 */
export async function upsertProposalChange(
  supabase: SupabaseClient,
  proposalId: string,
  input: ProposalChangeInput
): Promise<void> {
  const meta = fieldMeta(input.entityType, input.fieldKey);
  const oldSerialized = serializeProposalValue(input.oldValue);
  const newSerialized = serializeProposalValue(input.newValue);

  if (valuesEqual(oldSerialized, newSerialized)) {
    let del = supabase
      .from("advisor_proposal_changes")
      .delete()
      .eq("proposal_id", proposalId)
      .eq("entity_type", input.entityType)
      .eq("field_key", input.fieldKey);
    if (input.entityId) {
      del = del.eq("entity_id", input.entityId);
    } else {
      del = del.is("entity_id", null);
    }
    const { error } = await del;
    if (error) throw error;
    return;
  }

  const fieldLabel = input.contextLabel
    ? `${meta.label} (${input.contextLabel})`
    : meta.label;

  const row = {
    proposal_id: proposalId,
    section: meta.section,
    entity_type: input.entityType,
    entity_id: input.entityId,
    field_key: input.fieldKey,
    field_label: fieldLabel,
    old_value: oldSerialized,
    new_value: newSerialized,
    explanation: input.explanation ?? null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("advisor_proposal_changes").upsert(row, {
    onConflict: "proposal_id,entity_type,entity_id,field_key",
  });
  if (error) throw error;
}

export async function upsertSectionNote(
  supabase: SupabaseClient,
  proposalId: string,
  section: string,
  note: string
): Promise<void> {
  const trimmed = note.trim();
  if (!trimmed) {
    const { error } = await supabase
      .from("advisor_proposal_section_notes")
      .delete()
      .eq("proposal_id", proposalId)
      .eq("section", section);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("advisor_proposal_section_notes").upsert(
    { proposal_id: proposalId, section, note: trimmed },
    { onConflict: "proposal_id,section" }
  );
  if (error) throw error;
}

export async function submitProposal(
  supabase: SupabaseClient,
  proposalId: string,
  advisorNote: string | null
): Promise<void> {
  const { error } = await supabase.rpc("submit_advisor_proposal", {
    p_proposal_id: proposalId,
    p_advisor_note: advisorNote,
  });
  if (error) throw error;
}

export async function resolveProposal(
  supabase: SupabaseClient,
  proposalId: string,
  status: Extract<AdvisorProposalStatus, "accepted" | "rejected">
): Promise<void> {
  const { error } = await supabase
    .from("advisor_proposals")
    .update({
      status,
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", proposalId)
    .eq("status", "pending");
  if (error) throw error;
}

export async function deleteProposalChangesBySection(
  supabase: SupabaseClient,
  proposalId: string,
  section: string
): Promise<void> {
  const { error: changeErr } = await supabase
    .from("advisor_proposal_changes")
    .delete()
    .eq("proposal_id", proposalId)
    .eq("section", section);
  if (changeErr) throw changeErr;

  const { error: noteErr } = await supabase
    .from("advisor_proposal_section_notes")
    .delete()
    .eq("proposal_id", proposalId)
    .eq("section", section);
  if (noteErr) throw noteErr;
}

export async function deleteProposalChangesByEntity(
  supabase: SupabaseClient,
  proposalId: string,
  entityType: ProposalEntityType,
  entityId: string | null
): Promise<void> {
  let q = supabase
    .from("advisor_proposal_changes")
    .delete()
    .eq("proposal_id", proposalId)
    .eq("entity_type", entityType);
  if (entityId) {
    q = q.eq("entity_id", entityId);
  } else {
    q = q.is("entity_id", null);
  }
  const { error } = await q;
  if (error) throw error;
}

export async function listProposalsForAdvisorClient(
  supabase: SupabaseClient,
  advisorUserId: string,
  clientUserId: string,
  limit = 10
): Promise<AdvisorProposalRow[]> {
  const { data, error } = await supabase
    .from("advisor_proposals")
    .select("*")
    .eq("advisor_user_id", advisorUserId)
    .eq("client_user_id", clientUserId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AdvisorProposalRow[];
}
