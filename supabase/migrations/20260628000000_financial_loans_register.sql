-- Canonical loan register. Existing source tables remain in place; this table
-- is an additive read/sync target so parity can be verified before any future
-- migration removes legacy loan-shaped columns.

begin;

create table if not exists public.financial_loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.financial_profiles (id) on delete cascade,
  source_key text not null check (
    source_key in ('generic_liability', 'housing', 'vehicle')
  ),
  source_table text not null,
  source_row_id uuid not null,
  source_owned boolean not null default true,
  is_editable_in_debt_register boolean not null default false,
  name text not null,
  category text null check (
    category in (
      'property',
      'vehicle',
      'personal',
      'credit_card',
      'renovation',
      'education',
      'other'
    )
  ),
  loan_type text null check (loan_type in ('amortized', 'flat_rate', 'revolving')),
  balance numeric(14, 2) not null default 0 check (balance >= 0),
  annual_interest_rate numeric(10, 6) null check (
    annual_interest_rate is null or annual_interest_rate >= 0
  ),
  remaining_tenure_months integer null check (
    remaining_tenure_months is null or remaining_tenure_months >= 0
  ),
  term_months integer null check (term_months is null or term_months > 0),
  monthly_payment numeric(14, 2) null check (
    monthly_payment is null or monthly_payment >= 0
  ),
  repayment_override boolean not null default false,
  start_year_month text null check (
    start_year_month is null or start_year_month ~ '^\d{4}-\d{2}$'
  ),
  start_date date null,
  funding_source text not null default 'cash' check (
    funding_source in ('cash', 'cpf_oa', 'split')
  ),
  cpf_oa_payment numeric(14, 2) null check (
    cpf_oa_payment is null or cpf_oa_payment >= 0
  ),
  cash_payment numeric(14, 2) null check (
    cash_payment is null or cash_payment >= 0
  ),
  cpf_oa_share numeric(8, 6) null check (
    cpf_oa_share is null or (cpf_oa_share >= 0 and cpf_oa_share <= 1)
  ),
  max_cpf_oa_monthly numeric(14, 2) null check (
    max_cpf_oa_monthly is null or max_cpf_oa_monthly >= 0
  ),
  projection_kind text not null check (
    projection_kind in ('liability', 'housing', 'vehicle')
  ),
  notes text null,
  source_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists financial_loans_source_uq
  on public.financial_loans (source_key, source_row_id);

create index if not exists financial_loans_user_id_idx
  on public.financial_loans (user_id);

create index if not exists financial_loans_user_source_idx
  on public.financial_loans (user_id, source_key, source_owned);

alter table public.financial_loans enable row level security;

drop policy if exists "financial_loans_select_own"
  on public.financial_loans;
drop policy if exists "financial_loans_insert_own"
  on public.financial_loans;
drop policy if exists "financial_loans_update_own"
  on public.financial_loans;
drop policy if exists "financial_loans_delete_own"
  on public.financial_loans;

create policy "financial_loans_select_own"
  on public.financial_loans
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "financial_loans_insert_own"
  on public.financial_loans
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "financial_loans_update_own"
  on public.financial_loans
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "financial_loans_delete_own"
  on public.financial_loans
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

drop trigger if exists set_updated_at on public.financial_loans;
create trigger set_updated_at
  before update on public.financial_loans
  for each row execute function public.set_row_updated_at();

create or replace function public.financial_loan_amortized_monthly_payment(
  p_principal numeric,
  p_annual_rate numeric,
  p_term_months integer
)
returns numeric
language sql
immutable
as $$
  select case
    when coalesce(p_principal, 0) <= 0 or coalesce(p_term_months, 0) <= 0 then 0
    when coalesce(p_annual_rate, 0) <= 0 then round(p_principal / p_term_months, 2)
    else round(
      (
        p_principal
        * (p_annual_rate / 12)
        * power(1 + (p_annual_rate / 12), p_term_months)
      )
      / (power(1 + (p_annual_rate / 12), p_term_months) - 1),
      2
    )
  end;
$$;

