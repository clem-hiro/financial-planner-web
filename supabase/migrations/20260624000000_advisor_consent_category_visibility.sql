-- Per-category advisor visibility (client-controlled, DEFAULT PRIVATE).
--
-- Adds a client-owned bridge table + a SECURITY DEFINER gate
-- (advisor_can_read_category) layered ON TOP of advisor_can_read_client, then
-- redefines the 5 sensitive advisor-read RPCs (cash accounts, liabilities,
-- properties, housing loans, vehicles) to gate on the per-category predicate
-- instead of the bare master-consent predicate.
--
-- Default-deny is the whole point: no row ⇒ coalesce(..., false) ⇒ the advisor
-- sees ZERO rows for that category until the client opts in. The master consent
-- gate (advisor_can_read_client) is unchanged and still required — category
-- visibility is strictly additive (AND), never a widening.
--
-- The 4 always-visible categories (profile, goals, budget, investments) are NOT
-- gated here; their advisor_read_* RPCs keep the bare advisor_can_read_client
-- gate from 20260529000000_advisor_consent_phase2.sql.
--
-- Forward-only. Operator-applied with an owner/superuser-capable role.

begin;

-- ---------------------------------------------------------------------------
-- Bridge table — the CLIENT owns these rows. One row per
-- (client, advisor, category); absence of a row means private (default-deny).
-- The unique constraint doubles as the lookup index for the gate RPC.
-- ---------------------------------------------------------------------------
create table public.advisor_consent_category_visibility (
  id uuid primary key default gen_random_uuid(),
  client_user_id uuid not null
    references public.financial_profiles(id) on delete cascade,
  advisor_user_id uuid not null
    references auth.users(id) on delete cascade,
  visibility_category text not null
    check (visibility_category in (
      'cash_accounts', 'liabilities', 'properties', 'housing_loans', 'vehicles'
    )),
  is_visible boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_user_id, advisor_user_id, visibility_category)
);

alter table public.advisor_consent_category_visibility enable row level security;

-- Client-only ownership: the client may read + write their own visibility rows.
-- The advisor never reads this table directly — the SECURITY DEFINER gate RPC
-- below reads it as the function owner, so no advisor-facing policy exists.
create policy "advisor_consent_category_visibility_select_own"
  on public.advisor_consent_category_visibility for select
  to authenticated
  using (client_user_id = (select auth.uid()));

create policy "advisor_consent_category_visibility_insert_own"
  on public.advisor_consent_category_visibility for insert
  to authenticated
  with check (client_user_id = (select auth.uid()));

create policy "advisor_consent_category_visibility_update_own"
  on public.advisor_consent_category_visibility for update
  to authenticated
  using (client_user_id = (select auth.uid()))
  with check (client_user_id = (select auth.uid()));

create policy "advisor_consent_category_visibility_delete_own"
  on public.advisor_consent_category_visibility for delete
  to authenticated
  using (client_user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Per-category gate — master consent AND the client's per-category opt-in.
-- search_path = '' so every relation/function is fully schema-qualified; the
-- coalesce(..., false) makes a missing row read as private (default-deny).
-- ---------------------------------------------------------------------------
create or replace function public.advisor_can_read_category(
  p_client uuid,
  p_category text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.advisor_can_read_client(p_client)
    and coalesce(
      (
        select v.is_visible
        from public.advisor_consent_category_visibility v
        where v.client_user_id = p_client
          and v.advisor_user_id = (select auth.uid())
          and v.visibility_category = p_category
      ),
      false
    );
$$;

revoke all on function public.advisor_can_read_category(uuid, text) from public;
grant execute on function public.advisor_can_read_category(uuid, text) to authenticated;

-- ===========================================================================
-- Redefine the 5 sensitive advisor-read RPCs. Bodies are reproduced EXACTLY
-- from 20260529000000_advisor_consent_phase2.sql (properties from
-- 20260519120000_financial_properties_asset_first.sql) — the ONLY change per
-- function is the gate line: advisor_can_read_client(p_client) becomes
-- advisor_can_read_category(p_client, '<category>').
-- ===========================================================================

-- financial_cash_accounts — order mirrors listCashAccounts (created_at asc).
create or replace function public.advisor_read_cash_accounts(p_client uuid)
returns setof public.financial_cash_accounts
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
begin
  if not public.advisor_can_read_category(p_client, 'cash_accounts') then
    return;
  end if;
  return query
    select *
    from public.financial_cash_accounts
    where user_id = p_client
    order by created_at asc;
end;
$$;

revoke all on function public.advisor_read_cash_accounts(uuid) from public;
grant execute on function public.advisor_read_cash_accounts(uuid) to authenticated;

-- financial_liabilities — order mirrors listLiabilities (created_at asc).
create or replace function public.advisor_read_liabilities(p_client uuid)
returns setof public.financial_liabilities
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
begin
  if not public.advisor_can_read_category(p_client, 'liabilities') then
    return;
  end if;
  return query
    select *
    from public.financial_liabilities
    where user_id = p_client
    order by created_at asc;
end;
$$;

revoke all on function public.advisor_read_liabilities(uuid) from public;
grant execute on function public.advisor_read_liabilities(uuid) to authenticated;

-- financial_properties — order mirrors listProperties (display_order, created_at).
create or replace function public.advisor_read_properties(p_client uuid)
returns setof public.financial_properties
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
begin
  if not public.advisor_can_read_category(p_client, 'properties') then
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

-- financial_housing_loans — order mirrors listHousingLoans (created_at asc).
create or replace function public.advisor_read_housing_loans(p_client uuid)
returns setof public.financial_housing_loans
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
begin
  if not public.advisor_can_read_category(p_client, 'housing_loans') then
    return;
  end if;
  return query
    select *
    from public.financial_housing_loans
    where user_id = p_client
    order by created_at asc;
end;
$$;

revoke all on function public.advisor_read_housing_loans(uuid) from public;
grant execute on function public.advisor_read_housing_loans(uuid) to authenticated;

-- financial_vehicles — order mirrors listVehicles (display_order, created_at).
create or replace function public.advisor_read_vehicles(p_client uuid)
returns setof public.financial_vehicles
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
begin
  if not public.advisor_can_read_category(p_client, 'vehicles') then
    return;
  end if;
  return query
    select *
    from public.financial_vehicles
    where user_id = p_client
    order by display_order asc, created_at asc;
end;
$$;

revoke all on function public.advisor_read_vehicles(uuid) from public;
grant execute on function public.advisor_read_vehicles(uuid) to authenticated;

commit;
