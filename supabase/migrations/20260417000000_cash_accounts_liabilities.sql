-- Cash buckets and liabilities for net worth (assets − debt)

create table public.cash_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  balance numeric(14, 2) not null default 0 check (balance >= 0),
  created_at timestamptz not null default now()
);

create index cash_accounts_user_id_idx on public.cash_accounts (user_id);

create table public.liabilities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  balance numeric(14, 2) not null default 0 check (balance >= 0),
  created_at timestamptz not null default now()
);

create index liabilities_user_id_idx on public.liabilities (user_id);

alter table public.cash_accounts enable row level security;
alter table public.liabilities enable row level security;

create policy "cash_accounts_select_own" on public.cash_accounts
  for select using (user_id = auth.uid());

create policy "cash_accounts_insert_own" on public.cash_accounts
  for insert with check (user_id = auth.uid());

create policy "cash_accounts_update_own" on public.cash_accounts
  for update using (user_id = auth.uid());

create policy "cash_accounts_delete_own" on public.cash_accounts
  for delete using (user_id = auth.uid());

create policy "liabilities_select_own" on public.liabilities
  for select using (user_id = auth.uid());

create policy "liabilities_insert_own" on public.liabilities
  for insert with check (user_id = auth.uid());

create policy "liabilities_update_own" on public.liabilities
  for update using (user_id = auth.uid());

create policy "liabilities_delete_own" on public.liabilities
  for delete using (user_id = auth.uid());