create or replace function public.sync_financial_loan_from_liability()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.financial_loans
      where source_key = 'generic_liability'
        and source_row_id = old.id;
    return old;
  end if;

  insert into public.financial_loans (
    user_id,
    source_key,
    source_table,
    source_row_id,
    source_owned,
    is_editable_in_debt_register,
    name,
    category,
    loan_type,
    balance,
    annual_interest_rate,
    remaining_tenure_months,
    term_months,
    monthly_payment,
    repayment_override,
    start_date,
    funding_source,
    projection_kind,
    notes,
    source_snapshot,
    created_at,
    updated_at
  )
  values (
    new.user_id,
    'generic_liability',
    'financial_liabilities',
    new.id,
    false,
    true,
    new.name,
    new.category,
    new.loan_type,
    new.balance,
    new.interest_rate_annual,
    new.remaining_tenure_months,
    new.remaining_tenure_months,
    new.monthly_repayment,
    coalesce(new.repayment_override, false),
    new.start_date,
    'cash',
    'liability',
    new.notes,
    to_jsonb(new),
    new.created_at,
    now()
  )
  on conflict (source_key, source_row_id) do update
    set user_id = excluded.user_id,
        source_table = excluded.source_table,
        source_owned = excluded.source_owned,
        is_editable_in_debt_register = excluded.is_editable_in_debt_register,
        name = excluded.name,
        category = excluded.category,
        loan_type = excluded.loan_type,
        balance = excluded.balance,
        annual_interest_rate = excluded.annual_interest_rate,
        remaining_tenure_months = excluded.remaining_tenure_months,
        term_months = excluded.term_months,
        monthly_payment = excluded.monthly_payment,
        repayment_override = excluded.repayment_override,
        start_date = excluded.start_date,
        funding_source = excluded.funding_source,
        projection_kind = excluded.projection_kind,
        notes = excluded.notes,
        source_snapshot = excluded.source_snapshot,
        updated_at = now();

  return new;
end;
$$;

create or replace function public.sync_financial_loan_from_housing_loan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  payment numeric;
  payment_source_resolved text;
  share numeric;
  cpf_payment numeric;
  cash_payment_resolved numeric;
begin
  if tg_op = 'DELETE' then
    delete from public.financial_loans
      where source_key = 'housing'
        and source_row_id = old.id;
    return old;
  end if;

  payment := public.financial_loan_amortized_monthly_payment(
    new.principal,
    new.annual_nominal_rate,
    new.term_months
  );
  share := least(1, greatest(0, coalesce(new.oa_share_of_payment, 0)));
  payment_source_resolved := coalesce(
    new.payment_source,
    case
      when share <= 0 then 'cash'
      when share >= 1 then 'cpf_oa'
      else 'split'
    end
  );

  if payment_source_resolved = 'cpf_oa' then
    cpf_payment := payment;
    cash_payment_resolved := 0;
  elsif payment_source_resolved = 'split' then
    cpf_payment := coalesce(
      new.cpf_oa_payment,
      case
        when new.cash_payment is not null then greatest(0, payment - new.cash_payment)
        else payment * share
      end
    );
    cpf_payment := least(payment, greatest(0, cpf_payment));
    cash_payment_resolved := coalesce(new.cash_payment, payment - cpf_payment);
    cash_payment_resolved := least(payment, greatest(0, cash_payment_resolved));
  else
    cpf_payment := 0;
    cash_payment_resolved := payment;
  end if;

  insert into public.financial_loans (
    user_id,
    source_key,
    source_table,
    source_row_id,
    source_owned,
    is_editable_in_debt_register,
    name,
    category,
    loan_type,
    balance,
    annual_interest_rate,
    remaining_tenure_months,
    term_months,
    monthly_payment,
    repayment_override,
    start_year_month,
    funding_source,
    cpf_oa_payment,
    cash_payment,
    cpf_oa_share,
    max_cpf_oa_monthly,
    projection_kind,
    source_snapshot,
    created_at,
    updated_at
  )
  values (
    new.user_id,
    'housing',
    'financial_housing_loans',
    new.id,
    true,
    false,
    new.label,
    'property',
    'amortized',
    new.principal,
    new.annual_nominal_rate,
    new.term_months,
    new.term_months,
    payment,
    false,
    new.first_payment_month,
    payment_source_resolved,
    cpf_payment,
    cash_payment_resolved,
    case when payment > 0 then cpf_payment / payment else share end,
    new.max_oa_per_month,
    'housing',
    to_jsonb(new),
    new.created_at,
    now()
  )
  on conflict (source_key, source_row_id) do update
    set user_id = excluded.user_id,
        source_table = excluded.source_table,
        source_owned = excluded.source_owned,
        is_editable_in_debt_register = excluded.is_editable_in_debt_register,
        name = excluded.name,
        category = excluded.category,
        loan_type = excluded.loan_type,
        balance = excluded.balance,
        annual_interest_rate = excluded.annual_interest_rate,
        remaining_tenure_months = excluded.remaining_tenure_months,
        term_months = excluded.term_months,
        monthly_payment = excluded.monthly_payment,
        repayment_override = excluded.repayment_override,
        start_year_month = excluded.start_year_month,
        funding_source = excluded.funding_source,
        cpf_oa_payment = excluded.cpf_oa_payment,
        cash_payment = excluded.cash_payment,
        cpf_oa_share = excluded.cpf_oa_share,
        max_cpf_oa_monthly = excluded.max_cpf_oa_monthly,
        projection_kind = excluded.projection_kind,
        source_snapshot = excluded.source_snapshot,
        updated_at = now();

  return new;
