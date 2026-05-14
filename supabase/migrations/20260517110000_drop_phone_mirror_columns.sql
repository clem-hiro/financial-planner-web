-- Option C — single source of truth for advisor phone is auth.users.
-- Drop the financial_profiles.phone_e164 + phone_verified_at mirror columns.
-- get_my_advisor_contact() now reads phone directly from auth.users.
-- handle_new_user() stops consuming raw_user_meta_data.phone_e164
-- (the signup form no longer collects phone; advisors verify it via OTP
--  on /advisor/profile, which writes auth.users.phone via Supabase Auth).

begin;

create or replace function public.get_my_advisor_contact()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog, auth
as $$
declare
  v_user uuid := auth.uid();
  v_advisor uuid;
  v_name text;
  v_phone text;
  v_confirmed timestamptz;
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

  select nullif(trim(coalesce(p.display_name, '')), '')
    into v_name
  from public.financial_profiles p
  where p.id = v_advisor
    and p.profile_type = 'advisor';

  select u.phone, u.phone_confirmed_at
    into v_phone, v_confirmed
  from auth.users u
  where u.id = v_advisor;

  if v_phone is null or v_confirmed is null then
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
      false,
      null,
      'advisor',
      null
    );
  end if;

  return new;
end;
$$;

alter table public.financial_profiles
  drop constraint if exists financial_profiles_phone_e164_check;

alter table public.financial_profiles
  drop column if exists phone_e164,
  drop column if exists phone_verified_at;

commit;
