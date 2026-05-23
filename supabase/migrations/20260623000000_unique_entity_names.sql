-- Enforce per-user, case-insensitive, trimmed uniqueness on user-named entities.
-- Prevents the "two accounts both named ilp2" class of bug at the DB level.
--
-- Each table: first defensively rename any existing duplicates (oldest row keeps
-- the bare name; later rows get ' 2', ' 3', … suffixes) so the index can build,
-- then create the functional unique index on (user_id, lower(btrim(<col>))).
-- The audit (2026-05-23, prod) found zero duplicates, so the UPDATEs are no-ops
-- here; they are retained to handle the common case on any DB that does have
-- dupes. Caveat: the ' 2'/' 3' suffix can itself collide with a pre-existing
-- '<base> <int>' row, which would abort the index build — such a DB needs the
-- loop-based next-free-integer rename (plan Phase 1 note) before this applies.

-- financial_investments.name
with ranked as (
  select id,
         row_number() over (
           partition by user_id, lower(btrim(name))
           order by created_at, id
         ) rn
  from public.financial_investments
)
update public.financial_investments t
set name = btrim(t.name) || ' ' || r.rn
from ranked r
where t.id = r.id and r.rn > 1;

create unique index if not exists financial_investments_user_name_ci_uq
  on public.financial_investments (user_id, lower(btrim(name)));

-- financial_goals.title
with ranked as (
  select id,
         row_number() over (
           partition by user_id, lower(btrim(title))
           order by created_at, id
         ) rn
  from public.financial_goals
)
update public.financial_goals t
set title = btrim(t.title) || ' ' || r.rn
from ranked r
where t.id = r.id and r.rn > 1;

create unique index if not exists financial_goals_user_name_ci_uq
  on public.financial_goals (user_id, lower(btrim(title)));

-- financial_liabilities.name
with ranked as (
  select id,
         row_number() over (
           partition by user_id, lower(btrim(name))
           order by created_at, id
         ) rn
  from public.financial_liabilities
)
update public.financial_liabilities t
set name = btrim(t.name) || ' ' || r.rn
from ranked r
where t.id = r.id and r.rn > 1;

create unique index if not exists financial_liabilities_user_name_ci_uq
  on public.financial_liabilities (user_id, lower(btrim(name)));

-- financial_properties.name
with ranked as (
  select id,
         row_number() over (
           partition by user_id, lower(btrim(name))
           order by created_at, id
         ) rn
  from public.financial_properties
)
update public.financial_properties t
set name = btrim(t.name) || ' ' || r.rn
from ranked r
where t.id = r.id and r.rn > 1;

create unique index if not exists financial_properties_user_name_ci_uq
  on public.financial_properties (user_id, lower(btrim(name)));

-- financial_cash_accounts.name (per user_id only — purpose is intentionally ignored)
with ranked as (
  select id,
         row_number() over (
           partition by user_id, lower(btrim(name))
           order by created_at, id
         ) rn
  from public.financial_cash_accounts
)
update public.financial_cash_accounts t
set name = btrim(t.name) || ' ' || r.rn
from ranked r
where t.id = r.id and r.rn > 1;

create unique index if not exists financial_cash_accounts_user_name_ci_uq
  on public.financial_cash_accounts (user_id, lower(btrim(name)));

-- financial_housing_loans.label (default 'Home loan' → existing dups get suffixed)
with ranked as (
  select id,
         row_number() over (
           partition by user_id, lower(btrim(label))
           order by created_at, id
         ) rn
  from public.financial_housing_loans
)
update public.financial_housing_loans t
set label = btrim(t.label) || ' ' || r.rn
from ranked r
where t.id = r.id and r.rn > 1;

create unique index if not exists financial_housing_loans_user_name_ci_uq
  on public.financial_housing_loans (user_id, lower(btrim(label)));

-- financial_vehicles.label (default 'Vehicle' → existing dups get suffixed)
with ranked as (
  select id,
         row_number() over (
           partition by user_id, lower(btrim(label))
           order by created_at, id
         ) rn
  from public.financial_vehicles
)
update public.financial_vehicles t
set label = btrim(t.label) || ' ' || r.rn
from ranked r
where t.id = r.id and r.rn > 1;

create unique index if not exists financial_vehicles_user_name_ci_uq
  on public.financial_vehicles (user_id, lower(btrim(label)));
