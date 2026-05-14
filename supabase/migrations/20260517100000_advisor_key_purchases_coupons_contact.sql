-- Advisor key purchases, coupon-backed POC fulfillment, and verified WhatsApp contact.
-- Product code 0001 is the first paid access-key pack surface.

begin;

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'purchase_status') then
    create type public.purchase_status as enum (
      'pending',
      'paid',
      'fulfilled',
      'failed',
      'refunded'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'payment_provider') then
    create type public.payment_provider as enum ('mock', 'stripe');
  end if;
end;
$$;

alter table public.financial_profiles
  add column if not exists phone_e164 text,
  add column if not exists phone_verified_at timestamptz;

alter table public.financial_profiles
  drop constraint if exists financial_profiles_phone_e164_check,
  add constraint financial_profiles_phone_e164_check
    check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{1,14}$');

comment on column public.financial_profiles.phone_e164 is
  'Advisor contact phone number in E.164 format. Clients can only access a derived WhatsApp link through get_my_advisor_contact().';
comment on column public.financial_profiles.phone_verified_at is
  'Set after Supabase phone OTP verification succeeds for the advisor account.';

create table if not exists public.pricing (
  product_code text primary key,
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'SGD' check (currency = upper(currency) and length(currency) = 3),
  updated_at timestamptz not null default now()
);

comment on table public.pricing is
  'Product catalogue for purchasable advisor features. Initial access-key product_code is 0001.';

insert into public.pricing (product_code, price_cents, currency)
values ('0001', 100, 'SGD')
on conflict (product_code) do update
set
  price_cents = excluded.price_cents,
  currency = excluded.currency,
  updated_at = now();

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  advisor_user_id uuid references auth.users (id) on delete cascade,
  code text not null,
  kind text not null check (kind in ('discount_percent', 'free_keys')),
  discount_percent integer not null default 0 check (discount_percent between 0 and 100),
  free_key_quantity integer check (free_key_quantity is null or free_key_quantity > 0),
  remaining_redemptions integer check (remaining_redemptions is null or remaining_redemptions >= 0),
  expires_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  constraint coupons_code_format_check check (code = upper(code) and code ~ '^[A-Z0-9_-]{3,64}$'),
  constraint coupons_kind_payload_check check (
    (kind = 'discount_percent' and discount_percent > 0 and free_key_quantity is null)
    or
    (kind = 'free_keys' and discount_percent = 0 and free_key_quantity is not null)
  )
);

create unique index if not exists coupons_global_code_unique_idx
  on public.coupons (code)
  where advisor_user_id is null;

create unique index if not exists coupons_advisor_code_unique_idx
  on public.coupons (advisor_user_id, code)
  where advisor_user_id is not null;

create index if not exists coupons_advisor_lookup_idx
  on public.coupons (advisor_user_id, code);

comment on table public.coupons is
  'Advisor coupons. Codes may be global or scoped to one advisor; redemption is fulfilled through RPCs only.';

insert into public.coupons (
  advisor_user_id,
  code,
  kind,
  discount_percent,
  free_key_quantity,
  remaining_redemptions,
  expires_at
)
values (null, 'POCUNLIMITED', 'discount_percent', 100, null, null, null)
on conflict do nothing;

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  advisor_user_id uuid not null references auth.users (id) on delete cascade,
  product_code text not null references public.pricing (product_code),
  idempotency_key text not null,
  requested_quantity integer not null check (requested_quantity > 0),
  free_key_quantity integer not null default 0 check (free_key_quantity >= 0),
  paid_key_quantity integer not null default 0 check (paid_key_quantity >= 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  gross_cents integer not null check (gross_cents >= 0),
  discount_cents integer not null default 0 check (discount_cents >= 0),
  net_cents integer not null check (net_cents >= 0),
  currency text not null default 'SGD' check (currency = upper(currency) and length(currency) = 3),
  coupon_id uuid references public.coupons (id) on delete set null,
  payment_provider public.payment_provider not null default 'mock',
  payment_intent_id text,
  status public.purchase_status not null default 'pending',
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  fulfilled_at timestamptz,
  constraint purchases_quantity_balance_check check (free_key_quantity + paid_key_quantity = requested_quantity),
  constraint purchases_idempotency_key_check check (length(trim(idempotency_key)) between 8 and 120),
  constraint purchases_advisor_idempotency_unique unique (advisor_user_id, idempotency_key)
);

create index if not exists purchases_advisor_created_at_idx
  on public.purchases (advisor_user_id, created_at desc);

comment on table public.purchases is
  'Advisor access-key purchase records. The mock provider keeps the flow Stripe-compatible until Stripe is enabled.';

create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  advisor_user_id uuid not null references auth.users (id) on delete cascade,
  coupon_id uuid not null references public.coupons (id) on delete restrict,
  purchase_id uuid not null references public.purchases (id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  constraint coupon_redemptions_purchase_unique unique (purchase_id)
);

