-- Cash account purpose grouping + balance history snapshots.

alter table public.financial_cash_accounts
  add column if not exists purpose text not null default 'other',
  add column if not exists updated_at timestamptz not null default now();

alter table public.financial_cash_accounts
  drop constraint if exists financial_cash_accounts_purpose_ck;

alter table public.financial_cash_accounts
  add constraint financial_cash_accounts_purpose_ck
    check (
      purpose in (
        'emergency_fund',
        'everyday_spending',
        'short_term_savings',
        'other'
      )
    );

comment on column public.financial_cash_accounts.purpose is
  'Liquidity bucket: emergency fund, everyday spending, short-term savings, or other.';

update public.financial_cash_accounts
  set updated_at = created_at
  where updated_at < created_at;

create or replace function public.set_financial_cash_accounts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists financial_cash_accounts_updated_at on public.financial_cash_accounts;

create trigger financial_cash_accounts_updated_at
  before update on public.financial_cash_accounts
  for each row
  execute function public.set_financial_cash_accounts_updated_at();

create table if not exists public.financial_cash_account_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.financial_profiles (id) on delete cascade,
  cash_account_id uuid not null references public.financial_cash_accounts (id) on delete cascade,
  balance numeric(14, 2) not null check (balance >= 0),
  recorded_at timestamptz not null default now()
);

create index if not exists financial_cash_account_snapshots_account_recorded_idx
  on public.financial_cash_account_snapshots (cash_account_id, recorded_at desc);

create index if not exists financial_cash_account_snapshots_user_id_idx
  on public.financial_cash_account_snapshots (user_id);

comment on table public.financial_cash_account_snapshots is
  'Point-in-time cash balances recorded when accounts are created or saved.';

alter table public.financial_cash_account_snapshots enable row level security;

drop policy if exists "financial_cash_account_snapshots_select_own"
  on public.financial_cash_account_snapshots;
drop policy if exists "financial_cash_account_snapshots_insert_own"
  on public.financial_cash_account_snapshots;
drop policy if exists "financial_cash_account_snapshots_update_own"
  on public.financial_cash_account_snapshots;
drop policy if exists "financial_cash_account_snapshots_delete_own"
  on public.financial_cash_account_snapshots;

create policy "financial_cash_account_snapshots_select_own"
  on public.financial_cash_account_snapshots
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "financial_cash_account_snapshots_insert_own"
  on public.financial_cash_account_snapshots
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "financial_cash_account_snapshots_update_own"
  on public.financial_cash_account_snapshots
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "financial_cash_account_snapshots_delete_own"
  on public.financial_cash_account_snapshots
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- Advisor reads: consent-gated SECURITY DEFINER RPC (no cross-user RLS).
create or replace function public.advisor_read_cash_account_snapshots(p_client uuid)
returns setof public.financial_cash_account_snapshots
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
begin
  if not public.advisor_can_read_client(p_client) then
    return;
  end if;
  return query
    select *
    from public.financial_cash_account_snapshots
    where user_id = p_client
    order by recorded_at desc
    limit 240;
end;
$$;

revoke all on function public.advisor_read_cash_account_snapshots(uuid) from public;
grant execute on function public.advisor_read_cash_account_snapshots(uuid) to authenticated;

insert into public.financial_cash_account_snapshots (user_id, cash_account_id, balance, recorded_at)
select c.user_id, c.id, c.balance, c.created_at
from public.financial_cash_accounts c
where not exists (
  select 1
  from public.financial_cash_account_snapshots s
  where s.cash_account_id = c.id
);
