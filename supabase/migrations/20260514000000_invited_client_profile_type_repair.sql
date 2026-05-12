-- Invited users must have profile_type = 'client' for advisor roster + middleware.
-- Some rows were stored as advisor (e.g. wrong signup tab) while keys were still claimed.
-- Also harden handle_new_user: non-empty access_key always uses the client path.

begin;

-- ---------------------------------------------------------------------------
-- One-time repair: claimed key => client row
-- ---------------------------------------------------------------------------
update public.financial_profiles fp
set
  profile_type = 'client',
  onboarding_required = case
    when fp.onboarding_completed_at is not null then fp.onboarding_required
    else true
  end,
  onboarding_step = case
    when fp.onboarding_completed_at is not null then fp.onboarding_step
    when fp.onboarding_step is not null then fp.onboarding_step
    else 1
  end
where fp.profile_type = 'advisor'
  and exists (
    select 1
    from public.advisor_access_keys a
    where a.claimed_by_user_id = fp.id
      and a.status = 'claimed'
  );

-- ---------------------------------------------------------------------------
-- handle_new_user: key in metadata wins over profile_type
-- ---------------------------------------------------------------------------
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

commit;
