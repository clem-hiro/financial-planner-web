-- ROLLBACK for 20260625000000_proposal_entity_types_and_visibility_read.sql
--
-- Sidecar — NOT a numbered forward migration; never auto-runs via `db push`.
-- Operator-applied manually with an owner/superuser-capable role.
--
-- Reverses:
--   1. Drop advisor_read_category_visibility.
--   2. Revert advisor_proposal_changes.entity_type CHECK to the ORIGINAL 4
--      types. The constraint name (advisor_proposal_changes_entity_type_check)
--      matches both the original inline check (20260524000000) and the forward
--      migration's explicit ADD, so the drop/re-add is name-stable.
--
-- CAVEAT: re-adding the 4-type CHECK FAILS if any advisor_proposal_changes row
-- already carries one of the 5 new types (cash_account/liability/property/
-- housing_loan/vehicle). That is fine on a clean scratch/prod where no such row
-- exists yet (cash_account is the only emitter and is unshipped). If new-type
-- rows DO exist, delete or migrate them before running this rollback.

begin;

-- 1. Drop the advisor-facing visibility-flags read.
drop function if exists public.advisor_read_category_visibility(uuid);

-- 2. Revert the entity_type CHECK to the original 4 types.
alter table public.advisor_proposal_changes
  drop constraint if exists advisor_proposal_changes_entity_type_check;

alter table public.advisor_proposal_changes
  add constraint advisor_proposal_changes_entity_type_check
  check (entity_type in ('profile', 'budget_line', 'goal', 'investment'));

commit;