create index if not exists coupon_redemptions_advisor_redeemed_at_idx
  on public.coupon_redemptions (advisor_user_id, redeemed_at desc);

create table if not exists public.coupon_validation_attempts (
  id uuid primary key default gen_random_uuid(),
  advisor_user_id uuid not null references auth.users (id) on delete cascade,
  attempted_at timestamptz not null default now()
);

create index if not exists coupon_validation_attempts_advisor_time_idx
  on public.coupon_validation_attempts (advisor_user_id, attempted_at desc);

alter table public.advisor_access_keys
  add column if not exists purchase_id uuid references public.purchases (id) on delete set null;

create index if not exists advisor_access_keys_purchase_id_idx
  on public.advisor_access_keys (purchase_id);

comment on column public.advisor_access_keys.purchase_id is
  'Purchase that fulfilled this access key, if created through the purchase RPC.';

alter table public.pricing enable row level security;
alter table public.coupons enable row level security;
alter table public.purchases enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.coupon_validation_attempts enable row level security;

drop policy if exists "pricing_select_authenticated" on public.pricing;
drop policy if exists "pricing_insert_deny" on public.pricing;
drop policy if exists "pricing_update_deny" on public.pricing;
drop policy if exists "pricing_delete_deny" on public.pricing;
create policy "pricing_select_authenticated"
  on public.pricing for select to authenticated using (true);
create policy "pricing_insert_deny"
  on public.pricing for insert to authenticated with check (false);
create policy "pricing_update_deny"
  on public.pricing for update to authenticated using (false) with check (false);
create policy "pricing_delete_deny"
  on public.pricing for delete to authenticated using (false);

drop policy if exists "coupons_select_deny" on public.coupons;
drop policy if exists "coupons_insert_deny" on public.coupons;
drop policy if exists "coupons_update_deny" on public.coupons;
drop policy if exists "coupons_delete_deny" on public.coupons;
create policy "coupons_select_deny"
  on public.coupons for select to authenticated using (false);
create policy "coupons_insert_deny"
  on public.coupons for insert to authenticated with check (false);
create policy "coupons_update_deny"
  on public.coupons for update to authenticated using (false) with check (false);
create policy "coupons_delete_deny"
  on public.coupons for delete to authenticated using (false);

drop policy if exists "purchases_select_own" on public.purchases;
drop policy if exists "purchases_insert_deny" on public.purchases;
drop policy if exists "purchases_update_deny" on public.purchases;
drop policy if exists "purchases_delete_deny" on public.purchases;
create policy "purchases_select_own"
  on public.purchases for select to authenticated
  using (advisor_user_id = (select auth.uid()));
create policy "purchases_insert_deny"
  on public.purchases for insert to authenticated with check (false);
create policy "purchases_update_deny"
  on public.purchases for update to authenticated using (false) with check (false);
create policy "purchases_delete_deny"
  on public.purchases for delete to authenticated using (false);

drop policy if exists "coupon_redemptions_select_own" on public.coupon_redemptions;
drop policy if exists "coupon_redemptions_insert_deny" on public.coupon_redemptions;
drop policy if exists "coupon_redemptions_update_deny" on public.coupon_redemptions;
drop policy if exists "coupon_redemptions_delete_deny" on public.coupon_redemptions;
create policy "coupon_redemptions_select_own"
  on public.coupon_redemptions for select to authenticated
  using (advisor_user_id = (select auth.uid()));
create policy "coupon_redemptions_insert_deny"
  on public.coupon_redemptions for insert to authenticated with check (false);
create policy "coupon_redemptions_update_deny"
  on public.coupon_redemptions for update to authenticated using (false) with check (false);
create policy "coupon_redemptions_delete_deny"
  on public.coupon_redemptions for delete to authenticated using (false);

drop policy if exists "coupon_validation_attempts_select_deny" on public.coupon_validation_attempts;
drop policy if exists "coupon_validation_attempts_insert_deny" on public.coupon_validation_attempts;
drop policy if exists "coupon_validation_attempts_update_deny" on public.coupon_validation_attempts;
drop policy if exists "coupon_validation_attempts_delete_deny" on public.coupon_validation_attempts;
create policy "coupon_validation_attempts_select_deny"
  on public.coupon_validation_attempts for select to authenticated using (false);
create policy "coupon_validation_attempts_insert_deny"
  on public.coupon_validation_attempts for insert to authenticated with check (false);
create policy "coupon_validation_attempts_update_deny"
  on public.coupon_validation_attempts for update to authenticated using (false) with check (false);
create policy "coupon_validation_attempts_delete_deny"
  on public.coupon_validation_attempts for delete to authenticated using (false);

