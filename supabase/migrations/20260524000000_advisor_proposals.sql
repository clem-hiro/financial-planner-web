-- Advisor proposal layer: field-level suggested changes reviewed by clients before
-- applying to canonical tracker data. One open draft/pending proposal per advisor–client pair.

begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- advisor_proposals
-- ---------------------------------------------------------------------------
create table if not exists public.advisor_proposals (
  id uuid primary key default gen_random_uuid(),
  advisor_user_id uuid not null references auth.users (id) on delete cascade,
  client_user_id uuid not null references public.financial_profiles (id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft', 'pending', 'accepted', 'rejected', 'withdrawn')),
  advisor_note text,
  submitted_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.advisor_proposals is
  'Advisor-suggested plan edits awaiting client review. Canonical tracker updates only on accept.';

create unique index if not exists advisor_proposals_one_open_per_pair_idx
  on public.advisor_proposals (advisor_user_id, client_user_id)
  where status in ('draft', 'pending');

create index if not exists advisor_proposals_client_status_idx
  on public.advisor_proposals (client_user_id, status, created_at desc);

create index if not exists advisor_proposals_advisor_status_idx
  on public.advisor_proposals (advisor_user_id, status, updated_at desc);

-- ---------------------------------------------------------------------------
-- advisor_proposal_changes (field-level before/after)
-- ---------------------------------------------------------------------------
create table if not exists public.advisor_proposal_changes (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.advisor_proposals (id) on delete cascade,
  section text not null,
  entity_type text not null
    check (entity_type in ('profile', 'budget_line', 'goal', 'investment')),
  entity_id uuid,
  field_key text not null,
  field_label text not null,
  old_value text,
  new_value text,
  explanation text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint advisor_proposal_changes_unique_field
    unique (proposal_id, entity_type, entity_id, field_key)
);

create index if not exists advisor_proposal_changes_proposal_idx
  on public.advisor_proposal_changes (proposal_id, section, sort_order);

-- ---------------------------------------------------------------------------
-- advisor_proposal_section_notes (educational context per section)
-- ---------------------------------------------------------------------------
create table if not exists public.advisor_proposal_section_notes (
  proposal_id uuid not null references public.advisor_proposals (id) on delete cascade,
  section text not null,
  note text not null,
  primary key (proposal_id, section)
);

-- ---------------------------------------------------------------------------
-- RLS: advisor_proposals
-- ---------------------------------------------------------------------------
alter table public.advisor_proposals enable row level security;

drop policy if exists "advisor_proposals_select_advisor" on public.advisor_proposals;
drop policy if exists "advisor_proposals_select_client" on public.advisor_proposals;
drop policy if exists "advisor_proposals_insert_advisor" on public.advisor_proposals;
drop policy if exists "advisor_proposals_update_advisor" on public.advisor_proposals;
drop policy if exists "advisor_proposals_update_client" on public.advisor_proposals;
drop policy if exists "advisor_proposals_delete_advisor" on public.advisor_proposals;

create policy "advisor_proposals_select_advisor"
  on public.advisor_proposals
  for select
  to authenticated
  using (advisor_user_id = (select auth.uid()));

create policy "advisor_proposals_select_client"
  on public.advisor_proposals
  for select
  to authenticated
  using (client_user_id = (select auth.uid()));

create policy "advisor_proposals_insert_advisor"
  on public.advisor_proposals
  for insert
  to authenticated
  with check (
    advisor_user_id = (select auth.uid())
    and exists (
      select 1 from public.financial_profiles fp
      where fp.id = client_user_id
        and fp.profile_type = 'client'
        and fp.advisor_user_id = (select auth.uid())
    )
  );

create policy "advisor_proposals_update_advisor"
  on public.advisor_proposals
  for update
  to authenticated
  using (
    advisor_user_id = (select auth.uid())
    and status in ('draft', 'pending')
  )
  with check (
    advisor_user_id = (select auth.uid())
    and status in ('draft', 'pending', 'withdrawn')
  );

create policy "advisor_proposals_update_client"
  on public.advisor_proposals
  for update
  to authenticated
  using (
    client_user_id = (select auth.uid())
    and status = 'pending'
  )
  with check (
    client_user_id = (select auth.uid())
    and status in ('accepted', 'rejected')
  );

create policy "advisor_proposals_delete_advisor"
  on public.advisor_proposals
  for delete
  to authenticated
  using (
    advisor_user_id = (select auth.uid())
    and status = 'draft'
  );

-- ---------------------------------------------------------------------------
-- RLS: advisor_proposal_changes
-- ---------------------------------------------------------------------------
alter table public.advisor_proposal_changes enable row level security;

drop policy if exists "advisor_proposal_changes_select" on public.advisor_proposal_changes;
drop policy if exists "advisor_proposal_changes_insert" on public.advisor_proposal_changes;
drop policy if exists "advisor_proposal_changes_update" on public.advisor_proposal_changes;
drop policy if exists "advisor_proposal_changes_delete" on public.advisor_proposal_changes;

create policy "advisor_proposal_changes_select"
  on public.advisor_proposal_changes
  for select
  to authenticated
  using (
    exists (
      select 1 from public.advisor_proposals p
      where p.id = proposal_id
        and (
          p.advisor_user_id = (select auth.uid())
          or p.client_user_id = (select auth.uid())
        )
    )
  );

create policy "advisor_proposal_changes_insert"
  on public.advisor_proposal_changes
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.advisor_proposals p
      where p.id = proposal_id
        and p.advisor_user_id = (select auth.uid())
        and p.status = 'draft'
    )
  );

