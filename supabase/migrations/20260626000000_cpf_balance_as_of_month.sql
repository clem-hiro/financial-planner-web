alter table public.financial_cpf_balances
  add column if not exists balance_as_of_month text check (
    balance_as_of_month is null or balance_as_of_month ~ '^\d{4}-\d{2}$'
  );
