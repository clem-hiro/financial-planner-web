-- CPF-aware instalment funding: cash vs OA vs split (cash-flow vs CPF projection).

alter table public.financial_housing_loans
  add column if not exists payment_source text check (
    payment_source is null
    or payment_source in ('cash', 'cpf_oa', 'split')
  );

alter table public.financial_housing_loans
  add column if not exists cpf_oa_payment numeric(14, 2) check (
    cpf_oa_payment is null or cpf_oa_payment >= 0
  );

alter table public.financial_housing_loans
  add column if not exists cash_payment numeric(14, 2) check (
    cash_payment is null or cash_payment >= 0
  );

comment on column public.financial_housing_loans.payment_source is
  'How each instalment is funded: cash (budget only), cpf_oa (OA projection only), split (both). Null = legacy: infer from oa_share_of_payment.';

comment on column public.financial_housing_loans.cpf_oa_payment is
  'Fixed monthly OA portion when payment_source = split; null = derive from instalment minus cash_payment or 50/50.';

comment on column public.financial_housing_loans.cash_payment is
  'Fixed monthly cash portion when payment_source = split; null = instalment minus cpf_oa_payment.';
