-- Optional: estimate outstanding loan as payment × months left (no PV discount).

alter table public.vehicles
  add column if not exists loan_simple_remaining_estimate boolean not null default false;

comment on column public.vehicles.loan_simple_remaining_estimate is
  'When true (and not loan_prefer_stored_balance), net equity uses instalment × remaining months instead of PV.';
