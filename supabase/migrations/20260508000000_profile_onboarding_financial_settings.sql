begin;

alter table public.financial_profiles
  add column if not exists salary_frequency text,
  add column if not exists annual_bonus numeric(14, 2),
  add column if not exists savings_target_monthly numeric(14, 2),
  add column if not exists fixed_expenses_monthly numeric(14, 2),
  add column if not exists debt_obligations_monthly numeric(14, 2),
  add column if not exists retirement_withdrawal_rate_annual numeric(6, 4),
  add column if not exists onboarding_required boolean not null default false,
  add column if not exists onboarding_step smallint default 1,
  add column if not exists onboarding_completed_at timestamptz;

alter table public.financial_profiles
  alter column base_currency set default 'SGD';

alter table public.financial_profiles
  drop constraint if exists financial_profiles_salary_frequency_check,
  add constraint financial_profiles_salary_frequency_check check (
    salary_frequency is null
    or salary_frequency in ('monthly', 'biweekly', 'weekly', 'annual')
  ),
  drop constraint if exists financial_profiles_retirement_withdrawal_rate_annual_check,
  add constraint financial_profiles_retirement_withdrawal_rate_annual_check check (
    retirement_withdrawal_rate_annual is null
    or (
      retirement_withdrawal_rate_annual >= 0
      and retirement_withdrawal_rate_annual <= 0.2
    )
  ),
  drop constraint if exists financial_profiles_onboarding_step_check,
  add constraint financial_profiles_onboarding_step_check check (
    onboarding_step is null or (onboarding_step >= 1 and onboarding_step <= 4)
  );

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.financial_profiles (
    id,
    display_name,
    onboarding_required,
    onboarding_step
  )
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'display_name', ''),
    true,
    1
  );
  return new;
end;
$$;

commit;
