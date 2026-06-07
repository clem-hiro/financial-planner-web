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
  ProposalChangeOp,
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
  /** Defaults to "update". "create"/"delete" skip the revert-on-equal path. */
  changeOp?: ProposalChangeOp;
  /** Groups the fields of one not-yet-persisted entity (entity_id is null). */
  draftEntityKey?: string | null;
  /** Target entity's updated_at at suggest-time — the concurrency token. */
  baseVersion?: string | null;
};

// Identity of a change row: an edit/delete keys on the real entity_id; a
// not-yet-persisted create keys on draft_entity_key (entity_id stays null
// until accept inserts the row). The two key shapes mirror the partial unique
// indexes from migration 20260602000000. We cannot use PostgREST onConflict —
// a partial unique index is not inferrable without its predicate — so callers
// select-then-insert/update keyed via `changeKeyColumns` below. (No shared
// builder helper: threading supabase-js's recursive builder generics through
// a type parameter blows TS instantiation depth.)
function changeKeyColumns(
  input: ProposalChangeInput
): Array<[column: string, value: string | null, isNull?: true]> {
  const cols: Array<[string, string | null, true?]> = [
    ["entity_type", input.entityType],
    ["field_key", input.fieldKey],
  ];
  if (input.entityId) {
    cols.push(["entity_id", input.entityId]);
  } else {
    cols.push(["entity_id", null, true]);
    if (input.draftEntityKey) {
      cols.push(["draft_entity_key", input.draftEntityKey]);
    }
  }
  return cols;
}

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
  // Advisor identity is derived server-side from auth.uid() inside the RPC;
  // the param stays for call-site signature stability.
  advisorUserId: string,
  clientUserId: string
): Promise<AdvisorProposalRow> {
  const { data, error } = await supabase.rpc("create_advisor_draft_proposal", {
    p_client: clientUserId,
  });
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
 * Count of proposals awaiting this client's action (advisor-submitted, not yet
 * accepted/rejected). Drives the "you have something to review" badge. Read-side
 * RLS already scopes the client to their own rows.
 */
export async function countPendingProposalsForClient(
  supabase: SupabaseClient,
  clientId: string
): Promise<number> {
  const { count, error } = await supabase
    .from("advisor_proposals")
    .select("id", { count: "exact", head: true })
    .eq("client_user_id", clientId)
    .eq("status", "pending");
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
  const changeOp: ProposalChangeOp = input.changeOp ?? "update";
  const meta = fieldMeta(input.entityType, input.fieldKey);
  const oldSerialized = serializeProposalValue(input.oldValue);
  const newSerialized = serializeProposalValue(input.newValue);

  const keyCols = changeKeyColumns(input);

  // Editing a field back to canonical retracts the suggestion. Only an update
  // has a canonical to revert to (create's old is null; delete is a marker).
  if (changeOp === "update" && valuesEqual(oldSerialized, newSerialized)) {
    let del = supabase
      .from("advisor_proposal_changes")
      .delete()
      .eq("proposal_id", proposalId);
    for (const [col, val, isNull] of keyCols) {
      del = isNull ? del.is(col, null) : del.eq(col, val);
    }
    const { error } = await del;
    if (error) throw error;
    return;
  }

  const fieldLabel = input.contextLabel
    ? `${meta.label} (${input.contextLabel})`
    : meta.label;

  let sel = supabase
    .from("advisor_proposal_changes")
    .select("id")
    .eq("proposal_id", proposalId);
  for (const [col, val, isNull] of keyCols) {
    sel = isNull ? sel.is(col, null) : sel.eq(col, val);
  }
  const { data: existing, error: selErr } = await sel.maybeSingle();
  if (selErr) throw selErr;

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
    change_op: changeOp,
    draft_entity_key: input.draftEntityKey ?? null,
    base_version: input.baseVersion ?? null,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { error } = await supabase
      .from("advisor_proposal_changes")
      .update(row)
      .eq("id", (existing as { id: string }).id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("advisor_proposal_changes")
      .insert(row);
    if (error) throw error;
  }
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

export async function withdrawProposal(
  supabase: SupabaseClient,
  proposalId: string
): Promise<void> {
  const { error } = await supabase.rpc("withdraw_advisor_proposal", {
    p_proposal_id: proposalId,
  });
  if (error) throw error;
}

export async function notifyAdvisorProposalConflict(
  supabase: SupabaseClient,
  proposalId: string
): Promise<void> {
  const { error } = await supabase.rpc("notify_advisor_proposal_conflict", {
    p_proposal_id: proposalId,
  });
  if (error) throw error;
}

/**
 * C1 claim — serialized pending->'accepting' under a row lock. GATES the
 * entity writes: the handler runs writes only if this resolves. Throws on
 * not-found / not-pending / 0-row (a lost withdraw race) so ZERO writes occur.
 */
export async function claimAdvisorProposalForAccept(
  supabase: SupabaseClient,
  proposalId: string
): Promise<void> {
  const { error } = await supabase.rpc("claim_advisor_proposal_for_accept", {
    p_proposal_id: proposalId,
  });
  if (error) throw error;
}

/**
 * C1 finalize — 'accepting'->'accepted' after the entity writes succeeded.
 * Throws (fail-loud) on any miss so the handler never reports a false
 * success. A proposal left in 'accepting' (writes failed) is the C2 terminal
 * non-acceptable state — not re-acceptable, so create-ops cannot duplicate.
 */
export async function finalizeAdvisorProposalAccept(
  supabase: SupabaseClient,
  proposalId: string
): Promise<void> {
  const { error } = await supabase.rpc("finalize_advisor_proposal_accept", {
    p_proposal_id: proposalId,
  });
  if (error) throw error;
}

/**
 * Reject transition. Fails loud on a zero-row update (status moved underneath)
 * so the handler cannot report a false success — same class as the C1 accept
 * silent-no-op bug.
 */
export async function resolveProposal(
  supabase: SupabaseClient,
  proposalId: string,
  status: Extract<AdvisorProposalStatus, "rejected">
): Promise<void> {
  const { data, error } = await supabase
    .from("advisor_proposals")
    .update({
      status,
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", proposalId)
    .eq("status", "pending")
    .select("id");
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error("Proposal is no longer open for review");
  }
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

/**
 * Client-facing proposal history: every resolved/pending proposal addressed to
 * this client, newest first. Excludes 'draft' (the advisor's private working
 * copy is never client-visible). Drives the persistent /setup history surface.
 */
export async function listProposalsForClient(
  supabase: SupabaseClient,
  clientUserId: string,
  limit = 25
): Promise<AdvisorProposalRow[]> {
  const { data, error } = await supabase
    .from("advisor_proposals")
    .select("*")
    .eq("client_user_id", clientUserId)
    .neq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AdvisorProposalRow[];
}
