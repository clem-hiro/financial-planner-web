-- Optional contribution phase fields (all nullable for backward compatibility).
-- Null contribution_type = legacy behavior: treat as contributions through retirement horizon when age-based caps apply.

alter table public.financial_investments
  add column if not exists contribution_type text,
  add column if not exists contribution_duration_years numeric(8, 2),
  add column if not exists contribution_end_age smallint,
  add column if not exists contribution_end_date date;

alter table public.financial_investments
  drop constraint if exists financial_investments_contribution_type_ck;

alter table public.financial_investments
  add constraint financial_investments_contribution_type_ck
    check (
      contribution_type is null
      or contribution_type in ('until_retirement', 'fixed_duration')
    );

alter table public.financial_investments
  drop constraint if exists financial_investments_contribution_duration_years_ck;

alter table public.financial_investments
  add constraint financial_investments_contribution_duration_years_ck
    check (
      contribution_duration_years is null
      or contribution_duration_years > 0
    );

alter table public.financial_investments
  drop constraint if exists financial_investments_contribution_end_age_ck;

alter table public.financial_investments
  add constraint financial_investments_contribution_end_age_ck
    check (
      contribution_end_age is null
      or (contribution_end_age >= 18 and contribution_end_age <= 100)
    );

comment on column public.financial_investments.contribution_type is
  'until_retirement | fixed_duration; null = legacy (same as until_retirement in projections).';
comment on column public.financial_investments.contribution_duration_years is
  'When contribution_type = fixed_duration: years of monthly contributions from today; balance keeps compounding after.';
comment on column public.financial_investments.contribution_end_age is
  'Reserved for future age-based contribution end (not used in v1 UI).';
comment on column public.financial_investments.contribution_end_date is
  'Reserved for calendar contribution end (not used in v1 UI).';
