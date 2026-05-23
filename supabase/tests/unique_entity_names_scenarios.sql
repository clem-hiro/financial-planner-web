-- Per-user unique entity-name constraint — executable, self-asserting matrix.
-- Verifies supabase/migrations/20260623000000_unique_entity_names.sql.
--
-- WHY this is SQL, not vitest: the repo has no DB integration harness
-- (supabase/tests/README.md) and the invariant lives in functional unique
-- indexes `lower(btrim(<col>))` — only meaningfully testable against a real
-- Postgres. Vitest covers the JS-side normalization parity
-- (src/lib/validation.test.ts); this covers the DB enforcement.
--
-- HOW to run: against a SCRATCH Supabase/Postgres (NOT shared prod), as the
-- owner/service role, AFTER the migration has been applied to that scratch DB:
--     psql "$SCRATCH_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/unique_entity_names_scenarios.sql
-- Every scenario is wrapped begin … rollback so nothing persists. Each block
-- RAISE NOTICE 'SCENARIO n: PASS' on success; a failed `assert` aborts with the
-- scenario's message. Record input → expected → actual → pass/fail per run.

-- Session-scoped helper: insert an auth.users row (fires handle_new_user, which
-- creates the matching public.financial_profiles row the FK requires). An
-- advisor profile is a valid user_id for any user-scoped table — using advisors
-- avoids the access-key/QR client-signup branch of the trigger.
create or replace function pg_temp.mk_user(p_email text)
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
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"profile_type":"advisor","display_name":"Scn Advisor"}'::jsonb, false
  );
  return v_id;
end;
$fn$;

-- ===========================================================================
-- SCENARIO 1 — all seven unique indexes exist (migration applied cleanly)
-- ===========================================================================
begin;
do $$
declare
  v_expected text[] := array[
    'financial_investments_user_name_ci_uq',
    'financial_goals_user_name_ci_uq',
    'financial_liabilities_user_name_ci_uq',
    'financial_properties_user_name_ci_uq',
    'financial_cash_accounts_user_name_ci_uq',
    'financial_housing_loans_user_name_ci_uq',
    'financial_vehicles_user_name_ci_uq'
  ];
  v_name text;
begin
  foreach v_name in array v_expected loop
    assert exists (
      select 1 from pg_indexes
      where schemaname = 'public' and indexname = v_name
    ), 'S1: missing unique index ' || v_name;
  end loop;
  raise notice 'SCENARIO 1: PASS (all 7 *_user_name_ci_uq indexes present)';
end $$;
rollback;

-- ===========================================================================
-- SCENARIO 2 — exact duplicate name, same user -> rejected (23505)
-- ===========================================================================
begin;
do $$
declare
  v_u uuid;
  v_raised boolean := false;
begin
  v_u := pg_temp.mk_user('s2@scn.test');
  insert into public.financial_investments (user_id, name) values (v_u, 'ilp2');
  begin
    insert into public.financial_investments (user_id, name) values (v_u, 'ilp2');
  exception when unique_violation then v_raised := true;
  end;
  assert v_raised, 'S2: exact duplicate name was NOT rejected';
  raise notice 'SCENARIO 2: PASS (exact duplicate rejected)';
end $$;
rollback;

-- ===========================================================================
-- SCENARIO 3 — case-insensitive collision (ILP2 vs ilp2) -> rejected
-- ===========================================================================
begin;
do $$
declare
  v_u uuid;
  v_raised boolean := false;
begin
  v_u := pg_temp.mk_user('s3@scn.test');
  insert into public.financial_investments (user_id, name) values (v_u, 'ILP2');
  begin
    insert into public.financial_investments (user_id, name) values (v_u, 'ilp2');
  exception when unique_violation then v_raised := true;
  end;
  assert v_raised, 'S3: case-insensitive collision was NOT rejected';
  raise notice 'SCENARIO 3: PASS (ILP2 vs ilp2 rejected)';
