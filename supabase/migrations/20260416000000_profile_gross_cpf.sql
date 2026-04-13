-- Optional monthly gross + age band for SG CPF take-home estimate
alter table public.profiles
  add column if not exists monthly_gross_salary numeric(14, 2),
  add column if not exists cpf_age_band text;

alter table public.profiles
  drop constraint if exists profiles_cpf_age_band_check;

alter table public.profiles
  add constraint profiles_cpf_age_band_check check (
    cpf_age_band is null
    or cpf_age_band in (
      'below_55',
      'above_55_to_60',
      'above_60_to_65',
      'above_65_to_70',
      'above_70'
    )
  );
