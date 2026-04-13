-- Optional gross override for motorcycles etc. (no PARF): use listing / market estimate.

alter table public.vehicles
  add column if not exists current_market_value numeric(14, 2)
    check (current_market_value is null or current_market_value >= 0);

comment on column public.vehicles.current_market_value is
  'When set, gross asset = this amount (e.g. motorcycle resale estimate); overrides PARF/COE and modelled paths.';
