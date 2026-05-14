-- Opt-in salary-review reminder: user picks the month their raise typically lands,
-- and we record the most-recent acknowledgement timestamp. Both columns are nullable
-- so existing rows are unaffected and the feature stays opt-in.

begin;

alter table public.financial_profiles
  add column if not exists salary_increment_month smallint
    check (salary_increment_month is null or (salary_increment_month between 1 and 12)),
  add column if not exists last_salary_review_at timestamptz;

comment on column public.financial_profiles.salary_increment_month is
  'Calendar month (1-12) the user expects their salary to be reviewed. NULL = feature off.';
comment on column public.financial_profiles.last_salary_review_at is
  'When the user last confirmed (or updated) their salary in response to the annual review prompt.';

commit;
