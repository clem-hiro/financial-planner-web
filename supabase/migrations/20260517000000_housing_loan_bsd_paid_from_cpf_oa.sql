-- BSD is not part of the mortgage principal; this flag records whether the buyer
-- pays estimated BSD from CPF OA (reduces OA in projection via fees_from_oa) or in cash.

-- `financing_includes_bsd` is created in migration 20260516100000; ensure it exists so this
-- migration stays safe if 20260516 was skipped or only partially applied.
alter table public.financial_housing_loans
  add column if not exists financing_includes_bsd boolean not null default false;

alter table public.financial_housing_loans
  add column if not exists buyers_stamp_duty_paid_from_cpf_oa boolean not null default false;

comment on column public.financial_housing_loans.buyers_stamp_duty_paid_from_cpf_oa is
  'When true, estimated BSD is assumed paid from CPF OA (included in fees_from_oa for projection). When false, BSD is cash and does not reduce OA.';

comment on column public.financial_housing_loans.financing_includes_bsd is
  'Legacy: when true, older guided saves reduced loan principal by estimated BSD. New saves keep this false; use buyers_stamp_duty_paid_from_cpf_oa for OA vs cash BSD.';
