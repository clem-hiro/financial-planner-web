-- Advisors with linked clients (financial_profiles.advisor_user_id = auth.uid()) may
-- read/update client financial rows alongside existing owner policies. No service role
-- exposure; policies use EXISTS on financial_profiles only for linked clients.

begin;

create index if not exists financial_profiles_advisor_client_idx
  on public.financial_profiles (advisor_user_id)
  where profile_type = 'client';

-- ---------------------------------------------------------------------------
-- financial_profiles: advisors may update linked client planning fields
-- (WITH CHECK keeps profile_type + advisor_user_id stable.)
-- ---------------------------------------------------------------------------
drop policy if exists "financial_profiles_update_advisor_linked_clients"
  on public.financial_profiles;

create policy "financial_profiles_update_advisor_linked_clients"
  on public.financial_profiles
  for update
  using (
    profile_type = 'client'
    and advisor_user_id = (select auth.uid())
  )
  with check (
    profile_type = 'client'
    and advisor_user_id = (select auth.uid())
  );

-- ---------------------------------------------------------------------------
-- Helper macro pattern: EXISTS subquery per table (no SECURITY DEFINER).
-- ---------------------------------------------------------------------------

-- financial_expenses
drop policy if exists "financial_expenses_select_advisor_clients" on public.financial_expenses;
drop policy if exists "financial_expenses_insert_advisor_clients" on public.financial_expenses;
drop policy if exists "financial_expenses_update_advisor_clients" on public.financial_expenses;
drop policy if exists "financial_expenses_delete_advisor_clients" on public.financial_expenses;

create policy "financial_expenses_select_advisor_clients"
  on public.financial_expenses for select using (
    exists (
      select 1 from public.financial_profiles fp
      where fp.id = financial_expenses.user_id
        and fp.profile_type = 'client'
        and fp.advisor_user_id = (select auth.uid())
    )
  );
create policy "financial_expenses_insert_advisor_clients"
  on public.financial_expenses for insert with check (
    exists (
      select 1 from public.financial_profiles fp
      where fp.id = financial_expenses.user_id
        and fp.profile_type = 'client'
        and fp.advisor_user_id = (select auth.uid())
    )
  );
create policy "financial_expenses_update_advisor_clients"
  on public.financial_expenses for update using (
    exists (
      select 1 from public.financial_profiles fp
      where fp.id = financial_expenses.user_id
        and fp.profile_type = 'client'
        and fp.advisor_user_id = (select auth.uid())
    )
  ) with check (
    exists (
      select 1 from public.financial_profiles fp
      where fp.id = financial_expenses.user_id
        and fp.profile_type = 'client'
        and fp.advisor_user_id = (select auth.uid())
    )
  );
create policy "financial_expenses_delete_advisor_clients"
  on public.financial_expenses for delete using (
    exists (
      select 1 from public.financial_profiles fp
      where fp.id = financial_expenses.user_id
        and fp.profile_type = 'client'
        and fp.advisor_user_id = (select auth.uid())
    )
  );

-- financial_investments
drop policy if exists "financial_investments_select_advisor_clients" on public.financial_investments;
drop policy if exists "financial_investments_insert_advisor_clients" on public.financial_investments;
drop policy if exists "financial_investments_update_advisor_clients" on public.financial_investments;
drop policy if exists "financial_investments_delete_advisor_clients" on public.financial_investments;

create policy "financial_investments_select_advisor_clients"
  on public.financial_investments for select using (
    exists (
      select 1 from public.financial_profiles fp
      where fp.id = financial_investments.user_id
        and fp.profile_type = 'client'
        and fp.advisor_user_id = (select auth.uid())
    )
  );
create policy "financial_investments_insert_advisor_clients"
  on public.financial_investments for insert with check (
    exists (
      select 1 from public.financial_profiles fp
      where fp.id = financial_investments.user_id
        and fp.profile_type = 'client'
        and fp.advisor_user_id = (select auth.uid())
    )
  );
