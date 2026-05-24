-- ROLLBACK for 20260626000000_housing_loan_property_composite_fk.sql
--
-- Sidecar — NOT a numbered forward migration; never auto-runs via `db push`.
-- Operator-applied manually with an owner/superuser-capable role.
--
-- Reverses: drop the composite FK, restore the original single-column FK
-- (`financial_housing_loans_property_id_fkey` → financial_properties(id)
-- ON DELETE CASCADE), then drop the (user_id, id) unique. Restoring the
-- single-column FK is safe — the composite FK guaranteed every non-null
-- property_id references a real property.

begin;

alter table public.financial_housing_loans
  drop constraint if exists financial_housing_loans_user_property_fkey;

alter table public.financial_housing_loans
  add constraint financial_housing_loans_property_id_fkey
  foreign key (property_id)
  references public.financial_properties (id)
  on delete cascade;

alter table public.financial_properties
  drop constraint if exists financial_properties_user_id_id_key;

commit;
