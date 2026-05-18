-- Asset-first housing: properties as primary entity; mortgages remain on
-- financial_housing_loans with optional property_id link. Backfills legacy loans.

begin;

create table if not exists public.financial_properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.financial_profiles (id) on delete cascade,
  name text not null,
  property_type text not null default 'unknown'
    check (
      property_type in (
        'hdb',
        'condo',
        'ec',
        'landed',
        'overseas',
        'other',
        'unknown'
      )
    ),
  purchase_price numeric(14, 2)
    check (purchase_price is null or purchase_price > 0),
  current_valuation numeric(14, 2)
    check (current_valuation is null or current_valuation > 0),
  ownership_percent numeric(8, 6) not null default 1
    check (ownership_percent > 0 and ownership_percent <= 1),
  status text not null default 'living_in'
    check (
      status in (
        'living_in',
        'renting_out',
        'under_construction',
        'fully_paid'
      )
    ),
  rental_income_monthly numeric(14, 2) not null default 0
    check (rental_income_monthly >= 0),
  /** `current` = owned today; `future_simulation` reserved for Goals (no cashflow). */
  planning_scope text not null default 'current'
    check (planning_scope in ('current', 'future_simulation')),
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists financial_properties_user_id_idx
  on public.financial_properties (user_id);

comment on table public.financial_properties is
  'Owned or planned residential property (asset). Mortgages link via financial_housing_loans.property_id.';

alter table public.financial_housing_loans
  add column if not exists property_id uuid
    references public.financial_properties (id) on delete cascade;

create index if not exists financial_housing_loans_property_id_idx
  on public.financial_housing_loans (property_id)
  where property_id is not null;

-- Optional loan planning columns (from 20260516100000) — idempotent if that migration
-- was not applied yet on this database.
alter table public.financial_housing_loans
  add column if not exists property_purchase_price numeric(14, 2)
    check (property_purchase_price is null or property_purchase_price > 0);

alter table public.financial_housing_loans
  add column if not exists property_kind text
    check (
      property_kind is null
      or property_kind in ('hdb', 'condo', 'ec', 'landed')
    );

-- Backfill: one property per legacy loan without property_id (deterministic loop).
-- Reads optional columns via per-row SELECT so DBs missing property_kind still work.
do $$
declare
  r record;
  v_property_id uuid;
  v_rn integer;
  v_property_kind text;
  v_purchase_price numeric(14, 2);
  v_has_property_kind boolean;
  v_has_purchase_price boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'financial_housing_loans'
      and column_name = 'property_kind'
  ) into v_has_property_kind;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'financial_housing_loans'
      and column_name = 'property_purchase_price'
  ) into v_has_purchase_price;

  for r in
    select
      hl.id as loan_id,
      hl.user_id,
      hl.label,
      row_number() over (
        partition by hl.user_id
        order by hl.created_at asc
      )::integer as rn
    from public.financial_housing_loans hl
    where hl.property_id is null
    order by hl.user_id, hl.created_at asc
  loop
    v_rn := r.rn;
    v_property_kind := null;
    v_purchase_price := null;

    if v_has_property_kind then
      execute
        'select property_kind from public.financial_housing_loans where id = $1'
        into v_property_kind
        using r.loan_id;
    end if;

    if v_has_purchase_price then
      execute
        'select property_purchase_price from public.financial_housing_loans where id = $1'
        into v_purchase_price
        using r.loan_id;
    end if;

    insert into public.financial_properties (
      user_id,
      name,
      property_type,
      purchase_price,
      status,
      planning_scope,
      display_order
    )
    values (
      r.user_id,
      coalesce(nullif(trim(r.label), ''), 'Property ' || v_rn::text),
      coalesce(
        case
          when v_property_kind in ('hdb', 'condo', 'ec', 'landed') then v_property_kind
          else null
        end,
        'unknown'
      ),
      v_purchase_price,
      'living_in',
      'current',
      v_rn - 1
    )
    returning id into v_property_id;

    update public.financial_housing_loans
    set property_id = v_property_id
    where id = r.loan_id;
  end loop;
end $$;

alter table public.financial_properties enable row level security;

drop policy if exists "financial_properties_select_own" on public.financial_properties;
drop policy if exists "financial_properties_insert_own" on public.financial_properties;
drop policy if exists "financial_properties_update_own" on public.financial_properties;
drop policy if exists "financial_properties_delete_own" on public.financial_properties;

create policy "financial_properties_select_own"
  on public.financial_properties
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "financial_properties_insert_own"
  on public.financial_properties
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "financial_properties_update_own"
  on public.financial_properties
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "financial_properties_delete_own"
  on public.financial_properties
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Consent-gated advisor read (mirrors listProperties order).
create or replace function public.advisor_read_properties(p_client uuid)
returns setof public.financial_properties
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
begin
  if not public.advisor_can_read_client(p_client) then
    return;
  end if;
  return query
    select *
    from public.financial_properties
    where user_id = p_client
    order by display_order asc, created_at asc;
end;
$$;

revoke all on function public.advisor_read_properties(uuid) from public;
grant execute on function public.advisor_read_properties(uuid) to authenticated;

commit;
