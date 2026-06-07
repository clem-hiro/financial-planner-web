-- Housing-loan ↔ property same-user composite FK (defense-in-depth behind the
-- app-layer property_id remap guard in apply-changes.ts).
--
-- RECON (current schema):
--   • financial_housing_loans.property_id: NULLABLE uuid, inline single-column FK
--     `financial_housing_loans_property_id_fkey` → financial_properties(id)
--     ON DELETE CASCADE (migration 20260519120000).
--   • financial_properties.id is the PK; no existing unique on (user_id, id).
--
-- This REPLACES the single-column FK with a composite (user_id, property_id) →
-- (user_id, id) FK so a loan can only link to a property owned by the SAME user
-- — cross-client linkage becomes impossible at the DB even if app logic regresses.
-- NULL property_id stays valid (MATCH SIMPLE: a composite FK is not enforced when
-- any referencing column is NULL → unlinked/generic loans are unaffected).
--
-- Additive to existing tables, NO column changes ⇒ types.ts unaffected.
-- Forward-only. Operator-applied with an owner/superuser-capable role.

begin;

-- 1. Guard — abort loudly if any existing row already violates same-user linkage
-- (would otherwise fail opaquely when the composite FK is added).
do $$
declare
  v_bad bigint;
begin
  select count(*) into v_bad
  from public.financial_housing_loans l
  join public.financial_properties p on l.property_id = p.id
  where l.user_id <> p.user_id;
  if v_bad > 0 then
    raise exception
      'Cannot add composite FK: % housing loan(s) link to a property owned by a different user',
      v_bad;
  end if;
end $$;

-- 2. FK-target prerequisite: a unique on (user_id, id). (id alone is already the
-- PK, so this is trivially unique; a composite FK must reference a unique key on
-- exactly the referenced columns.)
alter table public.financial_properties
  add constraint financial_properties_user_id_id_key unique (user_id, id);

-- 3. Drop the legacy single-column FK (subsumed by the composite one — it still
-- enforces that property_id references a real property, now same-user too).
alter table public.financial_housing_loans
  drop constraint if exists financial_housing_loans_property_id_fkey;

-- 4. Composite FK — same ON DELETE CASCADE as the original.
alter table public.financial_housing_loans
  add constraint financial_housing_loans_user_property_fkey
  foreign key (user_id, property_id)
  references public.financial_properties (user_id, id)
  on delete cascade;

commit;
