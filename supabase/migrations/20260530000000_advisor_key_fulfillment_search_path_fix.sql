-- P0 fix: repo↔prod divergence in the access-key fulfillment SECURITY DEFINER
-- function — same root-cause class as 20260527000000_qr_digest_search_path_fix
-- (which this follows as the canonical template).
--
-- 20260517100000 declared public.fulfill_access_key_purchase with
-- `set search_path = public` and calls UNqualified gen_random_bytes(16)
-- (20260517100000:557, access-key generation loop).
--
-- EMPIRICAL root cause (ground truth, not inference): the user reproduced, on
-- the live shared Supabase DB, "Purchase keys" at /advisor/buy-keys failing
-- with:
--   function gen_random_bytes(integer) does not exist (SQLSTATE 42883)
-- That observation proves pgcrypto is NOT on this function's search_path —
-- i.e. pgcrypto lives in the `extensions` schema on this DB (the 20260527000000
-- truth), and the `LEARNINGS.md [correction]` "pgcrypto in public on this
-- deployment" claim is STALE for the shared DB and must not be relied on. The
-- `select extnamespace::regnamespace from pg_extension where extname='pgcrypto'`
-- probe is now only optional confirmation, no longer load-bearing. Conclusion:
-- advisor key purchasing is BROKEN NOW on the shared DB (not latent) — high
-- priority — and on any env created from the repo.
--
-- Audit scope (task #5, docs/research/2026-05-18-pgcrypto-search-path-audit.md):
-- this is the ONLY live, unfixed pgcrypto-under-restricted-search_path offender.
-- The QR pair peek_qr_share_token / redeem_qr_share_token was the same class
-- and is already fixed by 20260527000000 (search_path = public, extensions) —
-- intentionally NOT re-touched here. No other migration calls a pgcrypto
-- function under a path excluding `extensions`.
--
-- Fix: `create or replace` public.fulfill_access_key_purchase with a body
-- BYTE-IDENTICAL to its only/latest definition on disk
-- (20260517100000_advisor_key_purchases_coupons_contact.sql:353-581 — never
-- re-defined by a later migration), changing ONLY
-- `set search_path = public` -> `set search_path = public, extensions`. This
-- resolves gen_random_bytes() whether pgcrypto is in `public` (repo-lineage /
-- local dev DBs) or `extensions` (prod). Hard-qualifying
-- `extensions.gen_random_bytes(...)` is deliberately NOT done: it would break
-- every dev DB where pgcrypto is in `public` (standing invariant, identical to
-- the rationale documented in 20260527000000). Grants/revokes are preserved
-- verbatim from 20260517100000:636-637. Idempotent and safe to re-run
-- (create-or-replace + idempotent grant/revoke); not applied here — the
-- operator applies it to prod via the Supabase SQL editor.

begin;

-- ---------------------------------------------------------------------------
-- Access-key fulfillment RPC — body verbatim from 20260517100000:353-581,
-- search_path widened to resolve gen_random_bytes() regardless of pgcrypto's
-- schema. No other change.
-- ---------------------------------------------------------------------------
create or replace function public.fulfill_access_key_purchase(
  p_product_code text,
  p_quantity integer,
  p_idempotency_key text,
  p_coupon_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user uuid := auth.uid();
  v_product_code text := upper(trim(coalesce(p_product_code, '')));
  v_coupon_code text := upper(trim(coalesce(p_coupon_code, '')));
  v_idempotency_key text := trim(coalesce(p_idempotency_key, ''));
  v_price public.pricing%rowtype;
  v_coupon public.coupons%rowtype;
  v_purchase public.purchases%rowtype;
  v_free_quantity integer := 0;
  v_paid_quantity integer := 0;
  v_gross_cents integer := 0;
  v_discount_cents integer := 0;
  v_net_cents integer := 0;
  v_attempts integer := 0;
  v_keys text[] := array[]::text[];
  v_candidate text;
  v_inserted text;
begin
  if v_user is null then
    return jsonb_build_object('ok', false, 'message', 'Sign in required.');
  end if;

  if not exists (
    select 1 from public.financial_profiles p
    where p.id = v_user and p.profile_type = 'advisor'
  ) then
    return jsonb_build_object('ok', false, 'message', 'Only financial advisors can buy access keys.');
  end if;

  if p_quantity is null or p_quantity < 1 or p_quantity > 1000 then
    return jsonb_build_object('ok', false, 'message', 'Choose between 1 and 1000 keys.');
  end if;

  if length(v_idempotency_key) < 8 or length(v_idempotency_key) > 120 then
    return jsonb_build_object('ok', false, 'message', 'Invalid purchase token. Refresh and try again.');
  end if;

  select * into v_purchase
  from public.purchases p
  where p.advisor_user_id = v_user
    and p.idempotency_key = v_idempotency_key;

  if v_purchase.id is not null then
    select coalesce(array_agg(a.access_key order by a.created_at), array[]::text[])
      into v_keys
    from public.advisor_access_keys a
    where a.purchase_id = v_purchase.id
      and a.advisor_user_id = v_user;

    return jsonb_build_object(
      'ok', true,
      'purchase_id', v_purchase.id,
      'keys', v_keys,
      'message', 'Purchase already fulfilled.'
    );
  end if;

  select * into v_price
  from public.pricing
  where product_code = v_product_code;

  if v_price.product_code is null then
    return jsonb_build_object('ok', false, 'message', 'Unknown product.');
  end if;

  v_paid_quantity := p_quantity;
  v_gross_cents := p_quantity * v_price.price_cents;
  v_net_cents := v_gross_cents;

  if v_coupon_code <> '' then
    delete from public.coupon_validation_attempts
    where attempted_at < now() - interval '1 day';

    insert into public.coupon_validation_attempts (advisor_user_id)
    values (v_user);

    select count(*) into v_attempts
    from public.coupon_validation_attempts
    where advisor_user_id = v_user
      and attempted_at > now() - interval '5 minutes';

    if v_attempts > 30 then
      return jsonb_build_object('ok', false, 'message', 'Too many coupon checks. Try again later.');
    end if;

    select * into v_coupon
    from public.coupons c
    where c.code = v_coupon_code
      and (c.advisor_user_id = v_user or c.advisor_user_id is null)
    order by c.advisor_user_id is null
    limit 1
    for update;

    if v_coupon.id is null then
      return jsonb_build_object('ok', false, 'message', 'Coupon not found.');
    end if;

    if v_coupon.archived_at is not null then
      return jsonb_build_object('ok', false, 'message', 'Coupon is no longer active.');
    end if;

    if v_coupon.expires_at is not null and v_coupon.expires_at <= now() then
      return jsonb_build_object('ok', false, 'message', 'Coupon has expired.');
    end if;

    if v_coupon.remaining_redemptions is not null and v_coupon.remaining_redemptions <= 0 then
      return jsonb_build_object('ok', false, 'message', 'Coupon has no redemptions remaining.');
    end if;

    if v_coupon.kind = 'free_keys' then
      v_free_quantity := least(p_quantity, coalesce(v_coupon.free_key_quantity, 0));
      v_paid_quantity := p_quantity - v_free_quantity;
      v_discount_cents := v_free_quantity * v_price.price_cents;
    else
      v_discount_cents := floor(v_gross_cents * v_coupon.discount_percent / 100.0)::integer;
    end if;

    v_net_cents := greatest(v_gross_cents - v_discount_cents, 0);
  end if;

  insert into public.purchases (
    advisor_user_id,
    product_code,
    idempotency_key,
    requested_quantity,
    free_key_quantity,
    paid_key_quantity,
    unit_price_cents,
    gross_cents,
    discount_cents,
    net_cents,
    currency,
    coupon_id,
    payment_provider,
    status,
    paid_at,
    fulfilled_at
  )
  values (
    v_user,
    v_price.product_code,
    v_idempotency_key,
    p_quantity,
    v_free_quantity,
    v_paid_quantity,
    v_price.price_cents,
    v_gross_cents,
    v_discount_cents,
    v_net_cents,
    v_price.currency,
    v_coupon.id,
    'mock',
    'fulfilled',
    now(),
    now()
  )
  on conflict on constraint purchases_advisor_idempotency_unique do nothing
  returning * into v_purchase;

  if v_purchase.id is null then
    select * into v_purchase
    from public.purchases p
    where p.advisor_user_id = v_user
      and p.idempotency_key = v_idempotency_key;

    select coalesce(array_agg(a.access_key order by a.created_at), array[]::text[])
      into v_keys
    from public.advisor_access_keys a
    where a.purchase_id = v_purchase.id
      and a.advisor_user_id = v_user;

    return jsonb_build_object(
      'ok', true,
      'purchase_id', v_purchase.id,
      'keys', v_keys,
      'message', 'Purchase already fulfilled.'
    );
  end if;

  if v_coupon.id is not null then
    if v_coupon.remaining_redemptions is not null then
      update public.coupons
      set remaining_redemptions = remaining_redemptions - 1
      where id = v_coupon.id
        and remaining_redemptions > 0;
    end if;

    insert into public.coupon_redemptions (advisor_user_id, coupon_id, purchase_id)
    values (v_user, v_coupon.id, v_purchase.id);
  end if;

  while coalesce(array_length(v_keys, 1), 0) < p_quantity loop
    v_inserted := null;
    v_candidate := upper(encode(gen_random_bytes(16), 'hex'));

    insert into public.advisor_access_keys (
      advisor_user_id,
      access_key,
      status,
      purchase_id
    )
    values (v_user, v_candidate, 'available', v_purchase.id)
    on conflict (access_key) do nothing
    returning access_key into v_inserted;

    if v_inserted is not null then
      v_keys := array_append(v_keys, v_inserted);
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'purchase_id', v_purchase.id,
    'keys', v_keys,
    'message', 'Access keys purchased.'
  );
end;
$$;

-- Grants preserved verbatim from 20260517100000:636-637 (idempotent).
revoke all on function public.fulfill_access_key_purchase(text, integer, text, text) from public;
grant execute on function public.fulfill_access_key_purchase(text, integer, text, text) to authenticated;

commit;
