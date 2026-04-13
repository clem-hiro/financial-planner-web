-- Planning milestones, CPF bucket balances + optional CPFIS, housing loans (amortizing + OA draws)

create table public.planning_milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'other' check (kind in ('home_purchase', 'other')),
  title text not null,
  notes text,
  target_month text check (target_month is null or target_month ~ '^\d{4}-\d{2}$'),
  status text not null default 'planned' check (
    status in ('planned', 'in_progress', 'done', 'cancelled')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index planning_milestones_user_id_idx on public.planning_milestones (user_id);

create table public.cpf_balances (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  oa numeric(14, 2) not null default 0 check (oa >= 0),
  sa numeric(14, 2) not null default 0 check (sa >= 0),
  ma numeric(14, 2) not null default 0 check (ma >= 0),
  oa_annual_rate numeric(8, 6),
  sa_annual_rate numeric(8, 6),
  ma_annual_rate numeric(8, 6),
  cpfis_monthly_from_oa numeric(14, 2) not null default 0 check (cpfis_monthly_from_oa >= 0),
  cpfis_notional_balance numeric(14, 2) not null default 0 check (cpfis_notional_balance >= 0),
  cpfis_annual_return numeric(8, 6) not null default 0.04 check (
    cpfis_annual_return >= 0 and cpfis_annual_return <= 1
  ),
  updated_at timestamptz not null default now()
);

create table public.housing_loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  milestone_id uuid references public.planning_milestones (id) on delete set null,
  label text not null default 'Home loan',
  principal numeric(14, 2) not null check (principal > 0),
  annual_nominal_rate numeric(8, 6) not null check (annual_nominal_rate >= 0),
  term_months integer not null check (term_months > 0 and term_months <= 600),
  completion_month text not null check (completion_month ~ '^\d{4}-\d{2}$'),
  first_payment_month text not null check (first_payment_month ~ '^\d{4}-\d{2}$'),
  downpayment_from_oa numeric(14, 2) not null default 0 check (downpayment_from_oa >= 0),
  fees_from_oa numeric(14, 2) not null default 0 check (fees_from_oa >= 0),
  oa_share_of_payment numeric(8, 6) not null default 1 check (
    oa_share_of_payment >= 0 and oa_share_of_payment <= 1
  ),
  max_oa_per_month numeric(14, 2) check (max_oa_per_month is null or max_oa_per_month >= 0),
  created_at timestamptz not null default now()
);

create index housing_loans_user_id_idx on public.housing_loans (user_id);
create index housing_loans_milestone_id_idx on public.housing_loans (milestone_id);

alter table public.planning_milestones enable row level security;
alter table public.cpf_balances enable row level security;
alter table public.housing_loans enable row level security;

create policy "planning_milestones_select_own" on public.planning_milestones
  for select using (user_id = auth.uid());

create policy "planning_milestones_insert_own" on public.planning_milestones
  for insert with check (user_id = auth.uid());

create policy "planning_milestones_update_own" on public.planning_milestones
  for update using (user_id = auth.uid());

create policy "planning_milestones_delete_own" on public.planning_milestones
  for delete using (user_id = auth.uid());

create policy "cpf_balances_select_own" on public.cpf_balances
  for select using (user_id = auth.uid());

create policy "cpf_balances_insert_own" on public.cpf_balances
  for insert with check (user_id = auth.uid());

create policy "cpf_balances_update_own" on public.cpf_balances
  for update using (user_id = auth.uid());

create policy "cpf_balances_delete_own" on public.cpf_balances
  for delete using (user_id = auth.uid());

create policy "housing_loans_select_own" on public.housing_loans
  for select using (user_id = auth.uid());

create policy "housing_loans_insert_own" on public.housing_loans
  for insert with check (user_id = auth.uid());

create policy "housing_loans_update_own" on public.housing_loans
  for update using (user_id = auth.uid());

create policy "housing_loans_delete_own" on public.housing_loans
  for delete using (user_id = auth.uid());
