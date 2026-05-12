-- Advisor / client roles, advisor-issued access keys, and signup gating (POC).
-- Existing users become advisors; new client signups require a valid unused key.

begin;

-- ---------------------------------------------------------------------------
-- financial_profiles: role + optional link to issuing advisor (clients)
-- ---------------------------------------------------------------------------
alter table public.financial_profiles
  add column if not exists profile_type text not null default 'advisor'
    constraint financial_profiles_profile_type_check
      check (profile_type in ('advisor', 'client')),
  add column if not exists advisor_user_id uuid references auth.users (id) on delete set null;

comment on column public.financial_profiles.profile_type is
  'advisor: self-serve planner; client: invited via advisor access key.';
comment on column public.financial_profiles.advisor_user_id is
  'For clients: auth user id of the advisor who issued the key used at signup.';

-- ---------------------------------------------------------------------------
-- advisor_access_keys
-- ---------------------------------------------------------------------------
create table if not exists public.advisor_access_keys (
  id uuid primary key default gen_random_uuid(),
  advisor_user_id uuid not null references auth.users (id) on delete cascade,
  access_key text not null,
  status text not null default 'available'
    constraint advisor_access_keys_status_check
      check (status in ('available', 'claimed', 'expired')),
  claimed_by_user_id uuid references auth.users (id) on delete set null,
  claimed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  constraint advisor_access_keys_access_key_unique unique (access_key)
);

create index if not exists advisor_access_keys_advisor_user_id_idx
  on public.advisor_access_keys (advisor_user_id);

create index if not exists advisor_access_keys_status_idx
  on public.advisor_access_keys (advisor_user_id, status);

comment on table public.advisor_access_keys is
  'POC: free keys per advisor; future monetization may add purchases / pools.';

-- ---------------------------------------------------------------------------
-- RLS: advisors manage only their keys; no cross-advisor reads
-- ---------------------------------------------------------------------------
alter table public.advisor_access_keys enable row level security;

drop policy if exists "advisor_access_keys_select_own" on public.advisor_access_keys;
drop policy if exists "advisor_access_keys_insert_own" on public.advisor_access_keys;
drop policy if exists "advisor_access_keys_update_own" on public.advisor_access_keys;

create policy "advisor_access_keys_select_own"
  on public.advisor_access_keys
  for select
  using (advisor_user_id = (select auth.uid()));

create policy "advisor_access_keys_insert_own"
  on public.advisor_access_keys
  for insert
  with check (advisor_user_id = (select auth.uid()));

create policy "advisor_access_keys_update_own"
  on public.advisor_access_keys
  for update
  using (advisor_user_id = (select auth.uid()))
  with check (advisor_user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Optional pre-signup validation (anon + authenticated execute only)
-- ---------------------------------------------------------------------------
create or replace function public.validate_client_access_key_for_signup(p_key text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_norm text := upper(trim(coalesce(p_key, '')));
begin
  if length(v_norm) < 8 then
    return false;
  end if;
  return exists (
    select 1
    from public.advisor_access_keys a
    where a.access_key = v_norm
      and a.status = 'available'
      and (a.expires_at is null or a.expires_at > now())
  );
end;
$$;

revoke all on function public.validate_client_access_key_for_signup(text) from public;
grant execute on function public.validate_client_access_key_for_signup(text) to anon;
grant execute on function public.validate_client_access_key_for_signup(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Auth trigger: create financial_profiles + claim key for clients
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
      true,
      1,
      'advisor',
      null
    );
  end if;

  return new;
end;
$$;

commit;
