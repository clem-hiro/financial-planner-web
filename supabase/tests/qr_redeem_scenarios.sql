-- QR-hardening trigger/RLS scenario matrix — executable, self-asserting.
--
-- WHY this is SQL, not vitest: the repo has no DB integration harness and the
-- P0 invariant lives in the handle_new_user auth-insert trigger; it is only
-- meaningfully testable against a real Postgres (decision: option 3, no new dep).
--
-- HOW to run: against a SCRATCH Supabase/Postgres (NOT shared prod), as the
-- owner/service role (the trigger is security definer):
--     psql "$SCRATCH_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/qr_redeem_scenarios.sql
-- Every scenario is wrapped begin … rollback so nothing persists. Each block
-- RAISE NOTICE 'SCENARIO n: PASS' on success; a failed `assert` aborts with the
-- scenario's message. Record input → expected → actual → pass/fail per run.
--
-- Scenario 6 (concurrent mint, P1-d) is two-session — see supabase/tests/README.md.
-- Scenario 7 (P1-c) is a code-level invariant (peekExistingLiveToken removed) —
-- verified by absence, see README; no single-session SQL assertion.

-- Session-scoped helper: insert an auth.users row (fires handle_new_user).
-- encrypted_password is opaque text here — the trigger never reads it.
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

\set raw_token '''TESTtoken0123456789ABC'''
-- token_hash everywhere = encode(digest(:raw_token,'sha256'),'hex')

-- ===========================================================================
-- SCENARIO 1 — valid token, signup success
-- ===========================================================================
begin;
do $$
declare
  v_adv uuid;
  v_cli uuid;
  v_raw text := 'TESTtoken0123456789ABC';
begin
  v_adv := pg_temp.mk_user('adv1@scn.test',
    '{"profile_type":"advisor","display_name":"Jane Advisor"}'::jsonb);
  insert into public.advisor_access_keys (advisor_user_id, access_key)
  values (v_adv, 'ABCDEF0123456789');
  insert into public.advisor_qr_share_tokens (token_hash, access_key, advisor_user_id, expires_at)
  values (encode(digest(v_raw,'sha256'),'hex'), 'ABCDEF0123456789', v_adv, now() + interval '15 min');

  v_cli := pg_temp.mk_user('cli1@scn.test',
    jsonb_build_object('profile_type','client','qr_token', v_raw));

  assert (select profile_type from public.financial_profiles where id = v_cli) = 'client',
    'S1: client profile not created as client';
  assert (select advisor_user_id from public.financial_profiles where id = v_cli) = v_adv,
    'S1: client not bound to issuing advisor';
  assert (select status from public.advisor_access_keys where access_key='ABCDEF0123456789') = 'claimed',
    'S1: access key not claimed';
  assert (select consumed_at is not null and claimed_by_user_id = v_cli
          from public.advisor_qr_share_tokens
          where token_hash = encode(digest(v_raw,'sha256'),'hex')),
    'S1: token not consumed / claimed_by not set';
  raise notice 'SCENARIO 1: PASS (valid token -> bound, key claimed, token consumed+claimed_by)';
end $$;
rollback;

-- ===========================================================================
-- SCENARIO 2 — valid token, signUp raises (dup email) -> FULL ROLLBACK
-- The BEFORE trigger redeems, then the email unique constraint fails -> the
-- whole statement (incl. the redeem) rolls back. token stays unconsumed.
-- ===========================================================================
begin;
do $$
declare
  v_adv uuid;
  v_raw text := 'TESTtoken0123456789ABC';
  v_hash text;
begin
  v_hash := encode(digest(v_raw,'sha256'),'hex');
  v_adv := pg_temp.mk_user('adv2@scn.test', '{"profile_type":"advisor"}'::jsonb);
  insert into public.advisor_access_keys (advisor_user_id, access_key)
  values (v_adv, 'ABCDEF0123456789');
  insert into public.advisor_qr_share_tokens (token_hash, access_key, advisor_user_id, expires_at)
  values (v_hash, 'ABCDEF0123456789', v_adv, now() + interval '15 min');

  -- occupy the email so the client signup collides
  perform pg_temp.mk_user('dup@scn.test', '{"profile_type":"advisor"}'::jsonb);

  begin
    perform pg_temp.mk_user('dup@scn.test',
      jsonb_build_object('profile_type','client','qr_token', v_raw));
    raise exception 'S2: expected unique_violation did not occur';
  exception when unique_violation then
    null;  -- subtransaction rolled back: redeem undone with it
  end;

  assert (select consumed_at is null from public.advisor_qr_share_tokens where token_hash = v_hash),
    'S2: token consumed despite rolled-back signup (FAIL-OPEN regression)';
  assert not exists (select 1 from public.financial_profiles fp
                     join auth.users u on u.id = fp.id
                     where u.email = 'dup@scn.test' and fp.profile_type = 'client'),
    'S2: a client profile leaked from the failed signup';
  raise notice 'SCENARIO 2: PASS (dup-email signUp rolled back; token still unconsumed)';
