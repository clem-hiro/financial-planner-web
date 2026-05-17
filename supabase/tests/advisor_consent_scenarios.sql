-- Consent-Gated Client-Data Access — advisor_can_read_client latest-event-wins
-- scenario matrix + the behavioral advisor_read_investments end-to-end.
-- Verifies supabase/migrations/20260528000000_advisor_consent_invariant.sql.
--
-- WHY SQL, not vitest: the consent invariant lives in the DB
-- (advisor_can_read_client predicate + RLS + SECURITY DEFINER RPCs); only
-- meaningfully testable against real Postgres. No new dependency (same
-- decision as qr_redeem_scenarios.sql).
--
-- HOW to run — against a SCRATCH Postgres/Supabase (NEVER shared prod), as the
-- owner/service role (advisor_can_read_client is security invoker; run as
-- owner so RLS is bypassed and auth.uid() is supplied via the JWT-claims GUC):
--
--     psql "$SCRATCH_DB_URL" -v ON_ERROR_STOP=1 \
--       -f supabase/migrations/20260528000000_advisor_consent_invariant.sql \
--       -f supabase/tests/advisor_consent_scenarios.sql
--
-- (Apply the migration first if the scratch DB does not have it.) Every
-- scenario is begin … rollback (nothing persists). Success prints
-- `SCENARIO n: PASS`; a failed `assert` aborts with the scenario's message.
-- Record input → expected → actual → pass/fail per run.
--
-- ============================================================================
-- OPERATOR APPLY + PER-SURFACE VALIDATION RUNBOOK (Phase 1 pilot)
-- ============================================================================
-- 1. Apply 20260528000000 in the Supabase SQL editor with an owner/superuser
--    role (CREATE EVENT TRIGGER requires superuser; the app's `authenticated`
--    role cannot apply it).
-- 2. As a linked but NON-consented advisor (real session), open the client
--    workspace:
--      - select * from public.advisor_read_investments('<client_uuid>');     -- 0 rows
--      - select public.advisor_can_read_client('<client_uuid>');             -- false
--      - the advisor workspace shows the explicit "Consent required" state;
--        proposal create/save/submit actions return the consent error.
-- 3. Insert a consent row AS THE CLIENT (their own session / RLS):
--      insert into public.advisor_client_consents
--        (client_user_id, advisor_user_id, status, consent_version, purpose,
--         consent_text, granted_at)
--      values ('<client_uuid>','<advisor_uuid>','granted','v1',
--              'advisor_view','...', now());
--      - advisor_read_investments now returns the client's real rows;
--      - the advisor projection includes the synthetic income-tax expense
--        (advice-integrity bug fixed) once advisor_read_income_tax_config
--        returns the client's config.
-- 4. Insert a `withdrawn` row (latest-event-wins) → RPCs return 0 rows again.
-- 5. select public.verify_consent_gated_access();  -- FINAL ship gate only.
--    During phased rollout this RAISEs on not-yet-migrated tables that still
--    carry advisor cross-user policies — EXPECTED; it passes only once every
--    advisor-readable surface is on the RPC chokepoint. It is NOT a
--    per-phase gate.
-- 6. select evtname, evtenabled from pg_event_trigger
--      where evtname = 'enforce_client_data_rls';  -- present, evtenabled <> 'D'
-- ============================================================================

-- Session-scoped helper: insert an auth.users row (fires handle_new_user,
-- which creates the financial_profiles row from raw_user_meta_data).
create or replace function pg_temp.mk_user(p_email text, p_meta jsonb)
returns uuid
language plpgsql
as $fn$
declare
  v_id uuid := gen_random_uuid();
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id,
    'authenticated', 'authenticated', p_email, 'x',
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, p_meta, false
  );
  return v_id;
end;
$fn$;

-- Make auth.uid() resolve to p_advisor for the duration of the surrounding
-- transaction (Supabase reads the JWT `sub` claim).
create or replace function pg_temp.act_as(p_advisor uuid)
returns void
language plpgsql
as $fn$
begin
  perform set_config('request.jwt.claims',
                      json_build_object('sub', p_advisor::text)::text, true);
  perform set_config('request.jwt.claim.sub', p_advisor::text, true);
end;
$fn$;

-- Link a client to an advisor (handle_new_user leaves advisor_user_id null
-- when no qr_token is claimed).
create or replace function pg_temp.link(p_client uuid, p_advisor uuid)
returns void
language plpgsql
as $fn$
begin
  update public.financial_profiles
     set advisor_user_id = p_advisor, profile_type = 'client'
   where id = p_client;
end;
$fn$;

-- ===========================================================================
-- SCENARIO 1 — never consented => deny
-- ===========================================================================
begin;
do $$
declare v_adv uuid; v_cli uuid;
begin
  v_adv := pg_temp.mk_user('adv1@consent.test', '{"profile_type":"advisor"}'::jsonb);
  v_cli := pg_temp.mk_user('cli1@consent.test', '{"profile_type":"client"}'::jsonb);
  perform pg_temp.link(v_cli, v_adv);
  perform pg_temp.act_as(v_adv);

  assert public.advisor_can_read_client(v_cli) = false,
    'S1: never-consented advisor must be denied (fail-closed)';
  assert (select count(*) from public.advisor_read_investments(v_cli)) = 0,
    'S1: advisor_read_investments must return 0 rows when not consented';
  raise notice 'SCENARIO 1: PASS (never consented -> deny, RPC empty)';
end $$;
rollback;