create policy "advisor_proposal_changes_update"
  on public.advisor_proposal_changes
  for update
  to authenticated
  using (
    exists (
      select 1 from public.advisor_proposals p
      where p.id = proposal_id
        and p.advisor_user_id = (select auth.uid())
        and p.status = 'draft'
    )
  )
  with check (
    exists (
      select 1 from public.advisor_proposals p
      where p.id = proposal_id
        and p.advisor_user_id = (select auth.uid())
        and p.status = 'draft'
    )
  );

create policy "advisor_proposal_changes_delete"
  on public.advisor_proposal_changes
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.advisor_proposals p
      where p.id = proposal_id
        and p.advisor_user_id = (select auth.uid())
        and p.status = 'draft'
    )
  );

-- ---------------------------------------------------------------------------
-- RLS: advisor_proposal_section_notes
-- ---------------------------------------------------------------------------
alter table public.advisor_proposal_section_notes enable row level security;

drop policy if exists "advisor_proposal_section_notes_select" on public.advisor_proposal_section_notes;
drop policy if exists "advisor_proposal_section_notes_insert" on public.advisor_proposal_section_notes;
drop policy if exists "advisor_proposal_section_notes_update" on public.advisor_proposal_section_notes;
drop policy if exists "advisor_proposal_section_notes_delete" on public.advisor_proposal_section_notes;

create policy "advisor_proposal_section_notes_select"
  on public.advisor_proposal_section_notes
  for select
  to authenticated
  using (
    exists (
      select 1 from public.advisor_proposals p
      where p.id = proposal_id
        and (
          p.advisor_user_id = (select auth.uid())
          or p.client_user_id = (select auth.uid())
        )
    )
  );

create policy "advisor_proposal_section_notes_insert"
  on public.advisor_proposal_section_notes
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.advisor_proposals p
      where p.id = proposal_id
        and p.advisor_user_id = (select auth.uid())
        and p.status = 'draft'
    )
  );

create policy "advisor_proposal_section_notes_update"
  on public.advisor_proposal_section_notes
  for update
  to authenticated
  using (
    exists (
      select 1 from public.advisor_proposals p
      where p.id = proposal_id
        and p.advisor_user_id = (select auth.uid())
        and p.status = 'draft'
    )
  )
  with check (
    exists (
      select 1 from public.advisor_proposals p
      where p.id = proposal_id
        and p.advisor_user_id = (select auth.uid())
        and p.status = 'draft'
    )
  );

create policy "advisor_proposal_section_notes_delete"
  on public.advisor_proposal_section_notes
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.advisor_proposals p
      where p.id = proposal_id
        and p.advisor_user_id = (select auth.uid())
        and p.status = 'draft'
    )
  );

-- ---------------------------------------------------------------------------
-- Submit proposal + client inbox notification (SECURITY DEFINER)
-- ---------------------------------------------------------------------------
create or replace function public.submit_advisor_proposal(
  p_proposal_id uuid,
  p_advisor_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_proposal public.advisor_proposals%rowtype;
  v_advisor_name text;
  v_section_labels text;
  v_change_count int;
begin
  select * into v_proposal
  from public.advisor_proposals
  where id = p_proposal_id
    and advisor_user_id = auth.uid()
    and status = 'draft'
  for update;

  if not found then
    raise exception 'Proposal not found or not editable';
  end if;

  select count(*) into v_change_count
  from public.advisor_proposal_changes
  where proposal_id = p_proposal_id;

  if v_change_count = 0 then
    raise exception 'Add at least one suggested change before submitting';
  end if;

  update public.advisor_proposals
  set
    status = 'pending',
    advisor_note = nullif(trim(p_advisor_note), ''),
    submitted_at = now(),
    updated_at = now()
  where id = p_proposal_id;

  select coalesce(fp.display_name, 'Your advisor')
  into v_advisor_name
  from public.financial_profiles fp
  where fp.id = v_proposal.advisor_user_id;

  select string_agg(distinct sn.section_label, E'\n')
  into v_section_labels
  from (
    select case c.section
      when 'profile_assumptions' then 'Profile & assumptions'
      when 'retirement_planning' then 'Retirement planning'
      when 'cash_flow' then 'Cash flow'
      when 'goals' then 'Goals & priorities'
      when 'investments' then 'Investments'
      when 'insurance' then 'Insurance'
      when 'cpf_planning' then 'CPF planning'
      when 'dependents' then 'Dependents'
      else initcap(replace(c.section, '_', ' '))
    end as section_label
    from public.advisor_proposal_changes c
    where c.proposal_id = p_proposal_id
    order by c.section
    limit 6
  ) sn;

  insert into public.financial_inbox_notifications (
    user_id,
    kind,
    title,
    body,
    cta_label,
    cta_href,
    dedupe_key
  )
  values (
    v_proposal.client_user_id,
    'advisor_proposal',
    'Your advisor submitted updates to your financial plan',
    coalesce(v_section_labels, 'Review the suggested changes'),
    'Review changes',
    '/review/proposal/' || p_proposal_id::text,
    'advisor_proposal:' || p_proposal_id::text
  )
  on conflict (user_id, dedupe_key) do update
  set
    title = excluded.title,
    body = excluded.body,
    cta_label = excluded.cta_label,
    cta_href = excluded.cta_href,
    read_at = null,
    updated_at = now();
end;
$$;

revoke all on function public.submit_advisor_proposal(uuid, text) from public;
grant execute on function public.submit_advisor_proposal(uuid, text) to authenticated;

comment on function public.submit_advisor_proposal is
  'Advisor submits draft proposal; moves to pending and upserts client inbox notification.';

commit;
