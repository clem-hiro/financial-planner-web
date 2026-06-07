-- Accept-path serialization + integrity hardening (P2-FIX-2, /unslop round).
--
--   C1 — the status transition must GATE the entity writes. A claim flips
--     pending->'accepting' under a row lock BEFORE any write; the writes run
--     (in TS, via the single C6 overlay mapper — never relocated to SQL) only
--     if the claim succeeded; a finalize flips 'accepting'->'accepted'. So a
--     withdraw either wins the lock first (claim RAISEs -> ZERO writes) or
--     loses (withdraw's own draft|pending guard no-ops vs 'accepting'). The
--     mutate-then-withdraw corruption window is closed, not narrowed.
--   C2 — 'accepting' IS the terminal non-acceptable state: if the TS writes
--     partially fail the proposal STAYS 'accepting' (never clean 'pending'),
--     so it cannot be silently re-accepted (claim requires 'pending') and
--     create-ops cannot duplicate on retry. One state closes C1 + C2; no
--     columns/indexes added to the canonical financial_* tables.
--   M3 — create_advisor_draft_proposal RAISEs if the post-unique_violation
--     re-select still finds nothing (never an all-NULL rowtype).
--   M4 — change_op='create' requires a non-null draft_entity_key (else a
--     create row escapes both partial unique indexes -> unbounded dup rows).
--
-- Forward-only, idempotent. Operator-applied in the Supabase SQL editor.

begin;

-- C1/C2 — 'accepting' claim/parked state. Inline column check from
-- 20260524000000 is named advisor_proposals_status_check.
alter table public.advisor_proposals
  drop constraint if exists advisor_proposals_status_check;
alter table public.advisor_proposals
  add constraint advisor_proposals_status_check
  check (status in ('draft', 'pending', 'accepting', 'accepted',
                    'rejected', 'withdrawn'));

-- M4 — a create row with no draft_entity_key matches neither partial unique
-- index (20260602000000) and would duplicate freely on retry.
alter table public.advisor_proposal_changes
  drop constraint if exists advisor_proposal_changes_create_needs_draft_key;
alter table public.advisor_proposal_changes
  add constraint advisor_proposal_changes_create_needs_draft_key
  check (change_op <> 'create' or draft_entity_key is not null);

-- M3 — never return an all-NULL public.advisor_proposals%rowtype.
create or replace function public.create_advisor_draft_proposal(p_client uuid)
returns public.advisor_proposals
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_advisor uuid := (select auth.uid());
  v_proposal public.advisor_proposals%rowtype;
begin
  if not exists (
    select 1 from public.financial_profiles fp
    where fp.id = p_client
      and fp.profile_type = 'client'
      and fp.advisor_user_id = v_advisor
  ) then
    raise exception 'Not a linked client of the calling advisor';
  end if;

  select * into v_proposal
  from public.advisor_proposals
  where advisor_user_id = v_advisor
    and client_user_id = p_client
    and status = 'draft'
  limit 1;

  if found then
    return v_proposal;
  end if;

  begin
    insert into public.advisor_proposals (advisor_user_id, client_user_id, status)
    values (v_advisor, p_client, 'draft')
    returning * into v_proposal;
  exception when unique_violation then
    select * into v_proposal
    from public.advisor_proposals
    where advisor_user_id = v_advisor
      and client_user_id = p_client
      and status = 'draft'
    limit 1;
    if not found then
      raise exception 'Draft proposal vanished during a concurrent create';
    end if;
  end;

  return v_proposal;
end;
$$;

revoke all on function public.create_advisor_draft_proposal(uuid) from public;
grant execute on function public.create_advisor_draft_proposal(uuid) to authenticated;

-- C1 (claim) — atomic, serialized pending->accepting. GATES the entity
-- writes: the handler runs writes only if THIS succeeds. Row-locked vs
-- withdraw_advisor_proposal; a withdraw that already won leaves status
-- 'withdrawn' and this RAISEs (zero writes).
create or replace function public.claim_advisor_proposal_for_accept(
  p_proposal_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_proposal public.advisor_proposals%rowtype;
  v_rows int;
begin
  select * into v_proposal
  from public.advisor_proposals
  where id = p_proposal_id
    and client_user_id = (select auth.uid())
  for update;

  if not found then
    raise exception 'Proposal not found';
  end if;
  if v_proposal.status <> 'pending' then
    raise exception 'Proposal is no longer open for review (status=%)',
      v_proposal.status;
  end if;

  update public.advisor_proposals
  set status = 'accepting', updated_at = now()
  where id = p_proposal_id and status = 'pending';

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'Proposal transitioned concurrently; accept aborted';
  end if;
end;
$$;

revoke all on function public.claim_advisor_proposal_for_accept(uuid) from public;
grant execute on function public.claim_advisor_proposal_for_accept(uuid) to authenticated;

comment on function public.claim_advisor_proposal_for_accept(uuid) is
  'C1 claim: serialized pending->accepting under a row lock. GATES entity writes (handler writes only on success). RAISEs on not-found/not-pending/0-row so a lost withdraw race produces ZERO writes.';

-- C1 (finalize) — accepting->accepted after the entity writes succeeded.
-- Fail-loud on 0-row so the handler never reports a false success.
create or replace function public.finalize_advisor_proposal_accept(
  p_proposal_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_proposal public.advisor_proposals%rowtype;
  v_rows int;
begin
  select * into v_proposal
  from public.advisor_proposals
  where id = p_proposal_id
    and client_user_id = (select auth.uid())
  for update;

  if not found then
    raise exception 'Proposal not found';
  end if;
  if v_proposal.status <> 'accepting' then
    raise exception 'Proposal not in accepting state (status=%)',
      v_proposal.status;
  end if;

  update public.advisor_proposals
  set status = 'accepted', resolved_at = now(), updated_at = now()
  where id = p_proposal_id and status = 'accepting';

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    raise exception 'Proposal transitioned concurrently; finalize aborted';
  end if;
end;
$$;

revoke all on function public.finalize_advisor_proposal_accept(uuid) from public;
grant execute on function public.finalize_advisor_proposal_accept(uuid) to authenticated;

comment on function public.finalize_advisor_proposal_accept(uuid) is
  'C1 finalize: accepting->accepted after entity writes. Fail-loud on miss. A proposal left in accepting (writes failed) is the C2 terminal non-acceptable state — not re-acceptable (claim requires pending).';

commit;