create policy "financial_investments_update_advisor_clients"
  on public.financial_investments for update using (
    exists (
      select 1 from public.financial_profiles fp
      where fp.id = financial_investments.user_id
        and fp.profile_type = 'client'
        and fp.advisor_user_id = (select auth.uid())
    )
  ) with check (
    exists (
      select 1 from public.financial_profiles fp
      where fp.id = financial_investments.user_id
        and fp.profile_type = 'client'
        and fp.advisor_user_id = (select auth.uid())
    )
  );
create policy "financial_investments_delete_advisor_clients"
  on public.financial_investments for delete using (
    exists (
      select 1 from public.financial_profiles fp
      where fp.id = financial_investments.user_id
        and fp.profile_type = 'client'
        and fp.advisor_user_id = (select auth.uid())
    )
  );

-- financial_goals
drop policy if exists "financial_goals_select_advisor_clients" on public.financial_goals;
drop policy if exists "financial_goals_insert_advisor_clients" on public.financial_goals;
drop policy if exists "financial_goals_update_advisor_clients" on public.financial_goals;
drop policy if exists "financial_goals_delete_advisor_clients" on public.financial_goals;

create policy "financial_goals_select_advisor_clients"
  on public.financial_goals for select using (
    exists (
      select 1 from public.financial_profiles fp
      where fp.id = financial_goals.user_id
        and fp.profile_type = 'client'
        and fp.advisor_user_id = (select auth.uid())
    )
  );
create policy "financial_goals_insert_advisor_clients"
  on public.financial_goals for insert with check (
    exists (
      select 1 from public.financial_profiles fp
      where fp.id = financial_goals.user_id
        and fp.profile_type = 'client'
        and fp.advisor_user_id = (select auth.uid())
    )
  );
create policy "financial_goals_update_advisor_clients"
  on public.financial_goals for update using (
    exists (
      select 1 from public.financial_profiles fp
      where fp.id = financial_goals.user_id
        and fp.profile_type = 'client'
        and fp.advisor_user_id = (select auth.uid())
    )
  ) with check (
    exists (
      select 1 from public.financial_profiles fp
      where fp.id = financial_goals.user_id
        and fp.profile_type = 'client'
        and fp.advisor_user_id = (select auth.uid())
    )
  );
create policy "financial_goals_delete_advisor_clients"
  on public.financial_goals for delete using (
    exists (
      select 1 from public.financial_profiles fp
      where fp.id = financial_goals.user_id
        and fp.profile_type = 'client'
        and fp.advisor_user_id = (select auth.uid())
    )
  );

-- financial_budget_lines
drop policy if exists "financial_budget_lines_select_advisor_clients" on public.financial_budget_lines;
drop policy if exists "financial_budget_lines_insert_advisor_clients" on public.financial_budget_lines;
drop policy if exists "financial_budget_lines_update_advisor_clients" on public.financial_budget_lines;
drop policy if exists "financial_budget_lines_delete_advisor_clients" on public.financial_budget_lines;

create policy "financial_budget_lines_select_advisor_clients"
  on public.financial_budget_lines for select using (
    exists (
      select 1 from public.financial_profiles fp
      where fp.id = financial_budget_lines.user_id
        and fp.profile_type = 'client'
        and fp.advisor_user_id = (select auth.uid())
    )
  );
create policy "financial_budget_lines_insert_advisor_clients"
  on public.financial_budget_lines for insert with check (
    exists (
      select 1 from public.financial_profiles fp
      where fp.id = financial_budget_lines.user_id
        and fp.profile_type = 'client'
        and fp.advisor_user_id = (select auth.uid())
    )
  );