end $$;
rollback;

-- ===========================================================================
-- SCENARIO 3 — expired token -> trigger RAISE, signup fails, token untouched
-- ===========================================================================
begin;
do $$
declare
  v_adv uuid;
  v_raw text := 'TESTtoken0123456789ABC';
  v_hash text;
begin
  v_hash := encode(digest(v_raw,'sha256'),'hex');
  v_adv := pg_temp.mk_user('adv3@scn.test', '{"profile_type":"advisor"}'::jsonb);
  insert into public.advisor_access_keys (advisor_user_id, access_key)
  values (v_adv, 'ABCDEF0123456789');
  insert into public.advisor_qr_share_tokens (token_hash, access_key, advisor_user_id, expires_at)
  values (v_hash, 'ABCDEF0123456789', v_adv, now() - interval '1 min');  -- EXPIRED

  begin
    perform pg_temp.mk_user('cli3@scn.test',
      jsonb_build_object('profile_type','client','qr_token', v_raw));
    raise exception 'S3: expected qr_token_invalid did not occur';
  exception when others then
    assert sqlerrm like '%qr_token_invalid%', 'S3: wrong error: ' || sqlerrm;
  end;

  assert (select consumed_at is null from public.advisor_qr_share_tokens where token_hash = v_hash),
    'S3: expired token was consumed';
  raise notice 'SCENARIO 3: PASS (expired token -> qr_token_invalid, untouched)';
end $$;
rollback;

-- ===========================================================================
-- SCENARIO 4 — replay (already consumed, different email) -> RAISE, no 2nd bind
-- ===========================================================================
begin;
do $$
declare
  v_adv uuid;
  v_cli1 uuid;
  v_raw text := 'TESTtoken0123456789ABC';
  v_hash text;
begin
  v_hash := encode(digest(v_raw,'sha256'),'hex');
  v_adv := pg_temp.mk_user('adv4@scn.test', '{"profile_type":"advisor"}'::jsonb);
  insert into public.advisor_access_keys (advisor_user_id, access_key)
  values (v_adv, 'ABCDEF0123456789');
  insert into public.advisor_qr_share_tokens (token_hash, access_key, advisor_user_id, expires_at)
  values (v_hash, 'ABCDEF0123456789', v_adv, now() + interval '15 min');

  v_cli1 := pg_temp.mk_user('cli4a@scn.test',
    jsonb_build_object('profile_type','client','qr_token', v_raw));  -- consumes

  begin
    perform pg_temp.mk_user('cli4b@scn.test',
      jsonb_build_object('profile_type','client','qr_token', v_raw));  -- replay
    raise exception 'S4: replay unexpectedly succeeded';
  exception when others then
    assert sqlerrm like '%qr_token_invalid%', 'S4: wrong error: ' || sqlerrm;
  end;

  assert (select claimed_by_user_id from public.advisor_qr_share_tokens where token_hash = v_hash) = v_cli1,
    'S4: original claim was overwritten';
  assert (select count(*) from public.financial_profiles
          where advisor_user_id = v_adv and profile_type = 'client') = 1,
    'S4: a second binding was created';
  raise notice 'SCENARIO 4: PASS (replay raised; single binding intact)';
end $$;
rollback;

-- ===========================================================================
-- SCENARIO 5 — double-submit same token + same email -> exactly one binding
-- ===========================================================================
begin;
do $$
declare
  v_adv uuid;
  v_raw text := 'TESTtoken0123456789ABC';
begin
  v_adv := pg_temp.mk_user('adv5@scn.test', '{"profile_type":"advisor"}'::jsonb);
  insert into public.advisor_access_keys (advisor_user_id, access_key)
  values (v_adv, 'ABCDEF0123456789');
  insert into public.advisor_qr_share_tokens (token_hash, access_key, advisor_user_id, expires_at)
  values (encode(digest(v_raw,'sha256'),'hex'), 'ABCDEF0123456789', v_adv, now() + interval '15 min');

  perform pg_temp.mk_user('cli5@scn.test',
    jsonb_build_object('profile_type','client','qr_token', v_raw));  -- 1st: binds

  begin
    perform pg_temp.mk_user('cli5@scn.test',
      jsonb_build_object('profile_type','client','qr_token', v_raw));  -- 2nd: same email+token
    raise exception 'S5: duplicate submit unexpectedly succeeded';
  exception when others then
    null;  -- email unique_violation OR qr_token_invalid — either way rejected
  end;

  assert (select count(*) from public.financial_profiles
          where advisor_user_id = v_adv and profile_type = 'client') = 1,
    'S5: double-submit produced more than one binding';
  raise notice 'SCENARIO 5: PASS (double-submit -> exactly one binding)';
