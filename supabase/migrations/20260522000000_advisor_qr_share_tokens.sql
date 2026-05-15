-- Advisor QR-share tokens: single-use, expiring deeplinks to /login pre-filled with the access key.
-- TTL literal `15 minutes` mirrors src/config/deeplink.ts (QR_DEEPLINK_EXPIRY_MS).
-- Cleanup window literal `1 day` is best-effort housekeeping; rows past expiry are unusable anyway.

begin;

create table if not exists public.advisor_qr_share_tokens (
  token text primary key,
  access_key text not null references public.advisor_access_keys (access_key) on delete cascade,
  advisor_user_id uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists advisor_qr_share_tokens_advisor_idx
  on public.advisor_qr_share_tokens (advisor_user_id, created_at desc);

create index if not exists advisor_qr_share_tokens_cleanup_idx
  on public.advisor_qr_share_tokens (expires_at);

-- Partial index covering the TS-layer "peek for existing live token" SELECT and the
-- kill-prior UPDATE inside mint_qr_share_token.
create index if not exists advisor_qr_share_tokens_active_idx
  on public.advisor_qr_share_tokens (advisor_user_id, access_key)
  where consumed_at is null;

alter table public.advisor_qr_share_tokens enable row level security;

-- Advisors can read their own tokens. Used by the TS-layer peek path (Fix A) and a future audit-log UI.
drop policy if exists "advisor_qr_share_tokens_select_own" on public.advisor_qr_share_tokens;
create policy "advisor_qr_share_tokens_select_own"
  on public.advisor_qr_share_tokens
  for select
  to authenticated
  using (advisor_user_id = (select auth.uid()));

-- Writes go exclusively through SECURITY DEFINER RPCs below; no INSERT/UPDATE/DELETE policy
-- is granted to authenticated callers.

-- ---------------------------------------------------------------------------
-- Peek RPC (Fix B): read-only check from /login GET. Safe under link-preview prefetch.
-- Returns the access_key if the token is alive, NULL otherwise. Does not mutate.
-- ---------------------------------------------------------------------------
create or replace function public.peek_qr_share_token(p_token text)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select access_key
  from public.advisor_qr_share_tokens
  where token = p_token
    and consumed_at is null
    and expires_at > now();
$$;

grant execute on function public.peek_qr_share_token(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Consume RPC: atomic single-use claim. After Fix B, this is called from the
-- signup submit server action (POST) rather than from the /login server render (GET).
-- Returns the underlying access_key on success, NULL on miss (invalid/expired/consumed).
-- ---------------------------------------------------------------------------
create or replace function public.consume_qr_share_token(p_token text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
begin
  -- Probabilistic cleanup keeps the table small without a cron dependency.
  if random() < 0.01 then
    delete from public.advisor_qr_share_tokens
    where expires_at < now() - interval '1 day';
  end if;

  update public.advisor_qr_share_tokens
  set consumed_at = now()
  where token = p_token
    and consumed_at is null
    and expires_at > now()
  returning access_key into v_key;

  return v_key;
end;
$$;

grant execute on function public.consume_qr_share_token(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Mint RPC: advisor-side insert, with belt-and-braces ownership check.
-- Primary trust gate is RLS on advisor_access_keys; this re-asserts it server-side.
-- ---------------------------------------------------------------------------
create or replace function public.mint_qr_share_token(
  p_token text,
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

  if not exists (
    select 1 from public.advisor_access_keys
    where access_key = p_access_key
      and advisor_user_id = p_advisor_user_id
      and status = 'available'
  ) then
    raise exception 'access_key not available for this advisor';
  end if;

  -- Retire any prior unconsumed tokens for this (advisor, key) — pressing "Show QR"
  -- or "Refresh QR" with no prior peek hit invalidates the previously-displayed code.
  -- Bounds replay window to one active QR per key.
  update public.advisor_qr_share_tokens
  set consumed_at = now()
  where advisor_user_id = p_advisor_user_id
    and access_key = p_access_key
    and consumed_at is null
    and expires_at > now();

  insert into public.advisor_qr_share_tokens (token, access_key, advisor_user_id, expires_at)
  values (p_token, p_access_key, p_advisor_user_id, p_expires_at);
end;
$$;

grant execute on function public.mint_qr_share_token(text, text, uuid, timestamptz) to authenticated;

commit;
