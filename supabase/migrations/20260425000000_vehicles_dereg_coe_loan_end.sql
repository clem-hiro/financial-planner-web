-- Optional LTA-style anchors: PARF + COE if deregistered today, COE expiry, loan end month.

alter table public.vehicles
  add column if not exists coe_expiry_ym text,
  add column if not exists parf_if_deregistered_today numeric(14, 2)
    check (parf_if_deregistered_today is null or parf_if_deregistered_today >= 0),
  add column if not exists coe_if_deregistered_today numeric(14, 2)
    check (coe_if_deregistered_today is null or coe_if_deregistered_today >= 0),
  add column if not exists loan_end_ym text;

comment on column public.vehicles.parf_if_deregistered_today is
  'PARF rebate if deregistered today (e.g. from OneMotoring); when set with COE value, overrides modeled PARF+body.';
comment on column public.vehicles.coe_if_deregistered_today is
  'COE rebate if deregistered today; optional with PARF column.';
comment on column public.vehicles.loan_end_ym is
  'Last payment month YYYY-MM; used to derive months remaining for loan PV.';
