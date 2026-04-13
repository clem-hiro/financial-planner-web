-- Optional scrap/body (not on LTA PARF line); optional preference for statement loan balance vs PV.

alter table public.vehicles
  add column if not exists body_scrap_if_deregistered_today numeric(14, 2)
    check (
      body_scrap_if_deregistered_today is null
      or body_scrap_if_deregistered_today >= 0
    ),
  add column if not exists loan_prefer_stored_balance boolean not null default false;

comment on column public.vehicles.body_scrap_if_deregistered_today is
  'Dealer/scrap body value if deregistered today — LTA PARF excludes this; add to gross with PARF+COE.';
comment on column public.vehicles.loan_prefer_stored_balance is
  'When true, net worth uses loan_balance instead of amortized PV from instalment.';
