-- Monthly / annual budget lines and expense spend_period

alter table public.expenses
  add column if not exists spend_period text not null default 'monthly'
    check (spend_period in ('monthly', 'annual'));

create table public.budget_lines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  category text not null,
  cadence text not null check (cadence in ('monthly', 'annual')),
  amount numeric(14, 2) not null check (amount >= 0),
  calendar_year int,
  created_at timestamptz not null default now(),
  constraint budget_lines_year_matches_cadence check (
    (cadence = 'monthly' and calendar_year is null)
    or (cadence = 'annual' and calendar_year is not null)
  )
);

create unique index budget_lines_monthly_uidx
  on public.budget_lines (user_id, lower(trim(category)))
  where cadence = 'monthly';

create unique index budget_lines_annual_uidx
  on public.budget_lines (user_id, calendar_year, lower(trim(category)))
  where cadence = 'annual';

create index budget_lines_user_id_idx on public.budget_lines (user_id);

alter table public.budget_lines enable row level security;

create policy "budget_lines_select_own" on public.budget_lines
  for select using (user_id = auth.uid());

create policy "budget_lines_insert_own" on public.budget_lines
  for insert with check (user_id = auth.uid());

create policy "budget_lines_update_own" on public.budget_lines
  for update using (user_id = auth.uid());

create policy "budget_lines_delete_own" on public.budget_lines
  for delete using (user_id = auth.uid());
