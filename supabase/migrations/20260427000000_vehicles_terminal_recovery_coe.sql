-- Optional straight-line gross asset: OTR at first reg → terminal cash back at COE expiry month.

alter table public.vehicles
  add column if not exists terminal_recovery_at_coe_expiry numeric(14, 2)
    check (
      terminal_recovery_at_coe_expiry is null
      or terminal_recovery_at_coe_expiry >= 0
    );

comment on column public.vehicles.terminal_recovery_at_coe_expiry is
  'Expected total rebates + body at COE expiry; with first_registration_ym, on_the_road_paid, coe_expiry_ym drives linear gross asset (overrides PARF+COE for asset).';
