-- Account-level variable contribution and withdrawal planning assumptions.
-- Nullable/defaulted for backward compatibility with existing investment rows.

alter table public.financial_investments
  add column if not exists contribution_growth_annual numeric(8, 4) not null default 0,
  add column if not exists withdrawal_monthly numeric(14, 2) not null default 0,
  add column if not exists withdrawal_start_years numeric(8, 2);

alter table public.financial_investments
  drop constraint if exists financial_investments_contribution_growth_annual_ck;

alter table public.financial_investments
  add constraint financial_investments_contribution_growth_annual_ck
    check (contribution_growth_annual >= 0 and contribution_growth_annual <= 1);

alter table public.financial_investments
  drop constraint if exists financial_investments_withdrawal_monthly_ck;

alter table public.financial_investments
  add constraint financial_investments_withdrawal_monthly_ck
    check (withdrawal_monthly >= 0);

alter table public.financial_investments
  drop constraint if exists financial_investments_withdrawal_start_years_ck;

alter table public.financial_investments
  add constraint financial_investments_withdrawal_start_years_ck
    check (withdrawal_start_years is null or withdrawal_start_years >= 0);

comment on column public.financial_investments.contribution_growth_annual is
  'Annual step-up applied to this account monthly contribution in projections (0.03 = 3% yearly).';
comment on column public.financial_investments.withdrawal_monthly is
  'Planned monthly withdrawal from this account once withdrawal phase starts.';
comment on column public.financial_investments.withdrawal_start_years is
  'Optional years from today before withdrawals start; null = use retirement age when available.';