create policy "financial_budget_lines_update_advisor_clients"
  on public.financial_budget_lines for update using (
    exists (
      select 1 from public.financial_profiles fp
      where fp.id = financial_budget_lines.user_id
        and fp.profile_type = 'client'
        and fp.advisor_user_id = (select auth.uid())
    )
  ) with check (
    exists (
      select 1 from public.financial_profiles fp
      where fp.id = financial_budget_lines.user_id
        and fp.profile_type = 'client'
        and fp.advisor_user_id = (select auth.uid())
    )
  );
create policy "financial_budget_lines_delete_advisor_clients"
  on public.financial_budget_lines for delete using (
    exists (
      select 1 from public.financial_profiles fp
      where fp.id = financial_budget_lines.user_id
        and fp.profile_type = 'client'
        and fp.advisor_user_id = (select auth.uid())
    )
  );

-- financial_budget_line_month_overrides
drop policy if exists "financial_budget_line_month_overrides_select_advisor_clients"
  on public.financial_budget_line_month_overrides;
drop policy if exists "financial_budget_line_month_overrides_insert_advisor_clients"
  on public.financial_budget_line_month_overrides;
drop policy if exists "financial_budget_line_month_overrides_update_advisor_clients"
  on public.financial_budget_line_month_overrides;
drop policy if exists "financial_budget_line_month_overrides_delete_advisor_clients"
  on public.financial_budget_line_month_overrides;

create policy "financial_budget_line_month_overrides_select_advisor_clients"
  on public.financial_budget_line_month_overrides for select using (
    exists (
      select 1 from public.financial_profiles fp
      where fp.id = financial_budget_line_month_overrides.user_id
        and fp.profile_type = 'client'
        and fp.advisor_user_id = (select auth.uid())
    )
  );
create policy "financial_budget_line_month_overrides_insert_advisor_clients"
  on public.financial_budget_line_month_overrides for insert with check (
    exists (
      select 1 from public.financial_profiles fp
      where fp.id = financial_budget_line_month_overrides.user_id
        and fp.profile_type = 'client'
        and fp.advisor_user_id = (select auth.uid())
    )
  );
create policy "financial_budget_line_month_overrides_update_advisor_clients"
  on public.financial_budget_line_month_overrides for update using (
    exists (
      select 1 from public.financial_profiles fp
      where fp.id = financial_budget_line_month_overrides.user_id
        and fp.profile_type = 'client'
        and fp.advisor_user_id = (select auth.uid())
    )
  ) with check (
    exists (
      select 1 from public.financial_profiles fp
      where fp.id = financial_budget_line_month_overrides.user_id
        and fp.profile_type = 'client'
        and fp.advisor_user_id = (select auth.uid())
    )
  );
create policy "financial_budget_line_month_overrides_delete_advisor_clients"
  on public.financial_budget_line_month_overrides for delete using (
    exists (
      select 1 from public.financial_profiles fp
      where fp.id = financial_budget_line_month_overrides.user_id
        and fp.profile_type = 'client'
        and fp.advisor_user_id = (select auth.uid())
    )
  );

-- financial_cash_accounts
drop policy if exists "financial_cash_accounts_select_advisor_clients" on public.financial_cash_accounts;
drop policy if exists "financial_cash_accounts_insert_advisor_clients" on public.financial_cash_accounts;
drop policy if exists "financial_cash_accounts_update_advisor_clients" on public.financial_cash_accounts;
drop policy if exists "financial_cash_accounts_delete_advisor_clients" on public.financial_cash_accounts;

create policy "financial_cash_accounts_select_advisor_clients"
  on public.financial_cash_accounts for select using (
    exists (
      select 1 from public.financial_profiles fp
      where fp.id = financial_cash_accounts.user_id
        and fp.profile_type = 'client'
        and fp.advisor_user_id = (select auth.uid())
    )
  );
create policy "financial_cash_accounts_insert_advisor_clients"
  on public.financial_cash_accounts for insert with check (
    exists (
      select 1 from public.financial_profiles fp
      where fp.id = financial_cash_accounts.user_id
        and fp.profile_type = 'client'
        and fp.advisor_user_id = (select auth.uid())
    )
  );
