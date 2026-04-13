-- Optional monthly retirement spending goal (same currency as profile; for dashboard sufficiency check).

alter table public.profiles
  add column if not exists retirement_monthly_spend_goal numeric(14, 2)
    check (
      retirement_monthly_spend_goal is null
      or retirement_monthly_spend_goal >= 0
    );
