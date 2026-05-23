-- Advisor proposal withdraw (P3).
--
-- An advisor retracts an open (draft|pending) proposal. SECURITY DEFINER so it
-- can delete the client's inbox CTA row — the advisor has no RLS write on the
-- client's financial_inbox_notifications. `for update` row-locks the proposal
-- and the status guard makes it idempotent and race-safe against a concurrent
-- client accept (whichever commits the status transition first wins; the other
-- sees a non-open status and no-ops). Withdrawn is a terminal state, not a
-- delete — the proposal stays viewable by the advisor<->client pair (B7).
--
-- Forward-only, idempotent. Operator-applied in the Supabase SQL editor.

begin;

create or replace function public.withdraw_advisor_proposal(p_proposal_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_proposal public.advisor_proposals%rowtype;
begin
  select * into v_proposal
  from public.advisor_proposals
  where id = p_proposal_id
    and advisor_user_id = (select auth.uid())
  for update;

  if not found then
    raise exception 'Proposal not found';
  end if;

  -- Already resolved (accepted/rejected/withdrawn) -> idempotent no-op.
  if v_proposal.status not in ('draft', 'pending') then
    return;
  end if;

  update public.advisor_proposals
  set status = 'withdrawn',
      resolved_at = now(),
      updated_at = now()
  where id = p_proposal_id;

  delete from public.financial_inbox_notifications
  where user_id = v_proposal.client_user_id
    and dedupe_key = 'advisor_proposal:' || p_proposal_id::text;
end;
$$;

revoke all on function public.withdraw_advisor_proposal(uuid) from public;
grant execute on function public.withdraw_advisor_proposal(uuid) to authenticated;

comment on function public.withdraw_advisor_proposal(uuid) is
  'Advisor withdraws an open (draft|pending) proposal: status->withdrawn, resolved_at set, client inbox CTA deleted. Idempotent no-op once resolved; row-locked against a concurrent client accept.';

-- B8 — re-baseline alert. When a client accept hits an optimistic-concurrency
-- conflict the proposal stays pending; without this the advisor never learns
-- it stalled. The client cannot insert an advisor-owned inbox row
-- (financial_inbox_notifications_insert_own restricts user_id to auth.uid()),
-- so the notify path is SECURITY DEFINER. Caller is verified to be the
-- proposal's CLIENT and the proposal still pending, so a client can only ever
-- nudge their own advisor about their own stalled proposal.
create or replace function public.notify_advisor_proposal_conflict(p_proposal_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_proposal public.advisor_proposals%rowtype;
begin
  select * into v_proposal
  from public.advisor_proposals
  where id = p_proposal_id
    and client_user_id = (select auth.uid())
    and status = 'pending';

  if not found then
    raise exception 'Proposal not found or not open for review';
  end if;

  insert into public.financial_inbox_notifications (
    user_id, kind, title, body, cta_label, cta_href, dedupe_key
  )
  values (
    v_proposal.advisor_user_id,
    'advisor_proposal_conflict',
    'A client''s plan changed — refresh your proposal',
    'The client''s data moved since you prepared this proposal. Re-baseline it and resubmit.',
    'Review proposal',
    '/advisor/client/' || v_proposal.client_user_id::text
      || '?view=proposals&p=' || p_proposal_id::text,
    'advisor_proposal_conflict:' || p_proposal_id::text
  )
  on conflict (user_id, dedupe_key) do update
  set title = excluded.title,
      body = excluded.body,
      cta_label = excluded.cta_label,
      cta_href = excluded.cta_href,
      read_at = null,
      updated_at = now();
end;
$$;

revoke all on function public.notify_advisor_proposal_conflict(uuid) from public;
grant execute on function public.notify_advisor_proposal_conflict(uuid) to authenticated;

comment on function public.notify_advisor_proposal_conflict(uuid) is
  'Client-callable (definer): on an accept-conflict, upserts a re-baseline inbox notification for the proposal''s advisor. Caller must be the proposal''s client and the proposal still pending.';

commit;
