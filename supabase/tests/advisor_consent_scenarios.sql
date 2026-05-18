-- Consent-Gated Client-Data Access — Phase 2 behavioral verifier (S6–S12 +
-- ship gate). psql sibling of supabase/tests/scratch_verify_phase2.sql.
-- Verifies supabase/migrations/20260528000000 (Phase 1) AND 20260529000000
-- (Phase 2: 10 advisor_read_* surfaces + roster conversion + C1 monotonic
-- `seq` + advisor_linked_client) end-to-end.
--
-- WHY SQL, not vitest: the invariant lives in the DB (advisor_can_read_client
-- predicate + RLS + SECURITY DEFINER RPCs); only meaningfully testable against
-- real Postgres. No new dependency (same decision as qr_redeem_scenarios.sql).
--
-- SYNTHETIC (clone-based approach abandoned — see LEARNINGS). Fixtures are
-- created through the GENUINE signup path (advisor → advisor_access_keys →
-- advisor_qr_share_tokens → client signs up with qr_token → on_auth_user_
-- created/handle_new_user atomically redeems and binds the REAL advisor↔client
-- linkage), so the access-key gate (P0001) is satisfied, never bypassed.
-- Access key is UPPERCASE hex (handle_new_user upper()s the redeemed key
-- before lookup). No production data is read or copied. Every synthetic user
-- uses the `@cgp2.test` domain and `public._cgp2_cleanup()` deletes them (FK
-- on-delete-cascade removes their profiles/financial_*/consents/keys/tokens)
-- — isolation is sentinel-keyed, NOT begin/rollback. Start + per-scenario +
-- teardown cleanup ⇒ re-runnable on a dirty scratch DB. digest() UNqualified
-- (pgcrypto in public, never extensions.digest — LEARNINGS).
--
-- HOW to run — against a SCRATCH/THROWAWAY database (NEVER production), as
-- owner/service role. This is the psql variant: it applies BOTH migrations
-- via separate `-f` files first (the Supabase-SQL-editor variant that embeds
-- 20260529000000 verbatim for a single paste-and-run is
-- scratch_verify_phase2.sql + the O2 npm run check:scratch-verify guard):
--
--     psql "$SCRATCH_DB_URL" -v ON_ERROR_STOP=1 \
--       -f supabase/migrations/20260528000000_advisor_consent_invariant.sql \
--       -f supabase/migrations/20260529000000_advisor_consent_phase2.sql \
--       -f supabase/tests/advisor_consent_scenarios.sql
--
-- Each scenario prints `SCENARIO n: PASS`; a failed `assert` RAISEs loudly and
-- aborts (re-run is safe — the start cleanup clears the aborted run's rows).
-- Read the final `ship_gate = OK` row — the PRIMARY structural gate
-- (data-independent: verify_consent_gated_access() scans pg_policies/pg_class,
-- not rows).
--
-- MIRROR CONTRACT (reviewer-diffable): everything from the first line that
-- begins `create or replace function public.<the mk_user helper>` to EOF is
-- BYTE-IDENTICAL to the same span in supabase/tests/scratch_verify_phase2.sql.
-- The two synthetic shared sections must not drift; only this header and
-- scratch_verify's precondition guard + embedded-migration block differ.
-- The anchor is `^create ...` (comment lines start with `--`, so this prose
-- never matches — the recipe keys off the code, not the doc):
-- Verify: diff <(sed -n '/^create or replace function public[.]_cgp2_mk_user/,$p' supabase/tests/advisor_consent_scenarios.sql) \
--              <(sed -n '/^create or replace function public[.]_cgp2_mk_user/,$p' supabase/tests/scratch_verify_phase2.sql)
-- ============================================================================

create or replace function public._cgp2_mk_user(p_email text, p_meta jsonb)
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

create or replace function public._cgp2_act_as(p_advisor uuid)
returns void
language plpgsql
as $fn$
begin
  perform set_config('request.jwt.claims',
                      json_build_object('sub', p_advisor::text)::text, true);
  perform set_config('request.jwt.claim.sub', p_advisor::text, true);
end;
$fn$;

-- Genuine access-key signup: advisor key (UPPERCASE hex) + QR share token;
-- client signs up with the raw qr_token → handle_new_user redeems + binds.
create or replace function public._cgp2_mk_linked_client(
  p_advisor uuid,
  p_email text
)
returns uuid
language plpgsql
as $fn$
declare
  v_key text := substr(upper(replace(gen_random_uuid()::text, '-', '')), 1, 16);
  v_raw text := substr(replace(gen_random_uuid()::text, '-', ''), 1, 22);
begin
  insert into public.advisor_access_keys (advisor_user_id, access_key)
  values (p_advisor, v_key);
  insert into public.advisor_qr_share_tokens
    (token_hash, access_key, advisor_user_id, expires_at)
  values (encode(digest(v_raw, 'sha256'), 'hex'), v_key, p_advisor,
          now() + interval '15 min');
  return public._cgp2_mk_user(
    p_email,
    jsonb_build_object('profile_type', 'client', 'qr_token', v_raw)
  );
end;
$fn$;

-- Sentinel-keyed cleanup: every synthetic user is `@cgp2.test`; deleting them
-- cascades (auth.users → financial_profiles → financial_*/consents;
-- auth.users → advisor_access_keys → advisor_qr_share_tokens). Idempotent.
create or replace function public._cgp2_cleanup()
returns void
language plpgsql
as $fn$
begin
  delete from auth.users where email like '%@cgp2.test';
end;
$fn$;

-- Re-runnability: clear residue from any prior aborted run BEFORE scenarios.
select public._cgp2_cleanup();

-- ===========================================================================
-- SCENARIO 6 — not consented => every one of the 10 advisor_read_* surfaces
-- (+ profile) returns 0 rows (fail-closed across the whole chokepoint).
-- ===========================================================================
do $$
declare v_adv uuid; v_cli uuid;
begin
  v_adv := public._cgp2_mk_user('adv6@cgp2.test', '{"profile_type":"advisor"}'::jsonb);
  v_cli := public._cgp2_mk_linked_client(v_adv, 'cli6@cgp2.test');
  perform public._cgp2_act_as(v_adv);

  assert public.advisor_can_read_client(v_cli) = false,
    'S6: linked-but-not-consented must be denied';
  assert (select count(*) from public.advisor_read_expenses(v_cli)) = 0
     and (select count(*) from public.advisor_read_goals(v_cli)) = 0
     and (select count(*) from public.advisor_read_budget_lines(v_cli)) = 0
     and (select count(*) from public.advisor_read_budget_line_month_overrides(v_cli)) = 0
     and (select count(*) from public.advisor_read_cash_accounts(v_cli)) = 0
     and (select count(*) from public.advisor_read_liabilities(v_cli)) = 0
     and (select count(*) from public.advisor_read_cpf_balances(v_cli)) = 0
     and (select count(*) from public.advisor_read_housing_loans(v_cli)) = 0
     and (select count(*) from public.advisor_read_vehicles(v_cli)) = 0
     and (select count(*) from public.advisor_read_profile(v_cli)) = 0,
    'S6: every advisor_read_* must be empty when not consented';
  perform public._cgp2_cleanup();
  raise notice 'SCENARIO 6: PASS (not consented -> all surfaces empty)';
end $$;

-- ===========================================================================
-- SCENARIO 7 — C1 same-tick determinism (monotonic seq tie-break), both ways.
-- ===========================================================================
do $$
declare v_adv uuid; v_x uuid; v_y uuid;
begin
  v_adv := public._cgp2_mk_user('adv7@cgp2.test',  '{"profile_type":"advisor"}'::jsonb);
  v_x   := public._cgp2_mk_linked_client(v_adv, 'cli7x@cgp2.test');
  v_y   := public._cgp2_mk_linked_client(v_adv, 'cli7y@cgp2.test');

  insert into public.advisor_client_consents (client_user_id, advisor_user_id,
    status, consent_version, purpose, consent_text)
  values (v_x, v_adv, 'granted',   'v1', 'advisor_view', 'ok'),
         (v_x, v_adv, 'withdrawn', 'v1', 'advisor_view', 'ok');
  insert into public.advisor_client_consents (client_user_id, advisor_user_id,
    status, consent_version, purpose, consent_text)
  values (v_y, v_adv, 'withdrawn', 'v1', 'advisor_view', 'ok'),
         (v_y, v_adv, 'granted',   'v1', 'advisor_view', 'ok');

  perform public._cgp2_act_as(v_adv);
  assert public.advisor_can_read_client(v_x) = false,
    'S7: same-tick grant->withdraw must DENY (later seq = withdrawn wins)';
  assert public.advisor_can_read_client(v_y) = true,
    'S7: same-tick withdraw->grant must ALLOW (later seq = granted wins)';
  perform public._cgp2_cleanup();
  raise notice 'SCENARIO 7: PASS (C1 same-tick resolves deterministically by seq)';
end $$;

-- ===========================================================================
-- SCENARIO 8 — P2-D2 roster identity-only. Two linked clients; consent A only.
-- ===========================================================================
do $$
declare v_adv uuid; v_a uuid; v_b uuid;
  v_a_income numeric; v_b_income numeric; v_b_name text; v_b_id uuid;
  v_b_expcount bigint;
begin
  v_adv := public._cgp2_mk_user('adv8@cgp2.test',  '{"profile_type":"advisor"}'::jsonb);
  v_a   := public._cgp2_mk_linked_client(v_adv, 'cli8a@cgp2.test');
  v_b   := public._cgp2_mk_linked_client(v_adv, 'cli8b@cgp2.test');

  update public.financial_profiles set display_name='Client A', monthly_income=8888 where id=v_a;
  update public.financial_profiles set display_name='Client B', monthly_income=7777 where id=v_b;
  insert into public.financial_expenses (user_id, amount, category, spent_at)
  values (v_b, 50, 'food', current_date);
  insert into public.advisor_client_consents (client_user_id, advisor_user_id,
    status, consent_version, purpose, consent_text)
  values (v_a, v_adv, 'granted', 'v1', 'advisor_view', 'ok');

  perform public._cgp2_act_as(v_adv);
  select monthly_income into v_a_income
  from public.advisor_client_list_metrics(50,0,null,'created_desc') where id=v_a;
  select monthly_income, display_name, id, expense_count
    into v_b_income, v_b_name, v_b_id, v_b_expcount
  from public.advisor_client_list_metrics(50,0,null,'created_desc') where id=v_b;

  assert v_a_income = 8888, 'S8: consented A shows real monthly_income';
  assert v_b_income is null, 'S8: NON-consented B monthly_income NULL (identity-only)';
  assert v_b_expcount = 0, 'S8: NON-consented B expense_count 0 (agg gated)';
  assert v_b_name = 'Client B' and v_b_id = v_b,
    'S8: identity columns always visible';
  assert public.advisor_client_list_count(null) = 2,
    'S8: count = both linked clients regardless of consent';
  perform public._cgp2_cleanup();
  raise notice 'SCENARIO 8: PASS (roster identity-only for non-consented)';
end $$;

-- ===========================================================================
-- SCENARIO 9 — ship gate assertion (data-independent; verify_consent_gated_
-- access scans pg_policies/pg_class, not rows). No fixture.
-- ===========================================================================
do $$
begin
  assert public.verify_consent_gated_access() = 'OK',
    'S9: verify_consent_gated_access() must return OK after Phase 2';
  raise notice 'SCENARIO 9: PASS (ship gate OK — all surfaces consent-gated)';
end $$;

-- ===========================================================================
-- SCENARIO 10 — advisor_linked_client CONSENT-INDEPENDENT; advisor_read_
-- profile consent-gated; linkage auth.uid()-scoped (2nd advisor's client).
-- ===========================================================================
do $$
declare v_adv uuid; v_other_adv uuid; v_cli uuid; v_other uuid;
begin
  v_adv       := public._cgp2_mk_user('adv10@cgp2.test',  '{"profile_type":"advisor"}'::jsonb);
  v_other_adv := public._cgp2_mk_user('adv10b@cgp2.test', '{"profile_type":"advisor"}'::jsonb);
  v_cli   := public._cgp2_mk_linked_client(v_adv, 'cli10@cgp2.test');
  v_other := public._cgp2_mk_linked_client(v_other_adv, 'cli10b@cgp2.test');
  perform public._cgp2_act_as(v_adv);

  assert (select count(*) from public.advisor_linked_client(v_cli)) = 1,
    'S10: advisor_linked_client returns the linked client (consent-INDEPENDENT)';
  assert (select count(*) from public.advisor_read_profile(v_cli)) = 0,
    'S10: advisor_read_profile is 0 for the not-consented client (gated)';
  assert (select count(*) from public.advisor_linked_client(v_other)) = 0,
    'S10: advisor_linked_client is 0 for a non-linked client (auth.uid scoped)';

  insert into public.advisor_client_consents (client_user_id, advisor_user_id,
    status, consent_version, purpose, consent_text)
  values (v_cli, v_adv, 'granted', 'v1', 'advisor_view', 'ok');
  assert (select count(*) from public.advisor_read_profile(v_cli)) = 1,
    'S10: after consent, advisor_read_profile returns the profile';
  assert (select count(*) from public.advisor_linked_client(v_cli)) = 1,
    'S10: advisor_linked_client unchanged by consent (still 1)';
  perform public._cgp2_cleanup();
  raise notice 'SCENARIO 10: PASS (linkage consent-independent; profile gated)';
end $$;

-- ===========================================================================
-- SCENARIO 11 — windowed-vs-all for the 2 param'd RPCs (consented client).
-- ===========================================================================
do $$
declare v_adv uuid; v_cli uuid; v_bl uuid;
begin
  v_adv := public._cgp2_mk_user('adv11@cgp2.test', '{"profile_type":"advisor"}'::jsonb);
  v_cli := public._cgp2_mk_linked_client(v_adv, 'cli11@cgp2.test');
  insert into public.advisor_client_consents (client_user_id, advisor_user_id,
    status, consent_version, purpose, consent_text)
  values (v_cli, v_adv, 'granted', 'v1', 'advisor_view', 'ok');

  insert into public.financial_expenses (user_id, amount, category, spent_at)
  values (v_cli, 10, 'food', date '2026-05-10'),
         (v_cli, 20, 'food', date '2026-05-20'),
         (v_cli, 30, 'food', date '2026-06-05');
  insert into public.financial_budget_lines (user_id, category, cadence, amount)
  values (v_cli, 'Rent', 'monthly', 1000) returning id into v_bl;
  insert into public.financial_budget_line_month_overrides
    (user_id, budget_line_id, year_month, amount)
  values (v_cli, v_bl, '2026-05', 1200),
         (v_cli, v_bl, '2026-06', 1300);

  perform public._cgp2_act_as(v_adv);
  assert (select count(*) from public.advisor_read_expenses(v_cli)) = 3,
    'S11: advisor_read_expenses [NULL] returns ALL rows';
  assert (select count(*) from public.advisor_read_expenses(v_cli, date '2026-05-01')) = 2,
    'S11: advisor_read_expenses windowed to 2026-05 returns only that month';
  assert (select count(*) from public.advisor_read_budget_line_month_overrides(v_cli)) = 2,
    'S11: advisor_read_budget_line_month_overrides [NULL] returns ALL rows';
  assert (select count(*) from public.advisor_read_budget_line_month_overrides(
            v_cli, date '2026-06-01')) = 1,
    'S11: overrides windowed to 2026-06 returns only that year_month';
  perform public._cgp2_cleanup();
  raise notice 'SCENARIO 11: PASS (windowed vs all for the 2 param''d RPCs)';
end $$;

-- ===========================================================================
-- SCENARIO 12 — per-table CONSENTED parity: one synthetic row per surface ⇒
-- every advisor_read_* (all 10 + profile) returns exactly that row.
-- ===========================================================================
do $$
declare v_adv uuid; v_cli uuid; v_bl uuid;
begin
  v_adv := public._cgp2_mk_user('adv12@cgp2.test', '{"profile_type":"advisor"}'::jsonb);
  v_cli := public._cgp2_mk_linked_client(v_adv, 'cli12@cgp2.test');
  insert into public.advisor_client_consents (client_user_id, advisor_user_id,
    status, consent_version, purpose, consent_text)
  values (v_cli, v_adv, 'granted', 'v1', 'advisor_view', 'ok');

  insert into public.financial_expenses (user_id, amount, category, spent_at)
  values (v_cli, 10, 'food', current_date);
  insert into public.financial_investments (user_id, name) values (v_cli, 'Brokerage');
  insert into public.financial_goals (user_id, title, target_amount) values (v_cli, 'House', 100000);
  insert into public.financial_budget_lines (user_id, category, cadence, amount)
  values (v_cli, 'Rent', 'monthly', 1000) returning id into v_bl;
  insert into public.financial_budget_line_month_overrides
    (user_id, budget_line_id, year_month, amount)
  values (v_cli, v_bl, to_char(current_date, 'YYYY-MM'), 1200);
  insert into public.financial_cash_accounts (user_id, name) values (v_cli, 'Savings');
  insert into public.financial_liabilities (user_id, name) values (v_cli, 'Card');
  insert into public.financial_cpf_balances (user_id) values (v_cli);
  insert into public.financial_housing_loans (user_id, principal, annual_nominal_rate,
    term_months, completion_month, first_payment_month)
  values (v_cli, 500000, 0.03, 300, '2027-01', '2027-02');
  insert into public.financial_vehicles (user_id) values (v_cli);

  perform public._cgp2_act_as(v_adv);
  assert (select count(*) from public.advisor_read_expenses(v_cli)) = 1
     and (select count(*) from public.advisor_read_investments(v_cli)) = 1
     and (select count(*) from public.advisor_read_goals(v_cli)) = 1
     and (select count(*) from public.advisor_read_budget_lines(v_cli)) = 1
     and (select count(*) from public.advisor_read_budget_line_month_overrides(v_cli)) = 1
     and (select count(*) from public.advisor_read_cash_accounts(v_cli)) = 1
     and (select count(*) from public.advisor_read_liabilities(v_cli)) = 1
     and (select count(*) from public.advisor_read_cpf_balances(v_cli)) = 1
     and (select count(*) from public.advisor_read_housing_loans(v_cli)) = 1
     and (select count(*) from public.advisor_read_vehicles(v_cli)) = 1
     and (select count(*) from public.advisor_read_profile(v_cli)) = 1,
    'S12: every advisor_read_* returns the consented client row';
  perform public._cgp2_cleanup();
  raise notice 'SCENARIO 12: PASS (consented -> all 11 surfaces return rows)';
end $$;

-- Human-readable ship gate (read this row in the SQL editor output).
select public.verify_consent_gated_access() as ship_gate;

-- ===========================================================================
-- Teardown — remove synthetic users (+ cascade) and helper functions.
-- ===========================================================================
select public._cgp2_cleanup();
drop function if exists public._cgp2_mk_linked_client(uuid, text);
drop function if exists public._cgp2_mk_user(text, jsonb);
drop function if exists public._cgp2_act_as(uuid);
drop function if exists public._cgp2_cleanup();
