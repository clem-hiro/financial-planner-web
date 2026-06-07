-- Component-level investment cash income and yearly withdrawal assumptions.
-- Additive for rollback: withdrawal_monthly remains as a legacy compatibility column.

alter table public.financial_investments
  add column if not exists investment_income_rate_annual numeric(8, 4) not null default 0,
  add column if not exists withdrawal_annual numeric(14, 2) not null default 0;

alter table public.financial_investments
  drop constraint if exists financial_investments_investment_income_rate_annual_ck;

alter table public.financial_investments
  add constraint financial_investments_investment_income_rate_annual_ck
    check (
      investment_income_rate_annual >= 0
      and investment_income_rate_annual <= 1
    );

alter table public.financial_investments
  drop constraint if exists financial_investments_withdrawal_annual_ck;

alter table public.financial_investments
  add constraint financial_investments_withdrawal_annual_ck
    check (withdrawal_annual >= 0);

comment on column public.financial_investments.investment_income_rate_annual is
  'Annual cash-income rate from this investment component (pure investment dividend yield or ILP post-maturity income rate).';
comment on column public.financial_investments.withdrawal_annual is
  'Planned yearly withdrawal paid as cash inflow and deducted from investment principal.';
