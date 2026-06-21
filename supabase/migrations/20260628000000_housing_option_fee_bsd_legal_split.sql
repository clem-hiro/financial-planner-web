-- Split HDB housing upfront events: option fee, BSD, and legal fees (separate dates/CPF splits).

begin;

alter table public.financial_housing_loans
  add column if not exists option_fee_total numeric(14, 2)
    check (option_fee_total is null or option_fee_total >= 0),
  add column if not exists option_fee_paid_month text
    check (
      option_fee_paid_month is null
      or option_fee_paid_month ~ '^[0-9]{4}-[0-9]{2}$'
    ),
  add column if not exists option_fee_cpf_oa numeric(14, 2)
    check (option_fee_cpf_oa is null or option_fee_cpf_oa >= 0),
  add column if not exists option_fee_cash numeric(14, 2)
    check (option_fee_cash is null or option_fee_cash >= 0),
  add column if not exists bsd_total numeric(14, 2)
    check (bsd_total is null or bsd_total >= 0),
  add column if not exists bsd_paid_month text
    check (
      bsd_paid_month is null
      or bsd_paid_month ~ '^[0-9]{4}-[0-9]{2}$'
    ),
  add column if not exists bsd_cpf_oa numeric(14, 2)
    check (bsd_cpf_oa is null or bsd_cpf_oa >= 0),
  add column if not exists bsd_cash numeric(14, 2)
    check (bsd_cash is null or bsd_cash >= 0),
  add column if not exists legal_fee_total numeric(14, 2)
    check (legal_fee_total is null or legal_fee_total >= 0),
  add column if not exists legal_fee_paid_month text
    check (
      legal_fee_paid_month is null
      or legal_fee_paid_month ~ '^[0-9]{4}-[0-9]{2}$'
    ),
  add column if not exists legal_fee_cpf_oa numeric(14, 2)
    check (legal_fee_cpf_oa is null or legal_fee_cpf_oa >= 0),
  add column if not exists legal_fee_cash numeric(14, 2)
    check (legal_fee_cash is null or legal_fee_cash >= 0);

comment on column public.financial_housing_loans.option_fee_paid_month is
  'BTO option fee month (YYYY-MM). CPF OA deductions use this date when option_fee_cpf_oa > 0.';

comment on column public.financial_housing_loans.bsd_paid_month is
  'Buyer''s stamp duty payment month (YYYY-MM), separate from legal fees for CPF timing.';

comment on column public.financial_housing_loans.legal_fee_paid_month is
  'Legal fee payment month (YYYY-MM). Estimate only — confirm with your bank/solicitor.';

commit;