create or replace function public.validate_coupon_for_purchase(
  p_product_code text,
  p_quantity integer,
  p_coupon_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_product_code text := upper(trim(coalesce(p_product_code, '')));
  v_coupon_code text := upper(trim(coalesce(p_coupon_code, '')));
  v_price public.pricing%rowtype;
  v_coupon public.coupons%rowtype;
  v_free_quantity integer := 0;
  v_paid_quantity integer := 0;
  v_gross_cents integer := 0;
  v_discount_cents integer := 0;
  v_net_cents integer := 0;
  v_attempts integer := 0;
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
    limit 1;

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

  return jsonb_build_object(
    'ok', true,
    'product_code', v_price.product_code,
    'quantity', p_quantity,
    'currency', v_price.currency,
    'unit_price_cents', v_price.price_cents,
    'free_key_quantity', v_free_quantity,
    'paid_key_quantity', v_paid_quantity,
    'gross_cents', v_gross_cents,
    'discount_cents', v_discount_cents,
    'net_cents', v_net_cents,
    'coupon_code', nullif(v_coupon_code, '')
  );
end;
$$;

create or replace function public.fulfill_access_key_purchase(
  p_product_code text,
  p_quantity integer,
  p_idempotency_key text,
  p_coupon_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
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

create or replace function public.get_my_advisor_contact()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_advisor uuid;
  v_name text;
  v_phone text;
  v_verified_at timestamptz;
  v_digits text;
begin
  if v_user is null then
    return jsonb_build_object('available', false, 'message', 'Sign in required.');
  end if;

  select p.advisor_user_id into v_advisor
  from public.financial_profiles p
  where p.id = v_user
    and p.profile_type = 'client';

  if v_advisor is null then
    return jsonb_build_object('available', false, 'message', 'Advisor contact is unavailable.');
  end if;

  select
    nullif(trim(coalesce(p.display_name, '')), ''),
    p.phone_e164,
    p.phone_verified_at
    into v_name, v_phone, v_verified_at
  from public.financial_profiles p
  where p.id = v_advisor
    and p.profile_type = 'advisor';

  if v_phone is null or v_verified_at is null then
    return jsonb_build_object('available', false, 'message', 'Advisor WhatsApp contact is not available yet.');
  end if;

  v_digits := regexp_replace(v_phone, '\D', '', 'g');

  return jsonb_build_object(
    'available', true,
    'advisor_name', coalesce(v_name, 'Your advisor'),
    'whatsapp_url', 'https://wa.me/' || v_digits
  );
end;
$$;

revoke all on function public.validate_coupon_for_purchase(text, integer, text) from public;
grant execute on function public.validate_coupon_for_purchase(text, integer, text) to authenticated;

revoke all on function public.fulfill_access_key_purchase(text, integer, text, text) from public;
grant execute on function public.fulfill_access_key_purchase(text, integer, text, text) to authenticated;

revoke all on function public.get_my_advisor_contact() from public;
grant execute on function public.get_my_advisor_contact() to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_type text;
  v_key text;
  v_key_id uuid;
  v_advisor uuid;
  v_phone text;
begin
  v_key := upper(trim(coalesce(new.raw_user_meta_data ->> 'access_key', '')));
  v_profile_type := lower(trim(coalesce(new.raw_user_meta_data ->> 'profile_type', '')));
  if v_profile_type not in ('advisor', 'client') then
    v_profile_type := 'advisor';
  end if;

  if v_key <> '' then
    select a.id, a.advisor_user_id
      into v_key_id, v_advisor
    from public.advisor_access_keys a
    where a.access_key = v_key
      and a.status = 'available'
      and (a.expires_at is null or a.expires_at > now())
    for update;

    if v_key_id is null then
      raise exception 'Invalid, already used, or expired access key. Ask your advisor for a new key.';
    end if;

    update public.advisor_access_keys
    set
      status = 'claimed',
      claimed_by_user_id = new.id,
      claimed_at = now()
    where id = v_key_id;

    insert into public.financial_profiles (
      id,
      display_name,
      onboarding_required,
      onboarding_step,
      profile_type,
      advisor_user_id
    )
    values (
      new.id,
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      true,
      1,
      'client',
      v_advisor
    );
  elsif v_profile_type = 'client' then
    raise exception 'Client signup requires an access key from your financial advisor.';
  else
    v_phone := nullif(trim(coalesce(new.raw_user_meta_data ->> 'phone_e164', '')), '');
    if v_phone is not null and v_phone !~ '^\+[1-9][0-9]{1,14}$' then
      v_phone := null;
    end if;

    insert into public.financial_profiles (
      id,
      display_name,
      onboarding_required,
      onboarding_step,
      profile_type,
      advisor_user_id,
      phone_e164,
      phone_verified_at
    )
    values (
      new.id,
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      false,
      null,
      'advisor',
      null,
      v_phone,
      null
    );
  end if;

  return new;
end;
$$;

commit;
