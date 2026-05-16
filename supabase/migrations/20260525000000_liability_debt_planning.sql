-- Enhanced debt / liability planning: loan metadata, repayment, budget link

alter table public.financial_liabilities
  add column if not exists category text
    check (
      category is null
      or category in (
        'property',
        'vehicle',
        'personal',
        'credit_card',
        'renovation',
        'education',
        'other'
      )
    ),
  add column if not exists loan_type text
    check (
      loan_type is null
      or loan_type in ('amortized', 'flat_rate', 'revolving')
    ),
  add column if not exists interest_rate_annual numeric(8, 6)
    check (
      interest_rate_annual is null
      or (interest_rate_annual >= 0 and interest_rate_annual <= 1)
    ),
  add column if not exists remaining_tenure_months int
    check (remaining_tenure_months is null or remaining_tenure_months >= 0),
  add column if not exists monthly_repayment numeric(14, 2)
    check (monthly_repayment is null or monthly_repayment >= 0),
  add column if not exists repayment_override boolean not null default false,
  add column if not exists start_date date,
  add column if not exists notes text
    check (notes is null or char_length(notes) <= 2000);

comment on column public.financial_liabilities.category is
  'User-facing loan category (property, vehicle, credit card, etc.).';
comment on column public.financial_liabilities.loan_type is
  'Repayment model: amortized, flat_rate, or revolving/manual.';
comment on column public.financial_liabilities.interest_rate_annual is
  'Nominal annual rate as decimal (e.g. 0.026 for 2.6%).';
alter table public.financial_budget_lines
  add column if not exists source_liability_id uuid
    references public.financial_liabilities (id) on delete cascade;

create unique index if not exists financial_budget_lines_source_liability_uidx
  on public.financial_budget_lines (source_liability_id)
  where source_liability_id is not null;
