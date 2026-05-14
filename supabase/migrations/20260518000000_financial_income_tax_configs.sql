-- Singleton-per-user Singapore income tax config: typed reliefs per IRAS category,
-- opt-in rebate pair (percent + cap), and payment method. Math lives in the domain
-- layer; this table stores only inputs.

begin;

create extension if not exists pgcrypto;

create table if not exists public.financial_income_tax_configs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.financial_profiles (id) on delete cascade,
  year_of_assessment int not null default 2026
    check (year_of_assessment between 2024 and 2030),

  -- Family reliefs
  spouse_relief_sgd numeric(14,2) not null default 0 check (spouse_relief_sgd >= 0),
  qualifying_child_relief_sgd numeric(14,2) not null default 0 check (qualifying_child_relief_sgd >= 0),
  handicapped_child_relief_sgd numeric(14,2) not null default 0 check (handicapped_child_relief_sgd >= 0),
  working_mother_child_relief_sgd numeric(14,2) not null default 0 check (working_mother_child_relief_sgd >= 0),
  parent_relief_sgd numeric(14,2) not null default 0 check (parent_relief_sgd >= 0),
  grandparent_caregiver_relief_sgd numeric(14,2) not null default 0 check (grandparent_caregiver_relief_sgd >= 0),
  handicapped_sibling_relief_sgd numeric(14,2) not null default 0 check (handicapped_sibling_relief_sgd >= 0),

  -- CPF / SRS reliefs
  cpf_cash_topup_self_sgd numeric(14,2) not null default 0 check (cpf_cash_topup_self_sgd >= 0),
  cpf_cash_topup_family_sgd numeric(14,2) not null default 0 check (cpf_cash_topup_family_sgd >= 0),
  srs_contribution_sgd numeric(14,2) not null default 0 check (srs_contribution_sgd >= 0),
  cpf_medisave_voluntary_sgd numeric(14,2) not null default 0 check (cpf_medisave_voluntary_sgd >= 0),

  -- NS reliefs
  nsman_self_relief_sgd numeric(14,2) not null default 0 check (nsman_self_relief_sgd >= 0),
  nsman_wife_relief_sgd numeric(14,2) not null default 0 check (nsman_wife_relief_sgd >= 0),
  nsman_parent_relief_sgd numeric(14,2) not null default 0 check (nsman_parent_relief_sgd >= 0),

  -- Career / other reliefs
  course_fees_relief_sgd numeric(14,2) not null default 0 check (course_fees_relief_sgd >= 0),
  life_insurance_relief_sgd numeric(14,2) not null default 0 check (life_insurance_relief_sgd >= 0),
  other_reliefs_amount_sgd numeric(14,2) not null default 0 check (other_reliefs_amount_sgd >= 0),
  other_reliefs_notes text,

  -- Opt-in rebate pair (both null = no rebate; both set = rebate applies up to cap).
  tax_rebate_percent numeric(5,2)
    check (tax_rebate_percent is null or (tax_rebate_percent >= 0 and tax_rebate_percent <= 100)),
  tax_rebate_cap_sgd numeric(14,2)
    check (tax_rebate_cap_sgd is null or tax_rebate_cap_sgd >= 0),
  constraint financial_income_tax_configs_rebate_pair_check
    check ((tax_rebate_percent is null) = (tax_rebate_cap_sgd is null)),

  payment_method text not null default 'monthly_giro'
    check (payment_method in ('monthly_giro', 'one_time')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.financial_income_tax_configs is
  'Singapore income tax inputs per user: IRAS-categorised reliefs, opt-in rebate, payment method. One row per user.';

alter table public.financial_income_tax_configs enable row level security;

drop policy if exists "financial_income_tax_configs_select_own" on public.financial_income_tax_configs;
drop policy if exists "financial_income_tax_configs_insert_own" on public.financial_income_tax_configs;
drop policy if exists "financial_income_tax_configs_update_own" on public.financial_income_tax_configs;
drop policy if exists "financial_income_tax_configs_delete_own" on public.financial_income_tax_configs;

create policy "financial_income_tax_configs_select_own"
  on public.financial_income_tax_configs
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "financial_income_tax_configs_insert_own"
  on public.financial_income_tax_configs
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "financial_income_tax_configs_update_own"
  on public.financial_income_tax_configs
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "financial_income_tax_configs_delete_own"
  on public.financial_income_tax_configs
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

commit;
