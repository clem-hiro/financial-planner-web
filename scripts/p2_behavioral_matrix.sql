-- Phase-2 behavioral matrix — runs in ONE psql session inside a single
-- BEGIN…ROLLBACK (psql honors manual tx; nothing persists — intrinsic reset).
-- Fixtures are created the REAL way: advisor + client signed up through the
-- genuine on_auth_user_created → handle_new_user path with an UPPERCASE-hex
-- access key (handle_new_user upper()-cases the supplied key before lookup —
-- storing it uppercase is the prior-session fix). Reuses the S1–S6 + ship-gate
-- assertion logic from supabase/tests/advisor_consent_scenarios.sql. Loud:
-- every scenario `raise notice 'SCENARIO n: PASS'` or `assert`→exception.

\set ON_ERROR_STOP on

begin;

do $$
declare
  v_adv  uuid := gen_random_uuid();
  v_cli  uuid := gen_random_uuid();
  v_key  text := upper(replace(gen_random_uuid()::text, '-', '')); -- UPPERCASE hex
  v_bl   uuid;
  v_m    date;
  v_inc  numeric;
begin
  -- ---- advisor signup (no key needed) ----
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin
  ) values (
    '00000000-0000-0000-0000-000000000000', v_adv, 'authenticated',
    'authenticated', 'p2pp_adv@cgp2.test', 'x', now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"profile_type":"advisor"}'::jsonb, false
  );

  -- advisor owns an access key (UPPERCASE hex; status defaults 'available')
  insert into public.advisor_access_keys (advisor_user_id, access_key)
  values (v_adv, v_key);

  -- ---- client signup via the genuine handle_new_user access-key path ----
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data, is_super_admin
  ) values (
    '00000000-0000-0000-0000-000000000000', v_cli, 'authenticated',
    'authenticated', 'p2pp_cli@cgp2.test', 'x', now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('profile_type','client','access_key', v_key), false
  );
  -- handle_new_user has now claimed the key + bound the real linkage.
  assert (select advisor_user_id from public.financial_profiles where id = v_cli) = v_adv,
    'SETUP: client must be bound to the advisor via the real handle_new_user path';
  update public.financial_profiles set monthly_income = 8888 where id = v_cli;

  -- one real row per surface so granted⇒populated is meaningful
  insert into public.financial_expenses (user_id, amount, category, spent_at)
  values (v_cli, 10, 'food', current_date);
  insert into public.financial_investments (user_id, name) values (v_cli, 'Brokerage');
  insert into public.financial_goals (user_id, title, target_amount) values (v_cli, 'House', 100000);
  insert into public.financial_budget_lines (user_id, category, cadence, amount)
  values (v_cli, 'Rent', 'monthly', 1000) returning id into v_bl;
  insert into public.financial_budget_line_month_overrides (user_id, budget_line_id, year_month, amount)
  values (v_cli, v_bl, to_char(current_date,'YYYY-MM'), 1200);
  insert into public.financial_cash_accounts (user_id, name) values (v_cli, 'Savings');
  insert into public.financial_liabilities (user_id, name) values (v_cli, 'Card');
  insert into public.financial_cpf_balances (user_id) values (v_cli);
  insert into public.financial_housing_loans (user_id, principal, annual_nominal_rate,
    term_months, completion_month, first_payment_month)
  values (v_cli, 500000, 0.03, 300, '2027-01', '2027-02');
  insert into public.financial_vehicles (user_id) values (v_cli);

  perform set_config('request.jwt.claims',
                     json_build_object('sub', v_adv::text)::text, true);
  perform set_config('request.jwt.claim.sub', v_adv::text, true);

  -- ===== S1: withdrawn-latest ⇒ deny, every surface empty =====
  insert into public.advisor_client_consents (client_user_id, advisor_user_id,
    status, consent_version, purpose, consent_text)
  values (v_cli, v_adv, 'withdrawn', '_cgp2_probe', 'advisor_view', 'probe');
  assert public.advisor_can_read_client(v_cli) = false, 'S1: withdrawn must deny';
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
    'S1: every advisor_read_* must be empty when not consented';
  delete from public.advisor_client_consents where consent_version = '_cgp2_probe';
  raise notice 'SCENARIO 1: PASS (withdrawn-latest -> all surfaces empty)';

  -- ===== S2: granted ⇒ per-table parity (returns the client's real rows) =====
  insert into public.advisor_client_consents (client_user_id, advisor_user_id,
    status, consent_version, purpose, consent_text)
  values (v_cli, v_adv, 'granted', '_cgp2_probe', 'advisor_view', 'probe');
  assert public.advisor_can_read_client(v_cli) = true, 'S2: granted must allow';
  assert (select count(*) from public.advisor_read_expenses(v_cli))
       = (select count(*) from public.financial_expenses where user_id=v_cli)
     and (select count(*) from public.advisor_read_goals(v_cli))
       = (select count(*) from public.financial_goals where user_id=v_cli)
     and (select count(*) from public.advisor_read_budget_lines(v_cli))
       = (select count(*) from public.financial_budget_lines where user_id=v_cli)
     and (select count(*) from public.advisor_read_budget_line_month_overrides(v_cli))
       = (select count(*) from public.financial_budget_line_month_overrides where user_id=v_cli)
     and (select count(*) from public.advisor_read_cash_accounts(v_cli))
       = (select count(*) from public.financial_cash_accounts where user_id=v_cli)
     and (select count(*) from public.advisor_read_liabilities(v_cli))
       = (select count(*) from public.financial_liabilities where user_id=v_cli)
     and (select count(*) from public.advisor_read_cpf_balances(v_cli))
       = (select count(*) from public.financial_cpf_balances where user_id=v_cli)
     and (select count(*) from public.advisor_read_housing_loans(v_cli))
       = (select count(*) from public.financial_housing_loans where user_id=v_cli)
     and (select count(*) from public.advisor_read_vehicles(v_cli))
       = (select count(*) from public.financial_vehicles where user_id=v_cli)
     and (select count(*) from public.advisor_read_profile(v_cli)) = 1,
    'S2: per-table CONSENTED parity (advisor_read_<t> == direct table count)';
  delete from public.advisor_client_consents where consent_version = '_cgp2_probe';
  raise notice 'SCENARIO 2: PASS (granted -> per-table real-schema parity)';

  -- ===== S3: C1 same-tick determinism (monotonic seq tie-break) =====
  insert into public.advisor_client_consents (client_user_id, advisor_user_id,
    status, consent_version, purpose, consent_text)
  values (v_cli, v_adv, 'granted',   '_cgp2_probe', 'advisor_view', 'probe'),
         (v_cli, v_adv, 'withdrawn', '_cgp2_probe', 'advisor_view', 'probe');
  assert public.advisor_can_read_client(v_cli) = false,
    'S3: same-tick grant->withdraw must DENY (later seq wins)';
  delete from public.advisor_client_consents where consent_version = '_cgp2_probe';
  insert into public.advisor_client_consents (client_user_id, advisor_user_id,
    status, consent_version, purpose, consent_text)
  values (v_cli, v_adv, 'withdrawn', '_cgp2_probe', 'advisor_view', 'probe'),
         (v_cli, v_adv, 'granted',   '_cgp2_probe', 'advisor_view', 'probe');
  assert public.advisor_can_read_client(v_cli) = true,
    'S3: same-tick withdraw->grant must ALLOW (later seq wins)';
  delete from public.advisor_client_consents where consent_version = '_cgp2_probe';
  raise notice 'SCENARIO 3: PASS (C1 same-tick resolves deterministically by seq)';

  -- ===== S4: roster identity-only for non-consented =====
  insert into public.advisor_client_consents (client_user_id, advisor_user_id,
    status, consent_version, purpose, consent_text)
  values (v_cli, v_adv, 'withdrawn', '_cgp2_probe', 'advisor_view', 'probe');
  select monthly_income into v_inc
  from public.advisor_client_list_metrics(200,0,null,'created_desc') where id=v_cli;
  assert v_inc is null, 'S4: NON-consented roster row must have NULL monthly_income';
  assert public.advisor_client_list_count(null) >= 1,
    'S4: count includes the linked client regardless of consent';
  delete from public.advisor_client_consents where consent_version = '_cgp2_probe';
  insert into public.advisor_client_consents (client_user_id, advisor_user_id,
    status, consent_version, purpose, consent_text)
  values (v_cli, v_adv, 'granted', '_cgp2_probe', 'advisor_view', 'probe');
  select monthly_income into v_inc
  from public.advisor_client_list_metrics(200,0,null,'created_desc') where id=v_cli;
  assert v_inc = 8888, 'S4: CONSENTED roster row must show the real monthly_income';
  delete from public.advisor_client_consents where consent_version = '_cgp2_probe';
  raise notice 'SCENARIO 4: PASS (roster identity-only for non-consented)';

  -- ===== S5: advisor_linked_client consent-independent; profile gated =====
  insert into public.advisor_client_consents (client_user_id, advisor_user_id,
    status, consent_version, purpose, consent_text)
  values (v_cli, v_adv, 'withdrawn', '_cgp2_probe', 'advisor_view', 'probe');
  assert (select count(*) from public.advisor_linked_client(v_cli)) = 1,
    'S5: advisor_linked_client returns linked client (consent-INDEPENDENT)';
  assert (select count(*) from public.advisor_read_profile(v_cli)) = 0,
    'S5: advisor_read_profile is 0 when not consented (gated)';
  assert (select count(*) from public.advisor_linked_client(gen_random_uuid())) = 0,
    'S5: advisor_linked_client 0 for a non-linked id (auth.uid scoped)';
  delete from public.advisor_client_consents where consent_version = '_cgp2_probe';
  insert into public.advisor_client_consents (client_user_id, advisor_user_id,
    status, consent_version, purpose, consent_text)
  values (v_cli, v_adv, 'granted', '_cgp2_probe', 'advisor_view', 'probe');
  assert (select count(*) from public.advisor_read_profile(v_cli)) = 1,
    'S5: advisor_read_profile returns the profile when consented';
  delete from public.advisor_client_consents where consent_version = '_cgp2_probe';
  raise notice 'SCENARIO 5: PASS (linkage consent-independent; profile gated)';

  -- ===== S6: windowed RPC parity on the real schema =====
  insert into public.advisor_client_consents (client_user_id, advisor_user_id,
    status, consent_version, purpose, consent_text)
  values (v_cli, v_adv, 'granted', '_cgp2_probe', 'advisor_view', 'probe');
  assert (select count(*) from public.advisor_read_expenses(v_cli))
       = (select count(*) from public.financial_expenses where user_id=v_cli),
    'S6: advisor_read_expenses [NULL] = all client expenses';
  select max(spent_at) into v_m from public.financial_expenses where user_id=v_cli;
  assert (select count(*) from public.advisor_read_expenses(v_cli, v_m))
       = (select count(*) from public.financial_expenses
            where user_id=v_cli
              and (v_m is null
                   or (spent_at >= date_trunc('month', v_m)::date
                       and spent_at < (date_trunc('month', v_m)
                                       + interval '1 month')::date))),
    'S6: advisor_read_expenses windowed = direct-windowed count';
  assert (select count(*) from public.advisor_read_budget_line_month_overrides(v_cli))
       = (select count(*) from public.financial_budget_line_month_overrides where user_id=v_cli),
    'S6: advisor_read_budget_line_month_overrides [NULL] = all rows';
  delete from public.advisor_client_consents where consent_version = '_cgp2_probe';
  raise notice 'SCENARIO 6: PASS (windowed RPC parity on real schema)';

  raise notice 'ALL SCENARIOS PASSED';
end $$;

-- Ship gate — data-independent structural proof (the primary gate).
do $$
begin
  assert public.verify_consent_gated_access() = 'OK',
    'SHIP GATE: verify_consent_gated_access() must return OK';
  raise notice 'SCENARIO 7: PASS (ship gate OK — all surfaces consent-gated)';
end $$;
select public.verify_consent_gated_access() as ship_gate;

-- Intrinsic reset: nothing from this matrix persists.
rollback;
