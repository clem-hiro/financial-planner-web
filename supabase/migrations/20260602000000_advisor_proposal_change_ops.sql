-- Advisor proposal change-ops (P2 — create/update/delete + idempotent edits).
--
--   * change_op classifies each change: 'create' (new entry; entity_id null,
--     grouped by draft_entity_key), 'update' (edit an existing entry),
--     'delete' (remove an existing entry). `default 'update'` backfills
--     existing rows safely (brief code/migration order-skew stays correct).
--   * base_version carries the per-entity updated_at captured at suggest-time
--     so accept can detect a baseline that moved underneath (optimistic
--     concurrency; the guard itself lives in the accept writer). Opaque text
--     token — null means "unversioned, apply without guard" (legacy rows).
--   * The single all-cases unique constraint is replaced by two partial unique
--     indexes: existing entries dedupe on entity_id; new (create) entries
--     dedupe on draft_entity_key (entity_id is null until accept inserts the
--     real row).
--
-- Forward-only, idempotent. Operator-applied in the Supabase SQL editor.

begin;

alter table public.advisor_proposal_changes
  add column if not exists change_op text not null default 'update'
    check (change_op in ('create', 'update', 'delete')),
  add column if not exists draft_entity_key text,
  add column if not exists base_version text;

alter table public.advisor_proposal_changes
  drop constraint if exists advisor_proposal_changes_unique_field;

create unique index if not exists advisor_proposal_changes_unique_field_entity
  on public.advisor_proposal_changes (proposal_id, entity_type, entity_id, field_key)
  where entity_id is not null;

create unique index if not exists advisor_proposal_changes_unique_field_draft
  on public.advisor_proposal_changes (proposal_id, entity_type, draft_entity_key, field_key)
  where entity_id is null and draft_entity_key is not null;

commit;
