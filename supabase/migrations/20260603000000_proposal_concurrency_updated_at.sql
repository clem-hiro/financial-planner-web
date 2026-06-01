-- Proposal optimistic-concurrency support (P2 — conflict-on-accept).
--
-- financial_budget_lines / financial_goals lacked updated_at, so the accept
-- writer had no per-entity version token to guard a baseline that moved
-- between suggest and accept. Add the column + a shared BEFORE-UPDATE trigger
-- (financial_investments already has one from init, carried through the
-- financial_* rename). financial_profiles already has updated_at but no
-- trigger — add one so a client profile edit also bumps the token.
-- enforce_client_data_rls fires only on CREATE TABLE/POLICY, so adding
-- columns/triggers here does not trip it; no policy added => the consent
-- audit is unaffected.
--
-- Forward-only, idempotent. Operator-applied in the Supabase SQL editor.

begin;

alter table public.financial_budget_lines
  add column if not exists updated_at timestamptz not null default now();

alter table public.financial_goals
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_row_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at on public.financial_profiles;
create trigger set_updated_at
  before update on public.financial_profiles
  for each row execute function public.set_row_updated_at();

drop trigger if exists set_updated_at on public.financial_budget_lines;
create trigger set_updated_at
  before update on public.financial_budget_lines
  for each row execute function public.set_row_updated_at();

drop trigger if exists set_updated_at on public.financial_goals;
create trigger set_updated_at
  before update on public.financial_goals
  for each row execute function public.set_row_updated_at();

commit;
