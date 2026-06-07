create table public.financial_cpf_investments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.financial_profiles (id) on delete cascade,
  account text not null check (account in ('oa', 'sa')),
  purchase_month text not null check (purchase_month ~ '^\d{4}-\d{2}$'),
  premium_type text not null check (premium_type in ('single', 'regular')),
  amount numeric(14, 2) not null check (amount > 0),
  projected_growth_annual numeric(8, 6) not null default 0 check (
    projected_growth_annual >= -0.5 and projected_growth_annual <= 1
  ),
  maturity_month text not null check (maturity_month ~ '^\d{4}-\d{2}$'),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (maturity_month > purchase_month)
);

create index financial_cpf_investments_user_id_idx
  on public.financial_cpf_investments (user_id);

create index financial_cpf_investments_maturity_month_idx
  on public.financial_cpf_investments (maturity_month);

alter table public.financial_cpf_investments enable row level security;

create policy "financial_cpf_investments_select_own"
  on public.financial_cpf_investments
  for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "financial_cpf_investments_insert_own"
  on public.financial_cpf_investments
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

create policy "financial_cpf_investments_update_own"
  on public.financial_cpf_investments
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "financial_cpf_investments_delete_own"
  on public.financial_cpf_investments
  for delete
  to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.advisor_read_cpf_investments(p_client uuid)
returns setof public.financial_cpf_investments
language sql
security definer
set search_path = public
stable
as $$
  select i.*
    from public.financial_cpf_investments i
   where i.user_id = p_client
     and public.advisor_can_read_client(p_client)
   order by i.purchase_month, i.created_at;
$$;

revoke all on function public.advisor_read_cpf_investments(uuid) from public;
grant execute on function public.advisor_read_cpf_investments(uuid) to authenticated;
