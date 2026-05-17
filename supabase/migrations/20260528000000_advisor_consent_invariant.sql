-- Consent-Gated Client-Data Access — Phase 1 (financial_investments +
-- financial_income_tax_configs pilot). Two structural pillars:
--   Pillar 1: enforce_client_data_rls EVENT TRIGGER — auto-enables RLS on new
--             financial_* tables and RAISEs on a cross-user policy that does
--             not route through advisor_can_read_client().
--   Pillar 2: client tables keep only self policies; advisor->client reads go
--             ONLY through SECURITY DEFINER advisor_read_* fns embedding
--             advisor_can_read_client() (linkage AND latest-event-wins consent).
--
-- Forward-only. Operator-applied in the Supabase SQL editor with an
-- owner/superuser-capable role (CREATE EVENT TRIGGER requires superuser; the
-- app's `authenticated` role cannot apply this). Do NOT run against any DB
-- from app code.

begin;

-- ---------------------------------------------------------------------------
-- Consent ledger (append-only event log; latest-event-wins).
-- ---------------------------------------------------------------------------
create table public.advisor_client_consents (
  id uuid primary key default gen_random_uuid(),
  client_user_id uuid not null
    references public.financial_profiles(id) on delete cascade,
  advisor_user_id uuid not null
    references auth.users(id) on delete cascade,
  status text not null check (status in ('granted', 'withdrawn')),
  consent_version text not null,
  purpose text not null,
  consent_text text not null,
  granted_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now()
);

create index advisor_client_consents_latest_idx
  on public.advisor_client_consents (client_user_id, advisor_user_id, created_at desc);

alter table public.advisor_client_consents enable row level security;

-- Append-only: client may read/insert their own rows, advisor may read rows
-- where they are the advisor. No UPDATE/DELETE policy exists -> with RLS on,
-- mutation of past events is denied for every authenticated role.
create policy "advisor_client_consents_select_own_client"
  on public.advisor_client_consents for select
  to authenticated
  using ((select auth.uid()) = client_user_id);

create policy "advisor_client_consents_insert_own_client"
  on public.advisor_client_consents for insert
  to authenticated
  with check ((select auth.uid()) = client_user_id);

create policy "advisor_client_consents_select_advisor"
  on public.advisor_client_consents for select
  to authenticated
  using ((select auth.uid()) = advisor_user_id);

-- ---------------------------------------------------------------------------
-- Consent predicate — the single place the consent rule lives.
-- security invoker: when called directly by an advisor (consent-first gate)
-- the advisor's own RLS permits the financial_profiles linkage row (existing
-- financial_profiles_select_advisor_clients policy) and the consent rows
-- (advisor_client_consents_select_advisor policy above). When called inside a
-- SECURITY DEFINER advisor_read_* body it runs as the function owner, so the
-- self-only financial_profiles policy does not block the linkage lookup.
-- ---------------------------------------------------------------------------
create or replace function public.advisor_can_read_client(p_client uuid)
returns boolean
language sql
stable
security invoker
set search_path = public, pg_catalog
as $$
  select
    exists (
      select 1 from public.financial_profiles fp
      where fp.id = p_client
        and fp.profile_type = 'client'
        and fp.advisor_user_id = (select auth.uid())
    )
    -- coalesce -> fail-closed: no consent row (subquery NULL) is treated as
    -- denied, never as "allow". Latest event wins (status of the most recent
    -- row for this client+advisor); 'withdrawn' or absence => false.
    and coalesce(
      (
        select c.status = 'granted'
        from public.advisor_client_consents c
        where c.client_user_id = p_client
          and c.advisor_user_id = (select auth.uid())
        order by c.created_at desc, c.id desc
        limit 1
      ),
      false
    );
$$;

