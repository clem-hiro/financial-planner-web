-- Advisor proposal creation hardening (P1 — unblock the live RLS outage).
--
--   * RLS INSERT-policy regression fix. advisor_proposals_insert_advisor's
--     WITH CHECK embedded an inline `exists (... financial_profiles ...)`
--     linkage subquery, RLS-evaluated as the advisor. Consent-Phase-2 dropped
--     financial_profiles_select_advisor_clients (20260529000000:657), the
--     advisor's only direct read on financial_profiles, so that subquery now
--     returns 0 rows -> WITH CHECK false -> every advisor INSERT fails. Replace
--     with a self-only check and move the linkage assertion into a SECURITY
--     DEFINER RPC (the ratified PR #11 / consent-gate pattern: advisor->client
--     cross-reads route through definer fns, never an inline cross-user RLS
--     subquery).
--   * Relax advisor_proposals_one_open_per_pair_idx to draft-only so an advisor
--     can hold unlimited concurrent pending proposals while still being capped
--     at one working draft per client.
--
-- Forward-only, idempotent. Operator-applied in the Supabase SQL editor.

begin;

drop policy if exists "advisor_proposals_insert_advisor" on public.advisor_proposals;

create policy "advisor_proposals_insert_advisor"
  on public.advisor_proposals
  for insert
  to authenticated
  with check (advisor_user_id = (select auth.uid()));

-- <=1 draft per pair (the working copy); unlimited pending allowed.
drop index if exists public.advisor_proposals_one_open_per_pair_idx;
create unique index if not exists advisor_proposals_one_open_per_pair_idx
  on public.advisor_proposals (advisor_user_id, client_user_id)
  where status = 'draft';

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

  -- Idempotent under a concurrent caller: the draft-only unique index turns a
  -- double-create into unique_violation; re-read and return the winner.
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
  end;

  return v_proposal;
end;
$$;

revoke all on function public.create_advisor_draft_proposal(uuid) from public;
grant execute on function public.create_advisor_draft_proposal(uuid) to authenticated;

comment on function public.create_advisor_draft_proposal(uuid) is
  'Advisor creates (or idempotently returns) the single working draft proposal for a linked client. Linkage asserted here (definer) since consent-Phase-2 removed the advisor''s direct financial_profiles read.';

commit;