end;
$$;

create or replace function public.sync_financial_loan_from_vehicle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.financial_loans
      where source_key = 'vehicle'
        and source_row_id = old.id;
    return old;
  end if;

  if coalesce(new.loan_balance, 0) <= 0
     and coalesce(new.loan_monthly_payment, 0) <= 0
     and coalesce(new.loan_months_remaining, 0) <= 0 then
    delete from public.financial_loans
      where source_key = 'vehicle'
        and source_row_id = new.id;
    return new;
  end if;

  insert into public.financial_loans (
    user_id,
    source_key,
    source_table,
    source_row_id,
    source_owned,
    is_editable_in_debt_register,
    name,
    category,
    loan_type,
    balance,
    annual_interest_rate,
    remaining_tenure_months,
    term_months,
    monthly_payment,
    repayment_override,
    funding_source,
    cash_payment,
    projection_kind,
    source_snapshot,
    created_at,
    updated_at
  )
  values (
    new.user_id,
    'vehicle',
    'financial_vehicles',
    new.id,
    true,
    false,
    new.label,
    'vehicle',
    'flat_rate',
    coalesce(new.loan_balance, 0),
    new.loan_annual_nominal_rate,
    new.loan_months_remaining,
    new.loan_months_remaining,
    nullif(new.loan_monthly_payment, 0),
    false,
    'cash',
    nullif(new.loan_monthly_payment, 0),
    'vehicle',
    to_jsonb(new),
    new.created_at,
    now()
  )
  on conflict (source_key, source_row_id) do update
    set user_id = excluded.user_id,
        source_table = excluded.source_table,
        source_owned = excluded.source_owned,
        is_editable_in_debt_register = excluded.is_editable_in_debt_register,
        name = excluded.name,
        category = excluded.category,
        loan_type = excluded.loan_type,
        balance = excluded.balance,
        annual_interest_rate = excluded.annual_interest_rate,
        remaining_tenure_months = excluded.remaining_tenure_months,
        term_months = excluded.term_months,
        monthly_payment = excluded.monthly_payment,
        repayment_override = excluded.repayment_override,
        funding_source = excluded.funding_source,
        cash_payment = excluded.cash_payment,
        projection_kind = excluded.projection_kind,
        source_snapshot = excluded.source_snapshot,
        updated_at = now();

  return new;
end;
$$;

drop trigger if exists sync_financial_loan_from_liability
  on public.financial_liabilities;
create trigger sync_financial_loan_from_liability
  after insert or update or delete on public.financial_liabilities
  for each row execute function public.sync_financial_loan_from_liability();

drop trigger if exists sync_financial_loan_from_housing_loan
  on public.financial_housing_loans;
create trigger sync_financial_loan_from_housing_loan
  after insert or update or delete on public.financial_housing_loans
  for each row execute function public.sync_financial_loan_from_housing_loan();

drop trigger if exists sync_financial_loan_from_vehicle
  on public.financial_vehicles;
create trigger sync_financial_loan_from_vehicle
  after insert or update or delete on public.financial_vehicles
  for each row execute function public.sync_financial_loan_from_vehicle();

insert into public.financial_loans (
  user_id,
  source_key,
  source_table,
  source_row_id,
  source_owned,
  is_editable_in_debt_register,
  name,
  category,
  loan_type,
  balance,
  annual_interest_rate,
  remaining_tenure_months,
  term_months,
  monthly_payment,
  repayment_override,
  start_date,
  funding_source,
  projection_kind,
  notes,
  source_snapshot,
  created_at,
  updated_at
)
select
  l.user_id,
  'generic_liability',
  'financial_liabilities',
  l.id,
  false,
  true,
  l.name,
  l.category,
  l.loan_type,
  l.balance,
  l.interest_rate_annual,
  l.remaining_tenure_months,
  l.remaining_tenure_months,
  l.monthly_repayment,
  coalesce(l.repayment_override, false),
  l.start_date,
  'cash',
  'liability',
  l.notes,
  to_jsonb(l),
  l.created_at,
  now()
