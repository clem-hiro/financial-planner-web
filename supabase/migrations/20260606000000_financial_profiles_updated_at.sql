-- CORRECTIVE for migration 20260603000000's false precondition.
--
-- 20260603000000 added a `set_updated_at` BEFORE UPDATE trigger on
-- public.financial_profiles, asserting in its comment that the table
-- "already has updated_at". That assertion was FALSE for the real shared
-- DB — the column did not exist — so every financial_profiles UPDATE in
-- production failed with: record "new" has no field "updated_at". The user
-- hand-applied the equivalent of the statement below as a hotfix and
-- re-verified prod (all checks green, profile UPDATEs restored).
--
-- THIS FILE IS FOR REPO / VERSION-CONTROL PARITY (and future environments)
-- so the tracked migration set matches deployed reality. The USER DOES NOT
-- NEED TO RUN ANYTHING NEW — prod already has this column. It is idempotent
-- (`add column if not exists`), so a re-run is a harmless no-op.
--
-- Fresh-environment caveat (surfaced, not silently reconciled): in a clean
-- environment migrations apply in timestamp order, so 20260603's trigger is
-- created BEFORE this column exists. Between applying 20260603 and this file
-- any financial_profiles UPDATE will fail. Mitigation for fresh bootstraps:
-- apply the full migration set through 20260606 before exercising the app;
-- a future fresh-env consolidation/squash should fold this column add into
-- (or ahead of) 20260603. The already-applied prod DB is unaffected (column
-- present via the hotfix; this file is parity only). Editing the
-- already-applied 20260603 in place is deliberately NOT done (forward-only;
-- no migration ledger — retroactively mutating an applied migration is the
-- anti-pattern this corrective avoids).
--
-- Forward-only, idempotent. Operator-applied in the Supabase SQL editor
-- (no-op on prod — already present).

begin;

alter table public.financial_profiles
  add column if not exists updated_at timestamptz not null default now();

commit;
