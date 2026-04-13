-- Standalone goal progress and projection fields (not tied to investments)

alter table public.financial_goals
  add column if not exists current_amount numeric(14, 2) not null default 0
    check (current_amount >= 0),
  add column if not exists monthly_contribution numeric(14, 2) not null default 0
    check (monthly_contribution >= 0),
  add column if not exists expected_annual_return numeric(5, 4) not null default 0
    check (expected_annual_return >= 0 and expected_annual_return <= 1);

-- One-time: seed current_amount from linked investment balance where present
update public.financial_goals g
set current_amount = i.current_value
from public.investments i
where g.linked_investment_id = i.id
  and g.user_id = i.user_id
  and g.current_amount = 0;