-- ===========================================================================
-- SCENARIO 2 — granted => allow; RPC returns the client's rows
-- ===========================================================================
begin;
do $$
declare v_adv uuid; v_cli uuid; v_inv int;
begin
  v_adv := pg_temp.mk_user('adv2@consent.test', '{"profile_type":"advisor"}'::jsonb);
  v_cli := pg_temp.mk_user('cli2@consent.test', '{"profile_type":"client"}'::jsonb);
  perform pg_temp.link(v_cli, v_adv);

  insert into public.financial_investments (user_id, name, current_value,
    monthly_contribution, expected_annual_return)
  values (v_cli, 'Brokerage', 10000, 500, 0.06);

  insert into public.advisor_client_consents (client_user_id, advisor_user_id,
    status, consent_version, purpose, consent_text, granted_at, created_at)
  values (v_cli, v_adv, 'granted', 'v1', 'advisor_view', 'ok', now(), now());

  perform pg_temp.act_as(v_adv);

  assert public.advisor_can_read_client(v_cli) = true,
    'S2: granted consent must allow';
  select count(*) into v_inv from public.advisor_read_investments(v_cli);
  assert v_inv = 1,
    'S2: advisor_read_investments must return the client''s investment rows';
  raise notice 'SCENARIO 2: PASS (granted -> allow, RPC returns rows)';
end $$;
rollback;

-- ===========================================================================
-- SCENARIO 3 — withdrawn AFTER granted => deny (latest-event-wins)
-- ===========================================================================
begin;
do $$
declare v_adv uuid; v_cli uuid;
begin
  v_adv := pg_temp.mk_user('adv3@consent.test', '{"profile_type":"advisor"}'::jsonb);
  v_cli := pg_temp.mk_user('cli3@consent.test', '{"profile_type":"client"}'::jsonb);
  perform pg_temp.link(v_cli, v_adv);

  insert into public.advisor_client_consents (client_user_id, advisor_user_id,
    status, consent_version, purpose, consent_text, granted_at, created_at)
  values (v_cli, v_adv, 'granted', 'v1', 'advisor_view', 'ok', now(),
          now() - interval '2 min');
  insert into public.advisor_client_consents (client_user_id, advisor_user_id,
    status, consent_version, purpose, consent_text, withdrawn_at, created_at)
  values (v_cli, v_adv, 'withdrawn', 'v1', 'advisor_view', 'ok', now(),
          now() - interval '1 min');

  perform pg_temp.act_as(v_adv);

  assert public.advisor_can_read_client(v_cli) = false,
    'S3: withdrawn after granted must deny (latest event wins)';
  assert (select count(*) from public.advisor_read_investments(v_cli)) = 0,
    'S3: RPC must be empty after withdrawal';
  raise notice 'SCENARIO 3: PASS (withdrawn-after-granted -> deny)';
end $$;
rollback;

-- ===========================================================================
-- SCENARIO 4 — re-granted after withdrawal => allow (latest-event-wins)
-- ===========================================================================
begin;
do $$
declare v_adv uuid; v_cli uuid;
begin
  v_adv := pg_temp.mk_user('adv4@consent.test', '{"profile_type":"advisor"}'::jsonb);
  v_cli := pg_temp.mk_user('cli4@consent.test', '{"profile_type":"client"}'::jsonb);
  perform pg_temp.link(v_cli, v_adv);

  insert into public.advisor_client_consents (client_user_id, advisor_user_id,
    status, consent_version, purpose, consent_text, created_at)
  values
    (v_cli, v_adv, 'granted',   'v1', 'advisor_view', 'ok', now() - interval '3 min'),
    (v_cli, v_adv, 'withdrawn', 'v1', 'advisor_view', 'ok', now() - interval '2 min'),
    (v_cli, v_adv, 'granted',   'v1', 'advisor_view', 'ok', now() - interval '1 min');

  perform pg_temp.act_as(v_adv);

  assert public.advisor_can_read_client(v_cli) = true,
    'S4: most-recent granted must allow (re-grant)';
  raise notice 'SCENARIO 4: PASS (re-granted -> allow)';
end $$;
rollback;

-- ===========================================================================
-- SCENARIO 5 — linkage scoping: a granted consent for a DIFFERENT advisor
-- does not let an unlinked advisor through (linkage AND consent both required)
-- ===========================================================================
begin;
do $$
declare v_adv uuid; v_adv2 uuid; v_cli uuid;
begin
  v_adv  := pg_temp.mk_user('adv5a@consent.test', '{"profile_type":"advisor"}'::jsonb);
  v_adv2 := pg_temp.mk_user('adv5b@consent.test', '{"profile_type":"advisor"}'::jsonb);
  v_cli  := pg_temp.mk_user('cli5@consent.test',  '{"profile_type":"client"}'::jsonb);
  perform pg_temp.link(v_cli, v_adv);  -- client linked to v_adv only

  -- client granted consent to v_adv (the linked advisor)
  insert into public.advisor_client_consents (client_user_id, advisor_user_id,
    status, consent_version, purpose, consent_text, created_at)
  values (v_cli, v_adv, 'granted', 'v1', 'advisor_view', 'ok', now());

  -- v_adv2 is NOT linked and has no consent row
  perform pg_temp.act_as(v_adv2);
  assert public.advisor_can_read_client(v_cli) = false,
    'S5: unlinked advisor must be denied even though another advisor is consented';

  -- v_adv (linked + consented) is allowed
  perform pg_temp.act_as(v_adv);
  assert public.advisor_can_read_client(v_cli) = true,
    'S5: linked + consented advisor must be allowed';
  raise notice 'SCENARIO 5: PASS (consent is scoped to the linked advisor)';
end $$;
rollback;
