-- Optional bonus-months multiplier captured during onboarding (gross months of salary).
-- `annual_bonus` remains the canonical gross annual lump sum for calculations.
alter table public.financial_profiles
  add column if not exists annual_bonus_months numeric(4, 1);

comment on column public.financial_profiles.annual_bonus_months is
  'Months of gross salary used to derive annual_bonus during onboarding; null for legacy/custom-only rows.';