revoke all on function public.advisor_can_read_client(uuid) from public;
grant execute on function public.advisor_can_read_client(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- TWO SEPARATE bypass predicates — opposite risk profiles, deliberately NOT
-- shared (see final report's two-predicate rationale).
--
-- (A) _trigger_consent_bypass — LENIENT / high-confidence. Used ONLY by the
--     automatic event trigger, which fires on EVERY migration. A false
--     positive here is catastrophic (halts all future dev, incl. legitimate
--     self-policy creation); a false negative is acceptable because Pillar 2
--     means such a policy should not be authored at all AND the strict
--     ship-gate audit (B) catches it. Optimised for "never brick a migration".
--     Signal = references auth.uid() AND NOT advisor_can_read_client AND
--     references advisor_user_id. advisor_user_id is the high-confidence
--     cross-user marker: every legacy cross-user advisor policy in this
--     codebase references it (blast-radius §4b uniform shape), so true-positive
--     coverage of the known breach class is unchanged. A standalone `exists`
--     disjunct was deliberately REMOVED — a legitimate future self-policy may
--     use an EXISTS subquery (own-this-row-if-you-own-its-parent) that
--     references auth.uid() but NOT advisor_user_id; flagging it would brick
--     that migration, defeating this predicate's purpose. That exotic
--     residual is acceptable here and remains caught by the STRICT (B) ship
--     gate. DO NOT reuse this for (B).
-- ---------------------------------------------------------------------------
create or replace function public._trigger_consent_bypass(p_expr text)
returns boolean
language sql
immutable
as $$
  select case
    when p_expr is null then false
    when lower(p_expr) not like '%auth.uid()%' then false
    when lower(p_expr) like '%advisor_can_read_client%' then false
    when lower(p_expr) like '%advisor_user_id%' then true
    else false
  end;
$$;

revoke all on function public._trigger_consent_bypass(text) from public;

-- ---------------------------------------------------------------------------
-- Recognised self-policy forms. pg_get_expr renders `(select auth.uid())` as
-- `( SELECT auth.uid() AS uid)`; normalise (lowercase, strip whitespace, drop
-- the `as uid` subselect-alias artifact) then match the canonical self
-- comparisons from Pre-Prod checklist #2's own negative list (both operand
-- orders, with/without the subselect, with/without the outer paren pair).
-- ---------------------------------------------------------------------------
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
        'auth.uid()=user_id'
      ])
  end;
$$;

revoke all on function public._qual_is_self_policy(text) from public;

-- ---------------------------------------------------------------------------
-- (B) _verify_consent_bypass — STRICT / comprehensive. Used ONLY by
--     verify_consent_gated_access() (the deliberate, human-run ship gate). A
--     false positive is cheap (a human triages at ship time); a false
--     negative is the real danger (a leak ships). Flags ANY expr that
--     references auth.uid() and does NOT route through advisor_can_read_client
--     UNLESS it is exactly a recognised self-policy form — plus USING(true)
--     (failure-mode table: silent leak). Strictly stronger than (A).
-- ---------------------------------------------------------------------------
create or replace function public._verify_consent_bypass(p_expr text)
returns boolean
language sql
immutable
as $$
  select case
    when p_expr is null then false
    when regexp_replace(lower(p_expr), '\s', '', 'g') = 'true' then true
    when lower(p_expr) not like '%auth.uid()%' then false
    when lower(p_expr) like '%advisor_can_read_client%' then false
    when public._qual_is_self_policy(p_expr) then false
    else true
  end;
$$;

revoke all on function public._verify_consent_bypass(text) from public;

-- ---------------------------------------------------------------------------
-- Pillar 1 — enforce_client_data_rls EVENT TRIGGER.
-- Fires for ANY DDL source (claude-code, psql, Supabase SQL editor, future
-- tooling): new financial_* tables get RLS auto-enabled; a cross-user policy
-- on a financial_* table that bypasses the consent predicate is rejected.
-- ddl_command_end fires forward-only — it does NOT re-evaluate pre-existing
-- policies of not-yet-migrated tables (that is verify_consent_gated_access()'s
-- job as the full-state ship gate).
-- ---------------------------------------------------------------------------
create or replace function public.enforce_client_data_rls()
returns event_trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  r record;
  v_relname text;
  v_rls boolean;
  v_qual text;
  v_check text;
begin
  for r in select * from pg_event_trigger_ddl_commands()
  loop
    if r.command_tag = 'CREATE TABLE' and r.object_type = 'table' then
      select c.relname, c.relrowsecurity into v_relname, v_rls
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where c.oid = r.objid and n.nspname = 'public' and c.relkind = 'r';

      if v_relname is not null
         and v_relname like 'financial\_%'
         and v_relname not like 'advisor\_%'
         and not v_rls then
        execute format(
          'alter table public.%I enable row level security', v_relname);
      end if;

    elsif r.command_tag = 'CREATE POLICY' and r.object_type = 'policy' then
      select c.relname,
             pg_get_expr(p.polqual, p.polrelid),
             pg_get_expr(p.polwithcheck, p.polrelid)
        into v_relname, v_qual, v_check
      from pg_policy p
      join pg_class c on c.oid = p.polrelid
      join pg_namespace n on n.oid = c.relnamespace
      where p.oid = r.objid and n.nspname = 'public';

      if v_relname is not null
         and v_relname like 'financial\_%'
         and v_relname not like 'advisor\_%'
         and (public._trigger_consent_bypass(v_qual)
              or public._trigger_consent_bypass(v_check)) then
        raise exception 'Consent-Gated Client-Data Access: cross-user policy on public.% must route through advisor_can_read_client() — expose the table via a SECURITY DEFINER advisor_read_* function, not a cross-user RLS policy', v_relname;
      end if;
    end if;
  end loop;
