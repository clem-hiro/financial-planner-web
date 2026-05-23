-- HDB-first housing capture: property purchase year and upfront CPF/cash payment events.

begin;

alter table public.financial_properties
  add column if not exists purchase_year integer
    check (purchase_year is null or (purchase_year >= 1960 and purchase_year <= 2100));

alter table public.financial_properties
  drop constraint if exists financial_properties_property_type_check;

alter table public.financial_properties
  add constraint financial_properties_property_type_check
  check (
    property_type in (
      'bto',
      'resale_hdb',
      'resale_ec_condo',
      'new_launch_ec_condo',
      'landed',
      'hdb',
      'condo',
      'ec',
      'overseas',
      'other',
      'unknown'
    )
  );

alter table public.financial_housing_loans
  add column if not exists property_purchase_year integer
    check (
      property_purchase_year is null
      or (property_purchase_year >= 1960 and property_purchase_year <= 2100)
    ),
  add column if not exists first_downpayment_total numeric(14, 2)
    check (first_downpayment_total is null or first_downpayment_total >= 0),
  add column if not exists first_downpayment_paid_month text
    check (
      first_downpayment_paid_month is null
      or first_downpayment_paid_month ~ '^[0-9]{4}-[0-9]{2}$'
    ),
  add column if not exists first_downpayment_cpf_oa numeric(14, 2)
    check (first_downpayment_cpf_oa is null or first_downpayment_cpf_oa >= 0),
  add column if not exists first_downpayment_cash numeric(14, 2)
    check (first_downpayment_cash is null or first_downpayment_cash >= 0),
  add column if not exists bsd_legal_total numeric(14, 2)
    check (bsd_legal_total is null or bsd_legal_total >= 0),
  add column if not exists bsd_legal_paid_month text
    check (
      bsd_legal_paid_month is null
      or bsd_legal_paid_month ~ '^[0-9]{4}-[0-9]{2}$'
    ),
  add column if not exists bsd_legal_cpf_oa numeric(14, 2)
    check (bsd_legal_cpf_oa is null or bsd_legal_cpf_oa >= 0),
  add column if not exists bsd_legal_cash numeric(14, 2)
    check (bsd_legal_cash is null or bsd_legal_cash >= 0),
  add column if not exists second_downpayment_total numeric(14, 2)
    check (second_downpayment_total is null or second_downpayment_total >= 0),
  add column if not exists second_downpayment_paid_month text
    check (
      second_downpayment_paid_month is null
      or second_downpayment_paid_month ~ '^[0-9]{4}-[0-9]{2}$'
    ),
  add column if not exists second_downpayment_cpf_oa numeric(14, 2)
    check (second_downpayment_cpf_oa is null or second_downpayment_cpf_oa >= 0),
  add column if not exists second_downpayment_cash numeric(14, 2)
    check (second_downpayment_cash is null or second_downpayment_cash >= 0);

comment on column public.financial_properties.purchase_year is
  'Purchase / booking year used for historical BSD schedule selection.';

comment on column public.financial_housing_loans.property_purchase_year is
  'Purchase / booking year snapshot used for historical BSD schedule selection.';

comment on column public.financial_housing_loans.first_downpayment_paid_month is
  'First downpayment / upfront payment month, normalized to YYYY-MM from the HDB MVP form.';

comment on column public.financial_housing_loans.bsd_legal_paid_month is
  'BSD and legal fee payment month, normalized to YYYY-MM from the HDB MVP form.';

comment on column public.financial_housing_loans.second_downpayment_paid_month is
  'Second downpayment payment month, normalized to YYYY-MM from the HDB MVP form.';

commit;
