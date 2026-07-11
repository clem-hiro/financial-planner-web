-- Optional non-salary monthly take-home (side hustle, freelance, etc.).
-- One lump field — not a multi-stream register — so Profile stays simple.
-- Null / unset means none; Home Income = salary take-home + this amount.

begin;

alter table public.financial_profiles
  add column if not exists other_monthly_income numeric(14, 2)
    check (
      other_monthly_income is null
      or (
        other_monthly_income >= 0
        and other_monthly_income <= 10000000
      )
    );

comment on column public.financial_profiles.other_monthly_income is
  'Optional monthly take-home outside salary (side hustle, freelance, etc.); null = none.';

commit;
