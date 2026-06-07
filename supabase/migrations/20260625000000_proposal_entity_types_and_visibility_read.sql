-- Phase 2 — proposal entity_type expansion + advisor-facing category-visibility
-- read.
--
-- (1) Widen advisor_proposal_changes.entity_type to the 9 categories. All 5 new
--     types are added at once even though only cash_account has a compose path
--     today: no path emits a type until its phase ships, and the accept writer
--     explicitly rejects any entity_type it doesn't handle. Adding now avoids a
--     migration per phase.
-- (2) advisor_read_category_visibility — lets the advisor UI know which of the 5
--     sensitive categories are PRIVATE (to render a locked card) WITHOUT
--     exposing any data. Gated on master consent; returns nothing when the
--     advisor has no consent, else all 5 rows with missing ⇒ false.
--
-- Forward-only. Operator-applied with an owner/superuser-capable role.

begin;

-- ---------------------------------------------------------------------------
-- (1) entity_type CHECK widening. The original inline check (20260524000000)
-- is auto-named <table>_<column>_check; drop + re-add with the full 9-type set.
-- ---------------------------------------------------------------------------
alter table public.advisor_proposal_changes
  drop constraint if exists advisor_proposal_changes_entity_type_check;

alter table public.advisor_proposal_changes
  add constraint advisor_proposal_changes_entity_type_check
  check (entity_type in (
    'profile', 'budget_line', 'goal', 'investment',
    'cash_account', 'liability', 'property', 'housing_loan', 'vehicle'
  ));

-- ---------------------------------------------------------------------------
-- (2) advisor_read_category_visibility — visibility flags only, never data.
-- search_path = '' (fully-qualified). The WHERE gate means a non-consented
-- advisor gets ZERO rows; a consented advisor gets all 5, coalescing a missing
-- bridge row to false (default-deny / private).
-- ---------------------------------------------------------------------------
create or replace function public.advisor_read_category_visibility(p_client uuid)
returns table (visibility_category text, is_visible boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select cat.visibility_category,
         coalesce(v.is_visible, false) as is_visible
  from (values
    ('cash_accounts'),
    ('liabilities'),
    ('properties'),
    ('housing_loans'),
    ('vehicles')
  ) as cat(visibility_category)
  left join public.advisor_consent_category_visibility v
    on v.client_user_id = p_client
   and v.advisor_user_id = (select auth.uid())
   and v.visibility_category = cat.visibility_category
  where public.advisor_can_read_client(p_client);
$$;

revoke all on function public.advisor_read_category_visibility(uuid) from public;
grant execute on function public.advisor_read_category_visibility(uuid) to authenticated;

commit;