end $$;
rollback;

-- ===========================================================================
-- SCENARIO 4 — whitespace collision ("  ilp2 " vs "ilp2") -> rejected
-- ===========================================================================
begin;
do $$
declare
  v_u uuid;
  v_raised boolean := false;
begin
  v_u := pg_temp.mk_user('s4@scn.test');
  insert into public.financial_investments (user_id, name) values (v_u, 'ilp2');
  begin
    insert into public.financial_investments (user_id, name) values (v_u, '  ilp2 ');
  exception when unique_violation then v_raised := true;
  end;
  assert v_raised, 'S4: leading/trailing-whitespace collision was NOT rejected';
  raise notice 'SCENARIO 4: PASS ("  ilp2 " vs "ilp2" rejected)';
end $$;
rollback;

-- ===========================================================================
-- SCENARIO 5 — genuinely distinct name, same user -> allowed
-- ===========================================================================
begin;
do $$
declare
  v_u uuid;
begin
  v_u := pg_temp.mk_user('s5@scn.test');
  insert into public.financial_investments (user_id, name) values (v_u, 'ilp2');
  insert into public.financial_investments (user_id, name) values (v_u, 'ilp3');
  assert (select count(*) from public.financial_investments where user_id = v_u) = 2,
    'S5: distinct names were not both inserted';
  raise notice 'SCENARIO 5: PASS (ilp2 + ilp3 both inserted)';
end $$;
rollback;

-- ===========================================================================
-- SCENARIO 6 — same name, DIFFERENT users -> allowed (per-user scoping)
-- ===========================================================================
begin;
do $$
declare
  v_a uuid;
  v_b uuid;
begin
  v_a := pg_temp.mk_user('s6a@scn.test');
  v_b := pg_temp.mk_user('s6b@scn.test');
  insert into public.financial_investments (user_id, name) values (v_a, 'ilp2');
  insert into public.financial_investments (user_id, name) values (v_b, 'ilp2');
  assert (select count(*) from public.financial_investments
          where name = 'ilp2' and user_id in (v_a, v_b)) = 2,
    'S6: same name across two users was wrongly rejected';
  raise notice 'SCENARIO 6: PASS (same name, two users -> both allowed)';
end $$;
rollback;

-- ===========================================================================
-- SCENARIO 7 — cash account: same name, DIFFERENT purpose, same user
--              -> rejected (purpose is ignored, per locked decision)
-- ===========================================================================
begin;
do $$
declare
  v_u uuid;
  v_raised boolean := false;
begin
  v_u := pg_temp.mk_user('s7@scn.test');
  insert into public.financial_cash_accounts (user_id, name, purpose)
  values (v_u, 'Savings', 'emergency_fund');
  begin
    insert into public.financial_cash_accounts (user_id, name, purpose)
    values (v_u, 'savings', 'short_term_savings');
  exception when unique_violation then v_raised := true;
  end;
  assert v_raised, 'S7: cash-account collision across purposes was NOT rejected';
  raise notice 'SCENARIO 7: PASS (cash account name collides regardless of purpose)';
end $$;
rollback;

-- ===========================================================================
-- SCENARIO 8 — goal: title case-insensitive collision -> rejected
--              (covers the title-column index, not just name)
-- ===========================================================================
begin;
do $$
declare
  v_u uuid;
  v_raised boolean := false;
begin
  v_u := pg_temp.mk_user('s8@scn.test');
  insert into public.financial_goals (user_id, title, target_amount)
  values (v_u, 'House', 100000);
  begin
    insert into public.financial_goals (user_id, title, target_amount)
    values (v_u, ' HOUSE ', 200000);
  exception when unique_violation then v_raised := true;
  end;
  assert v_raised, 'S8: goal title collision (case+whitespace) was NOT rejected';
  raise notice 'SCENARIO 8: PASS (goal title "House" vs " HOUSE " rejected)';
end $$;
rollback;
