-- Apply consistent financial_* naming on public app tables.
-- financial_goals already uses the prefix; all other user data tables are renamed.
-- Run after existing migrations. Updates handle_new_user() to insert into the renamed profile table.

begin;

alter table public.profiles rename to financial_profiles;
alter table public.expenses rename to financial_expenses;
alter table public.investments rename to financial_investments;
alter table public.budget_lines rename to financial_budget_lines;
alter table public.budget_line_month_overrides rename to financial_budget_line_month_overrides;
alter table public.cash_accounts rename to financial_cash_accounts;
alter table public.liabilities rename to financial_liabilities;
alter table public.cpf_balances rename to financial_cpf_balances;
alter table public.housing_loans rename to financial_housing_loans;
alter table public.vehicles rename to financial_vehicles;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.financial_profiles (id)
  values (new.id);
  return new;
end;
$$;

commit;
