-- Optional demographics for age-based net worth projection on the dashboard.

alter table public.profiles
  add column if not exists birth_date date,
  add column if not exists target_retirement_age smallint
    check (
      target_retirement_age is null
      or (target_retirement_age >= 50 and target_retirement_age <= 80)
    );
