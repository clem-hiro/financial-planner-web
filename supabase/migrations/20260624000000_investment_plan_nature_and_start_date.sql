-- ILP / endowment guidance: plan_nature distinguishes investment-only vs bundled coverage.
-- contribution_start_date pairs with existing contribution_end_date for calendar premium windows.

alter table public.financial_investments
  add column if not exists contribution_start_date date,
  add column if not exists plan_nature text;

alter table public.financial_investments
  drop constraint if exists financial_investments_plan_nature_ck;

alter table public.financial_investments
  add constraint financial_investments_plan_nature_ck
    check (
      plan_nature is null
      or plan_nature in ('pure_investment', 'includes_insurance_coverage')
    );

comment on column public.financial_investments.contribution_start_date is
  'Optional first premium/contribution month (calendar). Used with contribution_end_date for fixed-duration projections.';
comment on column public.financial_investments.contribution_end_date is
  'Optional last premium/contribution month (calendar). When set, overrides contribution_duration_years in projections.';
comment on column public.financial_investments.plan_nature is
  'pure_investment | includes_insurance_coverage — guides where to record ILP-style products without double counting.';