create policy "financial_cash_accounts_update_advisor_clients"
  on public.financial_cash_accounts for update using (
    exists (
      select 1 from public.financial_profiles fp
      where fp.id = financial_cash_accounts.user_id
        and fp.profile_type = 'client'
        and fp.advisor_user_id = (select auth.uid())
    )
  ) with check (
    exists (
      select 1 from public.financial_profiles fp
      where fp.id = financial_cash_accounts.user_id
        and fp.profile_type = 'client'
        and fp.advisor_user_id = (select auth.uid())
    )
  );
create policy "financial_cash_accounts_delete_advisor_clients"
  on public.financial_cash_accounts for delete using (
    exists (
      select 1 from public.financial_profiles fp
      where fp.id = financial_cash_accounts.user_id
        and fp.profile_type = 'client'
        and fp.advisor_user_id = (select auth.uid())
    )
  );

-- financial_liabilities
drop policy if exists "financial_liabilities_select_advisor_clients" on public.financial_liabilities;
drop policy if exists "financial_liabilities_insert_advisor_clients" on public.financial_liabilities;
drop policy if exists "financial_liabilities_update_advisor_clients" on public.financial_liabilities;
drop policy if exists "financial_liabilities_delete_advisor_clients" on public.financial_liabilities;

create policy "financial_liabilities_select_advisor_clients"
  on public.financial_liabilities for select using (
    exists (
      select 1 from public.financial_profiles fp
      where fp.id = financial_liabilities.user_id
        and fp.profile_type = 'client'
        and fp.advisor_user_id = (select auth.uid())
    )
  );
create policy "financial_liabilities_insert_advisor_clients"
  on public.financial_liabilities for insert with check (
    exists (
      select 1 from public.financial_profiles fp
      where fp.id = financial_liabilities.user_id
        and fp.profile_type = 'client'
        and fp.advisor_user_id = (select auth.uid())
    )
  );
create policy "financial_liabilities_update_advisor_clients"
  on public.financial_liabilities for update using (
    exists (
      select 1 from public.financial_profiles fp
      where fp.id = financial_liabilities.user_id
        and fp.profile_type = 'client'
        and fp.advisor_user_id = (select auth.uid())
    )
  ) with check (
    exists (
      select 1 from public.financial_profiles fp
      where fp.id = financial_liabilities.user_id
        and fp.profile_type = 'client'
        and fp.advisor_user_id = (select auth.uid())
    )
  );
create policy "financial_liabilities_delete_advisor_clients"
  on public.financial_liabilities for delete using (
    exists (
      select 1 from public.financial_profiles fp
      where fp.id = financial_liabilities.user_id
        and fp.profile_type = 'client'
        and fp.advisor_user_id = (select auth.uid())
    )
  );

-- financial_cpf_balances
drop policy if exists "financial_cpf_balances_select_advisor_clients" on public.financial_cpf_balances;
drop policy if exists "financial_cpf_balances_insert_advisor_clients" on public.financial_cpf_balances;
drop policy if exists "financial_cpf_balances_update_advisor_clients" on public.financial_cpf_balances;
drop policy if exists "financial_cpf_balances_delete_advisor_clients" on public.financial_cpf_balances;

create policy "financial_cpf_balances_select_advisor_clients"
  on public.financial_cpf_balances for select using (
    exists (
      select 1 from public.financial_profiles fp
      where fp.id = financial_cpf_balances.user_id
        and fp.profile_type = 'client'
        and fp.advisor_user_id = (select auth.uid())
    )
  );
create policy "financial_cpf_balances_insert_advisor_clients"
  on public.financial_cpf_balances for insert with check (
    exists (
      select 1 from public.financial_profiles fp
      where fp.id = financial_cpf_balances.user_id
        and fp.profile_type = 'client'
        and fp.advisor_user_id = (select auth.uid())
    )
  );