from public.financial_liabilities l
on conflict (source_key, source_row_id) do nothing;

insert into public.financial_loans (
  user_id,
  source_key,
  source_table,
  source_row_id,
  source_owned,
  is_editable_in_debt_register,
  name,
  category,
  loan_type,
  balance,
  annual_interest_rate,
  remaining_tenure_months,
  term_months,
  monthly_payment,
  repayment_override,
  start_year_month,
  funding_source,
  cpf_oa_payment,
  cash_payment,
  cpf_oa_share,
  max_cpf_oa_monthly,
  projection_kind,
  source_snapshot,
  created_at,
  updated_at
)
select
  h.user_id,
  'housing',
  'financial_housing_loans',
  h.id,
  true,
  false,
  h.label,
  'property',
  'amortized',
  h.principal,
  h.annual_nominal_rate,
  h.term_months,
  h.term_months,
  p.payment,
  false,
  h.first_payment_month,
  s.payment_source,
  s.cpf_payment,
  s.cash_payment,
  case when p.payment > 0 then s.cpf_payment / p.payment else s.share end,
  h.max_oa_per_month,
  'housing',
  to_jsonb(h),
  h.created_at,
  now()
from public.financial_housing_loans h
cross join lateral (
  select public.financial_loan_amortized_monthly_payment(
    h.principal,
    h.annual_nominal_rate,
    h.term_months
  ) as payment
) p
cross join lateral (
  select
    least(1, greatest(0, h.oa_share_of_payment)) as share,
    coalesce(
      h.payment_source,
      case
        when h.oa_share_of_payment <= 0 then 'cash'
        when h.oa_share_of_payment >= 1 then 'cpf_oa'
        else 'split'
      end
    ) as payment_source
) src
cross join lateral (
  select
    src.share,
    src.payment_source,
    case
      when src.payment_source = 'cpf_oa' then p.payment
      when src.payment_source = 'split' then least(
        p.payment,
        greatest(
          0,
          coalesce(
            h.cpf_oa_payment,
            case
              when h.cash_payment is not null then greatest(0, p.payment - h.cash_payment)
              else p.payment * src.share
            end
          )
        )
      )
      else 0
    end as cpf_payment,
    case
      when src.payment_source = 'cash' then p.payment
      when src.payment_source = 'split' then least(
        p.payment,
        greatest(
          0,
          coalesce(
            h.cash_payment,
            p.payment - coalesce(
              h.cpf_oa_payment,
              case
                when h.cash_payment is not null then greatest(0, p.payment - h.cash_payment)
                else p.payment * src.share
              end
            )
          )
        )
      )
      else 0
    end as cash_payment
) s
on conflict (source_key, source_row_id) do nothing;

insert into public.financial_loans (
  user_id,
  source_key,
  source_table,
  source_row_id,
  source_owned,
  is_editable_in_debt_register,
  name,
  category,
  loan_type,
  balance,
  annual_interest_rate,
  remaining_tenure_months,
  term_months,
  monthly_payment,
  repayment_override,
  funding_source,
  cash_payment,
  projection_kind,
  source_snapshot,
  created_at,
  updated_at
)
select
  v.user_id,
  'vehicle',
  'financial_vehicles',
  v.id,
  true,
  false,
  v.label,
  'vehicle',
  'flat_rate',
  coalesce(v.loan_balance, 0),
  v.loan_annual_nominal_rate,
  v.loan_months_remaining,
  v.loan_months_remaining,
  nullif(v.loan_monthly_payment, 0),
  false,
  'cash',
  nullif(v.loan_monthly_payment, 0),
  'vehicle',
  to_jsonb(v),
  v.created_at,
  now()
from public.financial_vehicles v
where coalesce(v.loan_balance, 0) > 0
   or coalesce(v.loan_monthly_payment, 0) > 0
   or coalesce(v.loan_months_remaining, 0) > 0
on conflict (source_key, source_row_id) do nothing;

comment on table public.financial_loans is
  'Canonical additive loan register synced from liabilities, housing loans, and vehicle loans while legacy source tables remain intact.';

commit;