end;
$$;

revoke all on function public.enforce_client_data_rls() from public;

drop event trigger if exists enforce_client_data_rls;
create event trigger enforce_client_data_rls
  on ddl_command_end
  when tag in ('CREATE TABLE', 'CREATE POLICY')
  execute function public.enforce_client_data_rls();

-- ---------------------------------------------------------------------------
-- DB self-assertion — the ship gate (final Pre-Prod Checklist), NOT a
-- per-phase hard gate. STRICT/comprehensive full-state audit (uses the strict
-- predicate, not the lenient trigger one): covers all three failure modes
-- from the plan's failure-mode table — (1) RLS disabled / fail-open table,
-- (2) cross-user or USING(true) policy not routing through the consent
-- predicate and not a recognised self form, (3) policy mis-scoped to
-- public/anon on a client-data table. Run by a human at ship time, so false
-- positives are cheap and false negatives are the real danger. During phased
-- rollout not-yet-migrated tables still carry their advisor policies and this
-- WILL raise on them — expected. It passes only once every advisor-readable
-- surface is on the RPC chokepoint.
-- ---------------------------------------------------------------------------
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

  -- Mis-scoping: a client-data policy must not apply to public/anon (the
  -- plan's failure-mode table: TO public => silent leak).
  select string_agg(format('%s.%s', tablename, policyname), ', '
                     order by tablename, policyname)
    into v_bad
  from pg_policies
  where schemaname = 'public'
    and tablename like 'financial\_%'
    and exists (
      select 1 from unnest(roles) rr where rr::text in ('public', 'anon')
    );
  if v_bad is not null then
    raise exception 'Consent-Gated Client-Data Access: client-data policy mis-scoped to public/anon: %', v_bad;
  end if;

  return 'OK';
end;
$$;

revoke all on function public.verify_consent_gated_access() from public;

-- ---------------------------------------------------------------------------
-- Pillar 2 — consent-gated advisor read surface (pilot: 2 tables).
-- returns setof public.<table> => row shape is byte-identical to the
-- repository `select *` (InvestmentRow / IncomeTaxConfigRow), so the shared
-- overlay mapper (apply-overlay.ts) composes unchanged (C6). Deny-shaped
-- early return: not consented => zero rows (fail-closed), never an error.
-- ---------------------------------------------------------------------------
create or replace function public.advisor_read_investments(p_client uuid)
returns setof public.financial_investments
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
    from public.financial_investments
    where user_id = p_client
    order by created_at asc;  -- matches listInvestments() ordering exactly
end;
$$;

revoke all on function public.advisor_read_investments(uuid) from public;
grant execute on function public.advisor_read_investments(uuid) to authenticated;

create or replace function public.advisor_read_income_tax_config(p_client uuid)
returns setof public.financial_income_tax_configs
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
    from public.financial_income_tax_configs
    where user_id = p_client;  -- unique(user_id): at most one row
end;
$$;

revoke all on function public.advisor_read_income_tax_config(uuid) from public;
grant execute on function public.advisor_read_income_tax_config(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- D2 — drop ALL 4 financial_investments advisor cross-user policies. Reads
-- now route through advisor_read_investments(); the 3 write policies were
-- never the satisfying policy on any real flow (proposal-accept runs as the
-- client via financial_investments_*_own), so dropping is behaviorally
-- identical to today and fully realizes Pillar 2 (no verify-fn carve-out).
-- ---------------------------------------------------------------------------
drop policy if exists "financial_investments_select_advisor_clients"
  on public.financial_investments;
drop policy if exists "financial_investments_insert_advisor_clients"
  on public.financial_investments;
drop policy if exists "financial_investments_update_advisor_clients"
  on public.financial_investments;
drop policy if exists "financial_investments_delete_advisor_clients"
  on public.financial_investments;

commit;
