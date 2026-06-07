-- ROLLBACK for 20260624000000_advisor_consent_category_visibility.sql
--
-- Sidecar — NOT a numbered forward migration; never auto-runs via `db push`.
-- Operator-applied manually with an owner/superuser-capable role.
--
-- Order is load-bearing:
--   1. Restore the 5 read RPCs to their ORIGINAL bare advisor_can_read_client
--      gate (so nothing references advisor_can_read_category anymore).
--   2. Drop advisor_can_read_category.
--   3. Drop the bridge table (its 4 RLS policies drop with it).
--
-- RPC bodies below are reproduced verbatim from source:
--   cash_accounts/liabilities/housing_loans/vehicles — 20260529000000_advisor_consent_phase2.sql
--   properties — 20260519120000_financial_properties_asset_first.sql

begin;

-- ===========================================================================
-- 1. Restore the 5 read RPCs to their original definitions (bare master gate).
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
  if not public.advisor_can_read_client(p_client) then
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
  if not public.advisor_can_read_client(p_client) then
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

-- financial_housing_loans — order mirrors listHousingLoans (created_at asc).
create or replace function public.advisor_read_housing_loans(p_client uuid)
returns setof public.financial_housing_loans
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
  if not public.advisor_can_read_client(p_client) then
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

-- ===========================================================================
-- 2. Drop the per-category gate (now unreferenced).
-- ===========================================================================
drop function if exists public.advisor_can_read_category(uuid, text);

-- ===========================================================================
-- 3. Drop the bridge table (its 4 RLS policies drop with it).
-- ===========================================================================
drop table if exists public.advisor_consent_category_visibility;

commit;
