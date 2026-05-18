-- Nominal annual expense growth as decimal (e.g. 0.02 = 2% each January).
-- Nullable with NO DB default: the global 2% default is applied at READ time
-- in the mapper (profileExpenseGrowthNominal) so existing rows stay untouched.
-- Mirrors annual_salary_growth_nominal end-to-end (same type + range check).

begin;

alter table public.financial_profiles
  add column if not exists expense_growth_nominal numeric(6, 4)
    check (
      expense_growth_nominal is null
      or (
        expense_growth_nominal >= 0
        and expense_growth_nominal <= 0.25
      )
    );

comment on column public.financial_profiles.expense_growth_nominal is
  'Decimal per year; expenses & retirement spend goal escalate each January (null = read-time 2% default).';

commit;
