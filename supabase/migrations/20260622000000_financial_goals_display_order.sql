-- Goal priority: display_order for client-defined funding order (lower = higher priority).

alter table public.financial_goals
  add column if not exists display_order integer not null default 0;

with numbered as (
  select
    id,
    (row_number() over (partition by user_id order by created_at asc) - 1)::integer as rn
  from public.financial_goals
)
update public.financial_goals g
set display_order = n.rn
from numbered n
where g.id = n.id;

-- Advisor read mirrors listFinancialGoals ordering.
create or replace function public.advisor_read_goals(p_client uuid)
returns setof public.financial_goals
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
begin
  if not public.advisor_can_read_client(p_client) then
    return;
  end if;
  return query
    select *
    from public.financial_goals
    where user_id = p_client
    order by display_order asc, created_at asc;
end;
$$;