create policy "financial_cpf_balances_update_advisor_clients"
  on public.financial_cpf_balances for update using (
    exists (
      select 1 from public.financial_profiles fp
      where fp.id = financial_cpf_balances.user_id
        and fp.profile_type = 'client'
        and fp.advisor_user_id = (select auth.uid())
    )
  ) with check (
    exists (
      select 1 from public.financial_profiles fp
      where fp.id = financial_cpf_balances.user_id
        and fp.profile_type = 'client'
        and fp.advisor_user_id = (select auth.uid())
    )
  );
create policy "financial_cpf_balances_delete_advisor_clients"
  on public.financial_cpf_balances for delete using (
    exists (
      select 1 from public.financial_profiles fp
      where fp.id = financial_cpf_balances.user_id
        and fp.profile_type = 'client'
        and fp.advisor_user_id = (select auth.uid())
    )
  );

-- financial_housing_loans
drop policy if exists "financial_housing_loans_select_advisor_clients" on public.financial_housing_loans;
drop policy if exists "financial_housing_loans_insert_advisor_clients" on public.financial_housing_loans;
drop policy if exists "financial_housing_loans_update_advisor_clients" on public.financial_housing_loans;
drop policy if exists "financial_housing_loans_delete_advisor_clients" on public.financial_housing_loans;

create policy "financial_housing_loans_select_advisor_clients"
  on public.financial_housing_loans for select using (
    exists (
      select 1 from public.financial_profiles fp
      where fp.id = financial_housing_loans.user_id
        and fp.profile_type = 'client'
        and fp.advisor_user_id = (select auth.uid())
    )
  );
create policy "financial_housing_loans_insert_advisor_clients"
  on public.financial_housing_loans for insert with check (
    exists (
      select 1 from public.financial_profiles fp
      where fp.id = financial_housing_loans.user_id
        and fp.profile_type = 'client'
        and fp.advisor_user_id = (select auth.uid())
    )
  );
create policy "financial_housing_loans_update_advisor_clients"
  on public.financial_housing_loans for update using (
    exists (
      select 1 from public.financial_profiles fp
      where fp.id = financial_housing_loans.user_id
        and fp.profile_type = 'client'
        and fp.advisor_user_id = (select auth.uid())
    )
  ) with check (
    exists (
      select 1 from public.financial_profiles fp
      where fp.id = financial_housing_loans.user_id
        and fp.profile_type = 'client'
        and fp.advisor_user_id = (select auth.uid())
    )
  );
create policy "financial_housing_loans_delete_advisor_clients"
  on public.financial_housing_loans for delete using (
    exists (
      select 1 from public.financial_profiles fp
      where fp.id = financial_housing_loans.user_id
        and fp.profile_type = 'client'
        and fp.advisor_user_id = (select auth.uid())
    )
  );

-- financial_vehicles
drop policy if exists "financial_vehicles_select_advisor_clients" on public.financial_vehicles;
drop policy if exists "financial_vehicles_insert_advisor_clients" on public.financial_vehicles;
drop policy if exists "financial_vehicles_update_advisor_clients" on public.financial_vehicles;
drop policy if exists "financial_vehicles_delete_advisor_clients" on public.financial_vehicles;

create policy "financial_vehicles_select_advisor_clients"
  on public.financial_vehicles for select using (
    exists (
      select 1 from public.financial_profiles fp
      where fp.id = financial_vehicles.user_id
        and fp.profile_type = 'client'
        and fp.advisor_user_id = (select auth.uid())
    )
  );
create policy "financial_vehicles_insert_advisor_clients"
  on public.financial_vehicles for insert with check (
    exists (
      select 1 from public.financial_profiles fp
      where fp.id = financial_vehicles.user_id
        and fp.profile_type = 'client'
        and fp.advisor_user_id = (select auth.uid())
    )
  );
