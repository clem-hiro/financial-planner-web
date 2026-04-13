-- Motor vehicles (Singapore illustrative PARF + body; loan netted in app net worth).

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text not null default 'Vehicle',
  vehicle_status text not null default 'active'
    check (vehicle_status in ('active', 'planned')),
  first_registration_ym text null,
  on_the_road_paid numeric(14, 2) not null default 0 check (on_the_road_paid >= 0),
  arf_for_parf numeric(14, 2) null check (arf_for_parf is null or arf_for_parf >= 0),
  body_open_market_at_purchase numeric(14, 2) null
    check (body_open_market_at_purchase is null or body_open_market_at_purchase >= 0),
  body_depreciation_years int not null default 10
    check (body_depreciation_years >= 1 and body_depreciation_years <= 20),
  loan_balance numeric(14, 2) not null default 0 check (loan_balance >= 0),
  loan_monthly_payment numeric(14, 2) not null default 0 check (loan_monthly_payment >= 0),
  loan_months_remaining int null
    check (loan_months_remaining is null or loan_months_remaining >= 0),
  loan_annual_nominal_rate numeric(8, 6) null
    check (loan_annual_nominal_rate is null or loan_annual_nominal_rate >= 0),
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

create index vehicles_user_id_idx on public.vehicles (user_id);

alter table public.vehicles enable row level security;

create policy "vehicles_select_own" on public.vehicles
  for select using (user_id = auth.uid());

create policy "vehicles_insert_own" on public.vehicles
  for insert with check (user_id = auth.uid());

create policy "vehicles_update_own" on public.vehicles
  for update using (user_id = auth.uid());

create policy "vehicles_delete_own" on public.vehicles
  for delete using (user_id = auth.uid());