end $$;
rollback;

-- ===========================================================================
-- SCENARIO 6 — concurrent two mints, same key (P1-d). TWO SESSIONS — see README.
-- After both commit, exactly one live token row for the (advisor,key):
--   select count(*) from public.advisor_qr_share_tokens
--   where advisor_user_id = :adv and access_key = :key and consumed_at is null;  -- expect 1
-- ===========================================================================

-- ===========================================================================
-- SCENARIO 7 — P1-c (key claimed via non-QR path then render).
-- CODE-LEVEL INVARIANT, verified by absence: peekExistingLiveToken is removed;
-- buildShareData always mints fresh and mint's `FOR UPDATE ... status=available`
-- check rejects a non-available key. No single-session SQL assertion — see README.
-- ===========================================================================

-- ===========================================================================
-- SCENARIO 8 — non-QR manual access-key signup unchanged (regression guard)
-- ===========================================================================
begin;
do $$
declare
  v_adv uuid;
  v_cli uuid;
begin
  v_adv := pg_temp.mk_user('adv8@scn.test', '{"profile_type":"advisor"}'::jsonb);
  insert into public.advisor_access_keys (advisor_user_id, access_key)
  values (v_adv, 'ABCDEF0123456789');

  v_cli := pg_temp.mk_user('cli8@scn.test',
    '{"profile_type":"client","access_key":"ABCDEF0123456789"}'::jsonb);  -- NO qr_token

  assert (select profile_type from public.financial_profiles where id = v_cli) = 'client'
     and (select advisor_user_id from public.financial_profiles where id = v_cli) = v_adv,
    'S8: manual-key client not bound (additive branch broke access_key path)';
  assert (select status from public.advisor_access_keys where access_key='ABCDEF0123456789') = 'claimed',
    'S8: manual-key not claimed';
  raise notice 'SCENARIO 8: PASS (manual access-key path unchanged)';
end $$;
rollback;

-- ===========================================================================
-- SCENARIO 9 — advisor signup unchanged (regression guard)
-- ===========================================================================
begin;
do $$
declare
  v_adv uuid;
begin
  v_adv := pg_temp.mk_user('adv9@scn.test',
    '{"profile_type":"advisor","display_name":"Solo Advisor"}'::jsonb);
  assert (select profile_type from public.financial_profiles where id = v_adv) = 'advisor',
    'S9: advisor profile not created as advisor';
  assert (select advisor_user_id from public.financial_profiles where id = v_adv) is null,
    'S9: advisor unexpectedly bound to an advisor_user_id';
  raise notice 'SCENARIO 9: PASS (advisor signup unchanged)';
end $$;
rollback;

-- ===========================================================================
-- SCENARIO 10 — token leak (P1-a): only token_hash at rest, raw never stored
-- ===========================================================================
begin;
do $$
declare
  v_adv uuid;
  v_raw text := 'TESTtoken0123456789ABC';
begin
  v_adv := pg_temp.mk_user('adv10@scn.test', '{"profile_type":"advisor"}'::jsonb);
  insert into public.advisor_access_keys (advisor_user_id, access_key)
  values (v_adv, 'ABCDEF0123456789');
  insert into public.advisor_qr_share_tokens (token_hash, access_key, advisor_user_id, expires_at)
  values (encode(digest(v_raw,'sha256'),'hex'), 'ABCDEF0123456789', v_adv, now() + interval '15 min');

  assert not exists (select 1 from information_schema.columns
    where table_schema='public' and table_name='advisor_qr_share_tokens' and column_name='token'),
    'S10: legacy raw `token` column still exists';
  assert (select count(*) from public.advisor_qr_share_tokens where token_hash = v_raw) = 0,
    'S10: raw token value found stored in token_hash';
  assert (select token_hash from public.advisor_qr_share_tokens where advisor_user_id = v_adv)
       = encode(digest(v_raw,'sha256'),'hex'),
    'S10: token_hash is not sha256(raw) hex';
  raise notice 'SCENARIO 10: PASS (only sha256 hash at rest; raw absent)';
end $$;
rollback;
