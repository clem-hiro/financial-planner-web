-- Monthly line applicability (loan payoff) + per-month amount overrides

alter table public.budget_lines
  add column start_year_month text,
  add column end_year_month text;

alter table public.budget_lines
  add constraint budget_lines_start_ym_format check (
    start_year_month is null or start_year_month ~ '^\d{4}-\d{2}$'
  );

alter table public.budget_lines
  add constraint budget_lines_end_ym_format check (
    end_year_month is null or end_year_month ~ '^\d{4}-\d{2}$'
  );

alter table public.budget_lines
  add constraint budget_lines_bounds_annual_null check (
    cadence <> 'annual'
    or (start_year_month is null and end_year_month is null)
  );

alter table public.budget_lines
  add constraint budget_lines_monthly_range_order check (
    cadence <> 'monthly'
    or start_year_month is null
    or end_year_month is null
    or start_year_month <= end_year_month
  );

create table public.budget_line_month_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  budget_line_id uuid not null references public.budget_lines (id) on delete cascade,
  year_month text not null check (year_month ~ '^\d{4}-\d{2}$'),
  amount numeric(14, 2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  unique (budget_line_id, year_month)
);

create index budget_line_month_overrides_user_month_idx
  on public.budget_line_month_overrides (user_id, year_month);

alter table public.budget_line_month_overrides enable row level security;

create policy "budget_line_month_overrides_select_own"
  on public.budget_line_month_overrides
  for select using (user_id = auth.uid());

create policy "budget_line_month_overrides_insert_own"
  on public.budget_line_month_overrides
  for insert with check (user_id = auth.uid());

create policy "budget_line_month_overrides_update_own"
  on public.budget_line_month_overrides
  for update using (user_id = auth.uid());

create policy "budget_line_month_overrides_delete_own"
  on public.budget_line_month_overrides
  for delete using (user_id = auth.uid());
