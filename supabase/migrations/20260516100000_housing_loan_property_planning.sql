-- Optional property affordability planning context on housing loans (nullable = legacy rows).

alter table public.financial_housing_loans
  add column if not exists property_purchase_price numeric(14, 2)
    check (property_purchase_price is null or property_purchase_price > 0);

alter table public.financial_housing_loans
  add column if not exists property_kind text
    check (
      property_kind is null
      or property_kind in ('hdb', 'condo', 'ec', 'landed')
    );

alter table public.financial_housing_loans
  add column if not exists downpayment_guidance_preset text
    check (
      downpayment_guidance_preset is null
      or downpayment_guidance_preset in ('pct_20', 'pct_25', 'custom')
    );

alter table public.financial_housing_loans
  add column if not exists downpayment_guidance_custom_percent numeric(8, 6)
    check (
      downpayment_guidance_custom_percent is null
      or (
        downpayment_guidance_custom_percent > 0
        and downpayment_guidance_custom_percent <= 1
      )
    );

alter table public.financial_housing_loans
  add column if not exists downpayment_guidance_custom_amount numeric(14, 2)
    check (
      downpayment_guidance_custom_amount is null
      or downpayment_guidance_custom_amount >= 0
    );

alter table public.financial_housing_loans
  add column if not exists buyers_stamp_duty numeric(14, 2)
    check (buyers_stamp_duty is null or buyers_stamp_duty >= 0);

alter table public.financial_housing_loans
  add column if not exists financing_includes_bsd boolean not null default false;

comment on column public.financial_housing_loans.property_purchase_price is
  'Purchase / valuation price when loan was created via guided property flow; null = not captured.';

comment on column public.financial_housing_loans.financing_includes_bsd is
  'When true, guided loan principal subtracted estimated BSD from purchase (see buyers_stamp_duty).';
