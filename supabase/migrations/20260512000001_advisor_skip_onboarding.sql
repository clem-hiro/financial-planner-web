-- Advisors skip the client onboarding wizard; clients keep onboarding_required = true.

begin;

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
  v_profile_type := lower(trim(coalesce(new.raw_user_meta_data ->> 'profile_type', '')));
  if v_profile_type not in ('advisor', 'client') then
    v_profile_type := 'advisor';
  end if;

  if v_profile_type = 'client' then
    v_key := upper(trim(coalesce(new.raw_user_meta_data ->> 'access_key', '')));
    if v_key = '' then
      raise exception 'Client signup requires an access key from your financial advisor.';
    end if;

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

-- Existing advisor accounts created before this change were forced into onboarding.
update public.financial_profiles
set
  onboarding_required = false,
  onboarding_step = null
where profile_type = 'advisor';

commit;
