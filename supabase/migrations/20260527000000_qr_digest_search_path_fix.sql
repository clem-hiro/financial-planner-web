-- P0 fix: repo↔prod divergence in the QR SECURITY DEFINER functions.
--
-- 20260523000000 declared peek_qr_share_token / redeem_qr_share_token with
-- `set search_path = public` and called digest() UNqualified, on the (now
-- disproven) assumption that "no `extensions` schema exists in this deployment".
-- Verified on the serving DB:
--   select extnamespace::regnamespace from pg_extension where extname='pgcrypto';
--   -> extensions
-- pgcrypto lives in `extensions` on prod, so digest() is NOT on the functions'
-- search_path (public only) and every peek/redeem errors -> QR scan + client
-- signup break on any env created from the repo. Prod currently works only via
-- an out-of-band operator hotfix; this migration makes the repo authoritative
-- again and reconciles fresh/redeployed environments.
--
-- Fix: `create or replace` BOTH functions with byte-identical bodies from
-- 20260523000000, changing ONLY `set search_path = public`
-- -> `set search_path = public, extensions`. This resolves digest() whether
-- pgcrypto is in `public` (repo-lineage / local dev DBs) or `extensions`
-- (prod). Hard-qualifying `extensions.digest(...)` is deliberately NOT done:
-- it would break every dev DB where pgcrypto is in `public` (standing
-- invariant). mint_qr_share_token does not call digest() (it receives the
-- precomputed hash) and is intentionally left unchanged.

begin;

-- ---------------------------------------------------------------------------
-- Peek RPC (read-only, anon-callable) — body verbatim from 20260523000000,
-- search_path widened to resolve digest() regardless of pgcrypto's schema.
-- ---------------------------------------------------------------------------
create or replace function public.peek_qr_share_token(p_token text)
returns table (access_key text, advisor_display_name text)
language sql
security definer
set search_path = public, extensions
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
-- Redeem RPC (trigger-only, atomic single-use claim) — body verbatim from
-- 20260523000000, search_path widened.
-- ---------------------------------------------------------------------------
create or replace function public.redeem_qr_share_token(p_token text, p_claimed_by uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
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

commit;
