-- Consent-Gated Client-Data Access — Phase 2 (all 10 remaining advisor-read
-- surfaces + roster RPC conversion + the C1 monotonic-ordering fix).
--
-- Completes Pillar 2: every advisor->client read now routes through a
-- SECURITY DEFINER advisor_read_* function embedding advisor_can_read_client();
-- ZERO advisor cross-user RLS policy remains on any financial_* table. After
-- this migration `select public.verify_consent_gated_access()` returns 'OK'.
--
-- Template = advisor_read_investments (20260528000000:336-356). Deny-shaped
-- early return: not consented => zero rows (fail-closed), never an error.
-- `returns setof public.<table>` keeps the row shape byte-identical to the
-- repository `select *`, so the shared overlay mapper composes unchanged (C6).
--
-- Forward-only. Operator-applied in the Supabase SQL editor with an
-- owner/superuser-capable role. Do NOT run against any DB from app code.

begin;

-- ===========================================================================
-- C1 — monotonic tie-break. `seq` is a strictly-increasing identity column;
-- a same-tick grant+withdraw now resolves by insert order, not by a random
-- gen_random_uuid() coin flip (LEARNINGS:5 anti-pattern). Pre-existing rows
-- (none in prod — consent has no write producer until Phase 2's UX ships) are
-- backfilled in heap order; immaterial because `created_at desc` is primary
-- and only ties fall through to `seq`.
-- ===========================================================================
alter table public.advisor_client_consents
  add column if not exists seq bigint generated always as identity;

-- security definer (Phase-2 flip): Phase 1 ran this `security invoker` and
-- relied on `financial_profiles_select_advisor_clients` to let a direct
-- advisor call see the linkage row. Phase 2 drops that policy, so a direct
-- caller (the consent-first gate in the actions + the advisor page) would
-- otherwise have the linkage `exists(...)` RLS-denied and the predicate would
-- deny EVERY client, even consented ones. Definer makes the linkage lookup
-- RLS-independent in all call contexts (it already ran definer inside the
-- advisor_read_* bodies). Safe: returns only a boolean, fully scoped to
-- `(select auth.uid())` — true only when the *caller* is the linked+consented
-- advisor; same trust profile as the advisor_read_* fns that call it.
--
-- Predicate rewrite: tie-break is `seq desc`, BYTE-IDENTICAL to the TS reducer
-- computeConsentStatuses (src/data/repositories/advisor-clients.ts:
-- `Number(r.seq) > Number(prev.seq)`). Both keep the row with the greatest
-- created_at, then the greatest seq. This pair is the C1 invariant — never
-- let them drift (INVARIANTS.md / build-sequence). Body/predicate UNCHANGED by
-- the definer flip; search_path kept exactly as shipped (`public, pg_catalog`).
create or replace function public.advisor_can_read_client(p_client uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select
    exists (
      select 1 from public.financial_profiles fp
      where fp.id = p_client
        and fp.profile_type = 'client'
        and fp.advisor_user_id = (select auth.uid())
    )
    and coalesce(
      (
        select c.status = 'granted'
        from public.advisor_client_consents c
        where c.client_user_id = p_client
          and c.advisor_user_id = (select auth.uid())
        order by c.created_at desc, c.seq desc
        limit 1
      ),
      false
    );
$$;

revoke all on function public.advisor_can_read_client(uuid) from public;
grant execute on function public.advisor_can_read_client(uuid) to authenticated;

-- ===========================================================================
-- Pillar 2 — 10 consent-gated advisor read surfaces.
-- Each `order by` mirrors the corresponding self repository list fn exactly
-- (advisor view == self view ordering; required for C6 overlay determinism).
-- Month/period-scoped reads (expenses, budget_line_month_overrides) return ALL
-- the client's rows here, exactly like the Phase-1 advisor_read_investments
-- contract; the app applies its window/period filter (Step 5), unchanged from
-- how the self path windows after the row read.
-- ===========================================================================

-- financial_expenses — order mirrors listExpensesForMonth (spent_at desc).
-- p_year_month NULL ⇒ all rows (Phase-1 contract). Non-null ⇒ the calendar
-- month containing it, matching listExpensesForMonth's [first, lastDay] window
-- (a typed bound param in a static predicate — no dynamic SQL). order by
-- mirrors the self path (spent_at desc).
create or replace function public.advisor_read_expenses(
  p_client uuid,
  p_year_month date default null
)
returns setof public.financial_expenses
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
    from public.financial_expenses
    where user_id = p_client
      and (
        p_year_month is null
        or (
          spent_at >= date_trunc('month', p_year_month)::date
          and spent_at < (date_trunc('month', p_year_month)
                          + interval '1 month')::date
        )
      )
    order by spent_at desc;
end;
$$;

revoke all on function public.advisor_read_expenses(uuid, date) from public;
grant execute on function public.advisor_read_expenses(uuid, date) to authenticated;

-- financial_goals — order mirrors listFinancialGoals (created_at asc).
create or replace function public.advisor_read_goals(p_client uuid)
returns setof public.financial_goals
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
    from public.financial_goals
    where user_id = p_client
    order by created_at asc;
end;
$$;

revoke all on function public.advisor_read_goals(uuid) from public;
grant execute on function public.advisor_read_goals(uuid) to authenticated;

-- financial_budget_lines — order mirrors listBudgetLines (cadence, category).
create or replace function public.advisor_read_budget_lines(p_client uuid)
returns setof public.financial_budget_lines
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
    from public.financial_budget_lines
    where user_id = p_client
    order by cadence asc, category asc;
end;
$$;

revoke all on function public.advisor_read_budget_lines(uuid) from public;
grant execute on function public.advisor_read_budget_lines(uuid) to authenticated;

-- financial_budget_line_month_overrides — listBudgetLineOverridesForMonth has
-- no order (consumer overridesToLineIdMap is a map keyed by budget_line_id, so
-- order is immaterial); no `order by` keeps it byte-identical to the self path.
-- p_year_month NULL ⇒ all rows (Phase-1 contract). Non-null ⇒ the matching
-- `year_month` (text 'YYYY-MM'), matching listBudgetLineOverridesForMonth's
-- exact-month filter (typed bound param via to_char in a static predicate —
-- no dynamic SQL). Self path is unordered (map-keyed consumer) — kept.
create or replace function public.advisor_read_budget_line_month_overrides(
  p_client uuid,
  p_year_month date default null
)
returns setof public.financial_budget_line_month_overrides
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
    from public.financial_budget_line_month_overrides
    where user_id = p_client
      and (
        p_year_month is null
        or year_month = to_char(p_year_month, 'YYYY-MM')
      );
end;
$$;

revoke all on function public.advisor_read_budget_line_month_overrides(uuid, date) from public;
grant execute on function public.advisor_read_budget_line_month_overrides(uuid, date) to authenticated;

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

-- financial_cpf_balances — getCpfBalanceByUserId is .maybeSingle()
-- (unique user_id): at most one row, no order (income-tax-config variant).
create or replace function public.advisor_read_cpf_balances(p_client uuid)
returns setof public.financial_cpf_balances
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
    from public.financial_cpf_balances
    where user_id = p_client;
end;
$$;

revoke all on function public.advisor_read_cpf_balances(uuid) from public;
grant execute on function public.advisor_read_cpf_balances(uuid) to authenticated;

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

-- financial_profiles (LAST) — keyed by `id` (= the client's user id), not
-- user_id; single row. getProfileById/getCachedProfileById equivalent.
-- advisor_can_read_client itself reads financial_profiles for linkage; this
-- body runs as the function owner so the self-only profiles policy does not
-- block that lookup (same rationale as Phase-1's advisor_read_investments).
create or replace function public.advisor_read_profile(p_client uuid)
returns setof public.financial_profiles
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
    from public.financial_profiles
    where id = p_client;
end;
$$;

revoke all on function public.advisor_read_profile(uuid) from public;
grant execute on function public.advisor_read_profile(uuid) to authenticated;

-- Linkage-only, CONSENT-INDEPENDENT (deliberately NOT gated by
-- advisor_can_read_client). The consent-first UX requires a linked-but-NOT-
-- consented client to render the "consent required" gated workspace, NOT a
-- 404 — so the page/action linkage gate (getClientProfileForAdvisor) and
-- requireAdvisorLinkedClient resolve identity here, while the consent-gated
-- profile DATA goes through advisor_read_profile. Definer so it survives the
-- financial_profiles advisor-policy drops; scoped to (select auth.uid()) so an
-- advisor only ever sees their own linked clients' identity.
create or replace function public.advisor_linked_client(p_client uuid)
returns setof public.financial_profiles
language sql
stable
security definer
set search_path = public, extensions
as $$
  select *
  from public.financial_profiles
  where id = p_client
    and profile_type = 'client'
    and advisor_user_id = (select auth.uid());
$$;

revoke all on function public.advisor_linked_client(uuid) from public;
grant execute on function public.advisor_linked_client(uuid) to authenticated;

-- ===========================================================================
-- P2-D2 — roster RPC conversion. The legacy fns were `security invoker` and
-- depended on the financial_profiles + financial_expenses advisor RLS policies
-- dropped below; without conversion they would return 0 rows post-drop.
-- Converted to `security definer` + per-row advisor_can_read_client():
--   - linkage filter unchanged -> roster still scoped to THIS advisor's
--     linked clients (auth.uid() reads the JWT, definer rights notwithstanding)
--   - identity columns always visible (id, display_name, profile_type,
--     onboarding_*, created_at)
--   - financial columns NULL/0 for NON-consented clients (identity-only)
-- The consent predicate is evaluated ONCE per row via a lateral (it runs two
-- subqueries; calling it per financial column would be 6x the work).
-- ===========================================================================
create or replace function public.advisor_client_list_metrics(
  p_limit int default 50,
  p_offset int default 0,
  p_search text default null,
  p_sort text default 'created_desc'
)
returns table (
  id uuid,
  display_name text,
  profile_type text,
  onboarding_required boolean,
  onboarding_completed_at timestamptz,
  created_at timestamptz,
  monthly_income numeric,
  savings_target_monthly numeric,
  fixed_expenses_monthly numeric,
  monthly_gross_salary numeric,
  last_expense_spent_at date,
  expense_count bigint,
  total_count bigint
)
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select
    fp.id,
    fp.display_name,
    fp.profile_type::text,
    fp.onboarding_required,
    fp.onboarding_completed_at,
    fp.created_at,
    case when cr.can then fp.monthly_income end,
    case when cr.can then fp.savings_target_monthly end,
    case when cr.can then fp.fixed_expenses_monthly end,
    case when cr.can then fp.monthly_gross_salary end,
    case when cr.can then agg.last_spent_at end,
    case when cr.can then coalesce(agg.cnt, 0)::bigint else 0::bigint end,
    count(*) over ()::bigint
  from public.financial_profiles fp
  left join lateral (
    select public.advisor_can_read_client(fp.id) as can
  ) cr on true
  left join lateral (
    select
      max(e.spent_at)::date as last_spent_at,
      count(*)::bigint as cnt
    from public.financial_expenses e
    where e.user_id = fp.id
  ) agg on true
  where fp.profile_type = 'client'
    and fp.advisor_user_id = (select auth.uid())
    and (
      p_search is null
      or length(trim(p_search)) < 1
      or fp.display_name ilike '%' || trim(p_search) || '%'
    )
  order by
    case
      when coalesce(nullif(trim(p_sort), ''), 'created_desc') = 'name_asc'
      then lower(coalesce(fp.display_name, ''))
    end asc,
    case
      when coalesce(nullif(trim(p_sort), ''), 'created_desc') = 'last_active_desc'
      then agg.last_spent_at
    end desc nulls last,
    case
      when coalesce(nullif(trim(p_sort), ''), 'created_desc') = 'created_desc'
      then fp.created_at
    end desc nulls last,
    fp.created_at desc,
    fp.id asc
  limit greatest(1, least(p_limit, 200))
  offset greatest(0, p_offset);
$$;

comment on function public.advisor_client_list_metrics(int, int, text, text) is
  'Advisor workspace roster: SECURITY DEFINER; identity columns always shown for linked clients, financial columns NULL/0 unless advisor_can_read_client (Consent-Gated Client-Data Access, P2-D2 identity-only).';

revoke all on function public.advisor_client_list_metrics(int, int, text, text) from public;
grant execute on function public.advisor_client_list_metrics(int, int, text, text) to authenticated;

-- Count is identity-only (no financial fields) -> no consent gating; convert
-- to security definer so it survives the financial_profiles policy drop.
create or replace function public.advisor_client_list_count(p_search text default null)
returns bigint
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select count(*)::bigint
  from public.financial_profiles fp
  where fp.profile_type = 'client'
    and fp.advisor_user_id = (select auth.uid())
    and (
      p_search is null
      or length(trim(p_search)) < 1
      or fp.display_name ilike '%' || trim(p_search) || '%'
    );
$$;

revoke all on function public.advisor_client_list_count(text) from public;
grant execute on function public.advisor_client_list_count(text) to authenticated;

-- ===========================================================================
-- Ship-gate audit amendment (SAFETY-CRITICAL; BEFORE the policy drops). Two
-- precise create-or-replace fixes to the Phase-1 audit:
--   Fix 1 — _qual_is_self_policy also recognizes the 8 `id = auth.uid()`
--     permutations: financial_profiles' PK `id` IS the auth uid
--     (20260410000000_init.sql:4), so `id = auth.uid()` is a correct self
--     form. Clears check #2 for profiles_*_own; reused by check #3.
--     _verify_consent_bypass is left UNCHANGED (it delegates to this fn, so
--     check #2 picks up Fix 1 automatically).
--   Fix 2 (option B) — verify_consent_gated_access() check #3 exempts a
--     public/anon-role financial_* policy ONLY IF it is a recognized self
--     form OR routes through advisor_can_read_client (auth.uid() is NULL for
--     anon ⇒ such a policy grants anon nothing). Any other public/anon policy
--     (not-self AND not-consent-routed) STILL RAISES — precise narrowing,
--     never a blanket pass. Checks #1/#2 reproduced byte-faithfully.
-- ===========================================================================
create or replace function public._qual_is_self_policy(p_expr text)
returns boolean
language sql
immutable
as $$
  select case
    when p_expr is null then false
    else replace(regexp_replace(lower(p_expr), '\s', '', 'g'), 'asuid', '')
      = any (array[
        '(user_id=(selectauth.uid()))',
        '((selectauth.uid())=user_id)',
        '(user_id=auth.uid())',
        '(auth.uid()=user_id)',
        'user_id=(selectauth.uid())',
        '(selectauth.uid())=user_id',
        'user_id=auth.uid()',
        'auth.uid()=user_id',
        '(id=(selectauth.uid()))',
        '((selectauth.uid())=id)',
        '(id=auth.uid())',
        '(auth.uid()=id)',
        'id=(selectauth.uid())',
        '(selectauth.uid())=id',
        'id=auth.uid()',
        'auth.uid()=id'
      ])
  end;
$$;

revoke all on function public._qual_is_self_policy(text) from public;

create or replace function public.verify_consent_gated_access()
returns text
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_bad text;
begin
  select string_agg(c.relname::text, ', ' order by c.relname)
    into v_bad
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relname like 'financial\_%'
    and c.relrowsecurity = false;
  if v_bad is not null then
    raise exception 'Consent-Gated Client-Data Access: RLS disabled (fail-open) on: %', v_bad;
  end if;

  select string_agg(format('%s.%s', tablename, policyname), ', '
                     order by tablename, policyname)
    into v_bad
  from pg_policies
  where schemaname = 'public'
    and tablename like 'financial\_%'
    and (public._verify_consent_bypass(qual)
         or public._verify_consent_bypass(with_check));
  if v_bad is not null then
    raise exception 'Consent-Gated Client-Data Access: cross-user / USING(true) policy not routing through the consent predicate (and not a recognised self form): %', v_bad;
  end if;

  -- Mis-scoping (option B): a public/anon-role client-data policy is a silent
  -- leak ONLY when it is neither self-scoped nor consent-routed (auth.uid() is
  -- NULL for anon, so a self/consent policy grants anon zero rows). Anything
  -- else at public/anon still RAISES.
  select string_agg(format('%s.%s', tablename, policyname), ', '
                     order by tablename, policyname)
    into v_bad
  from pg_policies
  where schemaname = 'public'
    and tablename like 'financial\_%'
    and exists (
      select 1 from unnest(roles) rr where rr::text in ('public', 'anon')
    )
    and not (
      public._qual_is_self_policy(qual)
      or public._qual_is_self_policy(with_check)
      or coalesce(qual, '') like '%advisor_can_read_client%'
      or coalesce(with_check, '') like '%advisor_can_read_client%'
    );
  if v_bad is not null then
    raise exception 'Consent-Gated Client-Data Access: client-data policy mis-scoped to public/anon (not self, not consent-routed): %', v_bad;
  end if;

  return 'OK';
end;
$$;

revoke all on function public.verify_consent_gated_access() from public;

-- ===========================================================================
-- D2 — drop ALL legacy advisor cross-user policies (read + the 3 write) on
-- every remaining surface. Reads now route through the advisor_read_* fns
-- above; the write policies were never the satisfying policy on any real flow
-- (advisor authoring writes to advisor_proposal* as the advisor; proposal
-- accept runs as the CLIENT via the *_own policies), so dropping is
-- behaviorally identical to today and fully realizes Pillar 2.
-- ===========================================================================
drop policy if exists "financial_expenses_select_advisor_clients" on public.financial_expenses;
drop policy if exists "financial_expenses_insert_advisor_clients" on public.financial_expenses;
drop policy if exists "financial_expenses_update_advisor_clients" on public.financial_expenses;
drop policy if exists "financial_expenses_delete_advisor_clients" on public.financial_expenses;

drop policy if exists "financial_goals_select_advisor_clients" on public.financial_goals;
drop policy if exists "financial_goals_insert_advisor_clients" on public.financial_goals;
drop policy if exists "financial_goals_update_advisor_clients" on public.financial_goals;
drop policy if exists "financial_goals_delete_advisor_clients" on public.financial_goals;

drop policy if exists "financial_budget_lines_select_advisor_clients" on public.financial_budget_lines;
drop policy if exists "financial_budget_lines_insert_advisor_clients" on public.financial_budget_lines;
drop policy if exists "financial_budget_lines_update_advisor_clients" on public.financial_budget_lines;
drop policy if exists "financial_budget_lines_delete_advisor_clients" on public.financial_budget_lines;

drop policy if exists "financial_budget_line_month_overrides_select_advisor_clients"
  on public.financial_budget_line_month_overrides;
drop policy if exists "financial_budget_line_month_overrides_insert_advisor_clients"
  on public.financial_budget_line_month_overrides;
drop policy if exists "financial_budget_line_month_overrides_update_advisor_clients"
  on public.financial_budget_line_month_overrides;
drop policy if exists "financial_budget_line_month_overrides_delete_advisor_clients"
  on public.financial_budget_line_month_overrides;

drop policy if exists "financial_cash_accounts_select_advisor_clients" on public.financial_cash_accounts;
drop policy if exists "financial_cash_accounts_insert_advisor_clients" on public.financial_cash_accounts;
drop policy if exists "financial_cash_accounts_update_advisor_clients" on public.financial_cash_accounts;
drop policy if exists "financial_cash_accounts_delete_advisor_clients" on public.financial_cash_accounts;

drop policy if exists "financial_liabilities_select_advisor_clients" on public.financial_liabilities;
drop policy if exists "financial_liabilities_insert_advisor_clients" on public.financial_liabilities;
drop policy if exists "financial_liabilities_update_advisor_clients" on public.financial_liabilities;
drop policy if exists "financial_liabilities_delete_advisor_clients" on public.financial_liabilities;

drop policy if exists "financial_cpf_balances_select_advisor_clients" on public.financial_cpf_balances;
drop policy if exists "financial_cpf_balances_insert_advisor_clients" on public.financial_cpf_balances;
drop policy if exists "financial_cpf_balances_update_advisor_clients" on public.financial_cpf_balances;
drop policy if exists "financial_cpf_balances_delete_advisor_clients" on public.financial_cpf_balances;

drop policy if exists "financial_housing_loans_select_advisor_clients" on public.financial_housing_loans;
drop policy if exists "financial_housing_loans_insert_advisor_clients" on public.financial_housing_loans;
drop policy if exists "financial_housing_loans_update_advisor_clients" on public.financial_housing_loans;
drop policy if exists "financial_housing_loans_delete_advisor_clients" on public.financial_housing_loans;

drop policy if exists "financial_vehicles_select_advisor_clients" on public.financial_vehicles;
drop policy if exists "financial_vehicles_insert_advisor_clients" on public.financial_vehicles;
drop policy if exists "financial_vehicles_update_advisor_clients" on public.financial_vehicles;
drop policy if exists "financial_vehicles_delete_advisor_clients" on public.financial_vehicles;

drop policy if exists "financial_profiles_select_advisor_clients" on public.financial_profiles;
drop policy if exists "financial_profiles_update_advisor_linked_clients" on public.financial_profiles;

commit;
