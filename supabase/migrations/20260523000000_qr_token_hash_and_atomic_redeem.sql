-- QR-share hardening (P0 + P1-a/b/d).
-- P1-a: store only sha256(token) at rest; the raw token lives solely in the QR URL.
-- P0:   token redemption moves INTO handle_new_user so consume + key-claim + bind
--       share ONE auth-insert transaction; a replay rolls back instead of double-binding.
-- P1-b: peek now returns the issuing advisor's display name for the client scan view.
-- P1-d: mint serializes concurrent mints for the same (advisor, key) via FOR UPDATE.
--
-- One-time data note: advisor_qr_share_tokens rows are <=15-min ephemeral, so the
-- PK type change (token -> token_hash) truncates rather than backfills. Live QR
-- codes invalidate once on deploy; advisors re-Show QR (no data loss).

begin;

-- pgcrypto already created UNqualified in 20260517100000/20260518000000/
-- 20260519000000 → it lives in `public`. digest() is called unqualified under
-- the functions' `set search_path = public` (same proven pattern as the
-- unqualified gen_random_bytes(16) at 20260517100000:557). No `extensions`
-- schema exists in this deployment — qualifying it would error every redeem/peek.
create extension if not exists pgcrypto;

-- (a)+(b) ephemeral truncate, then swap the PK column to the hash + add the
-- idempotent-claim audit column. Dropping `token` drops the PK constraint with it.
truncate table public.advisor_qr_share_tokens;

alter table public.advisor_qr_share_tokens
  drop column token,
  add column token_hash text,
  add column claimed_by_user_id uuid references auth.users (id) on delete set null;

alter table public.advisor_qr_share_tokens
  add constraint advisor_qr_share_tokens_pkey primary key (token_hash);

-- Existing indexes (advisor_idx, cleanup_idx, active_idx) reference advisor_user_id /
-- access_key / expires_at / consumed_at only — none referenced `token`, so none need
-- recreation. The new PK provides the unique index for token_hash lookups.

-- ---------------------------------------------------------------------------
-- Peek RPC (P1-b): read-only, anon-callable. Returns the access key plus the
-- issuing advisor's display name so the client scan view can show who they are
-- connecting with. Setof (0 or 1 row); NULL display name coalesced to a default.
-- ---------------------------------------------------------------------------
drop function if exists public.peek_qr_share_token(text);

create function public.peek_qr_share_token(p_token text)
returns table (access_key text, advisor_display_name text)
language sql
security definer
set search_path = public
stable
as $$
  select
    t.access_key,
    coalesce(nullif(trim(coalesce(fp.display_name, '')), ''), 'your advisor')
  from public.advisor_qr_share_tokens t
  left join public.financial_profiles fp
    on fp.id = t.advisor_user_id
   and fp.profile_type = 'advisor'
  where t.token_hash = encode(digest(p_token, 'sha256'), 'hex')
    and t.consumed_at is null
    and t.expires_at > now();
$$;

grant execute on function public.peek_qr_share_token(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Redeem RPC (P0): atomic single-use claim, called ONLY from handle_new_user so
-- consume + key-claim + client->advisor bind are one transaction. The conditional
-- `consumed_at is null` UPDATE on a PK row is the idempotent claim guard: a replay
-- updates 0 rows -> RAISE -> the auth-insert txn rolls back (fail-closed). Not
-- granted to anon/authenticated — trigger-only.
-- ---------------------------------------------------------------------------
create or replace function public.redeem_qr_share_token(p_token text, p_claimed_by uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
begin
  update public.advisor_qr_share_tokens
  set consumed_at = now(),
      claimed_by_user_id = p_claimed_by
  where token_hash = encode(digest(p_token, 'sha256'), 'hex')
    and consumed_at is null
    and expires_at > now()
  returning access_key into v_key;

  if v_key is null then
    raise exception 'qr_token_invalid';
  end if;

  return v_key;
end;
$$;

revoke all on function public.redeem_qr_share_token(text, uuid) from public;

-- ---------------------------------------------------------------------------
-- Mint RPC: advisor-side insert. Now accepts the hash (raw token never reaches
-- the DB). P1-d: lock the access-key row FOR UPDATE so two concurrent mints for
-- the same (advisor, key) serialize — the loser retires the winner's token and
-- inserts its own, leaving exactly one live token per key (was: `if not exists`
-- race that could leave two live tokens).
-- ---------------------------------------------------------------------------
drop function if exists public.mint_qr_share_token(text, text, uuid, timestamptz);

create function public.mint_qr_share_token(
  p_token_hash text,
  p_access_key text,
  p_advisor_user_id uuid,
  p_expires_at timestamptz
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_advisor_user_id <> (select auth.uid()) then
    raise exception 'caller is not the advisor';
  end if;

  perform 1
  from public.advisor_access_keys
  where access_key = p_access_key
    and advisor_user_id = p_advisor_user_id
    and status = 'available'
  for update;

  if not found then
    raise exception 'access_key not available for this advisor';
  end if;

  -- Retire any prior unconsumed tokens for this (advisor, key) — bounds the
  -- replay window to one active QR per key.
  update public.advisor_qr_share_tokens
  set consumed_at = now()
  where advisor_user_id = p_advisor_user_id
    and access_key = p_access_key
    and consumed_at is null
    and expires_at > now();

  insert into public.advisor_qr_share_tokens (token_hash, access_key, advisor_user_id, expires_at)
  values (p_token_hash, p_access_key, p_advisor_user_id, p_expires_at);
end;
$$;

grant execute on function public.mint_qr_share_token(text, text, uuid, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- handle_new_user: ADDITIVE qr_token branch only. Based on the latest definition
-- (20260517110000_drop_phone_mirror_columns.sql). The access_key path, the
-- advisor path, and the phone_e164 invariant (untouched) are byte-for-byte
-- unchanged — the only addition is deriving v_key from qr_token (atomic redeem)
-- BEFORE the existing `if v_key <> ''` claim/bind block.
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

  -- ADDITIVE: single-use QR token. Redeem atomically in this same auth-insert
  -- txn; a replay/expired/invalid token RAISEs 'qr_token_invalid' and rolls the
  -- whole signup back (fail-closed). Falls through to the unchanged key-claim
  -- logic with the derived access key.
  if coalesce(new.raw_user_meta_data ->> 'qr_token', '') <> '' then
    v_key := upper(trim(public.redeem_qr_share_token(
      new.raw_user_meta_data ->> 'qr_token',
      new.id
    )));
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

-- (h) the separate pre-signup consume path is removed (no fail-open fallback).
drop function if exists public.consume_qr_share_token(text);

commit;
