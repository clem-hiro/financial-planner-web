-- Personal Finance MVP schema: profiles, expenses, investments, financial_goals + RLS

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  monthly_income numeric(14, 2),
  base_currency text not null default 'USD',
  created_at timestamptz not null default now()
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount numeric(14, 2) not null check (amount >= 0),
  category text not null default 'uncategorized',
  spent_at date not null default (current_date),
  note text,
  created_at timestamptz not null default now()
);

create index expenses_user_spent_at_idx on public.expenses (user_id, spent_at desc);

create table public.investments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  current_value numeric(14, 2) not null default 0 check (current_value >= 0),
  monthly_contribution numeric(14, 2) not null default 0 check (monthly_contribution >= 0),
  expected_annual_return numeric(5, 4) not null default 0
    check (expected_annual_return >= 0 and expected_annual_return <= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.financial_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  target_amount numeric(14, 2) not null check (target_amount > 0),
  target_date date,
  linked_investment_id uuid references public.investments (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.expenses enable row level security;
alter table public.investments enable row level security;
alter table public.financial_goals enable row level security;

create policy "profiles_select_own" on public.profiles
  for select using (id = auth.uid());

create policy "profiles_insert_own" on public.profiles
  for insert with check (id = auth.uid());

create policy "profiles_update_own" on public.profiles
  for update using (id = auth.uid());

create policy "expenses_select_own" on public.expenses
  for select using (user_id = auth.uid());

create policy "expenses_insert_own" on public.expenses
  for insert with check (user_id = auth.uid());

create policy "expenses_update_own" on public.expenses
  for update using (user_id = auth.uid());

create policy "expenses_delete_own" on public.expenses
  for delete using (user_id = auth.uid());

create policy "investments_select_own" on public.investments
  for select using (user_id = auth.uid());

create policy "investments_insert_own" on public.investments
  for insert with check (user_id = auth.uid());

create policy "investments_update_own" on public.investments
  for update using (user_id = auth.uid());

create policy "investments_delete_own" on public.investments
  for delete using (user_id = auth.uid());

create policy "financial_goals_select_own" on public.financial_goals
  for select using (user_id = auth.uid());

create policy "financial_goals_insert_own" on public.financial_goals
  for insert with check (user_id = auth.uid());

create policy "financial_goals_update_own" on public.financial_goals
  for update using (user_id = auth.uid());

create policy "financial_goals_delete_own" on public.financial_goals
  for delete using (user_id = auth.uid());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.set_investments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger investments_updated_at
  before update on public.investments
  for each row execute function public.set_investments_updated_at();
