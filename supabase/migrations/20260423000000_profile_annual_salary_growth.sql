-- Nominal annual raise for CPF projection gross (e.g. 0.02 = 2% each January).

alter table public.profiles
  add column if not exists annual_salary_growth_nominal numeric(6, 4)
    check (
      annual_salary_growth_nominal is null
      or (
        annual_salary_growth_nominal >= 0
        and annual_salary_growth_nominal <= 0.25
      )
    );

comment on column public.profiles.annual_salary_growth_nominal is
  'Decimal per year; applied each January in CPF stepper (null = 0).';