create policy "financial_vehicles_update_advisor_clients"
  on public.financial_vehicles for update using (
    exists (
      select 1 from public.financial_profiles fp
      where fp.id = financial_vehicles.user_id
        and fp.profile_type = 'client'
        and fp.advisor_user_id = (select auth.uid())
    )
  ) with check (
    exists (
      select 1 from public.financial_profiles fp
      where fp.id = financial_vehicles.user_id
        and fp.profile_type = 'client'
        and fp.advisor_user_id = (select auth.uid())
    )
  );
create policy "financial_vehicles_delete_advisor_clients"
  on public.financial_vehicles for delete using (
    exists (
      select 1 from public.financial_profiles fp
      where fp.id = financial_vehicles.user_id
        and fp.profile_type = 'client'
        and fp.advisor_user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- Paginated advisor client roster + lightweight activity + income for signals
-- ---------------------------------------------------------------------------
create or replace function public.advisor_client_list_metrics(
  p_limit int default 50,
  p_offset int default 0,
  p_search text default null,
  p_sort text default 'created_desc'
)
returns table (
  id uuid,
  display_name text,
  profile_type text,
  onboarding_required boolean,
  onboarding_completed_at timestamptz,
  created_at timestamptz,
  monthly_income numeric,
  savings_target_monthly numeric,
  fixed_expenses_monthly numeric,
  monthly_gross_salary numeric,
  last_expense_spent_at date,
  expense_count bigint,
  total_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    fp.id,
    fp.display_name,
    fp.profile_type::text,
    fp.onboarding_required,
    fp.onboarding_completed_at,
    fp.created_at,
    fp.monthly_income,
    fp.savings_target_monthly,
    fp.fixed_expenses_monthly,
    fp.monthly_gross_salary,
    agg.last_spent_at,
    coalesce(agg.cnt, 0)::bigint,
    count(*) over ()::bigint
  from public.financial_profiles fp
  left join lateral (
    select
      max(e.spent_at)::date as last_spent_at,
      count(*)::bigint as cnt
    from public.financial_expenses e
    where e.user_id = fp.id
  ) agg on true
  where fp.profile_type = 'client'
    and fp.advisor_user_id = (select auth.uid())
    and (
      p_search is null
      or length(trim(p_search)) < 1
      or fp.display_name ilike '%' || trim(p_search) || '%'
    )
  order by
    case
      when coalesce(nullif(trim(p_sort), ''), 'created_desc') = 'name_asc'
      then lower(coalesce(fp.display_name, ''))
    end asc,
    case
      when coalesce(nullif(trim(p_sort), ''), 'created_desc') = 'last_active_desc'
      then agg.last_spent_at
    end desc nulls last,
    case
      when coalesce(nullif(trim(p_sort), ''), 'created_desc') = 'created_desc'
      then fp.created_at
    end desc nulls last,
    fp.created_at desc,
    fp.id asc
  limit greatest(1, least(p_limit, 200))
  offset greatest(0, p_offset);
$$;

comment on function public.advisor_client_list_metrics(int, int, text, text) is
  'Advisor workspace: paginated linked clients with optional search/sort; uses RLS (invoker).';

revoke all on function public.advisor_client_list_metrics(int, int, text, text) from public;
grant execute on function public.advisor_client_list_metrics(int, int, text, text) to authenticated;

create or replace function public.advisor_client_list_count(p_search text default null)
returns bigint
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::bigint
  from public.financial_profiles fp
  where fp.profile_type = 'client'
    and fp.advisor_user_id = (select auth.uid())
    and (
      p_search is null
      or length(trim(p_search)) < 1
      or fp.display_name ilike '%' || trim(p_search) || '%'
    );
$$;

revoke all on function public.advisor_client_list_count(text) from public;
grant execute on function public.advisor_client_list_count(text) to authenticated;

commit;
