-- Dedup the dev/POC 100%-discount coupons down to a single canonical code.
--
-- Two global 100%-off coupons exist: `POCUNLIMITED` (canonical, seeded in
-- 20260517100000_advisor_key_purchases_coupons_contact.sql:100) and
-- `DEVPOC-UNLI` (redundant, seeded later in
-- 20260521000000_seed_devpoc_unli_coupon.sql). User decision 2026-05-18:
-- POCUNLIMITED is the only dev 100% coupon; hard-delete DEVPOC-UNLI.
--
-- The 20260521000000 seed is immutable history and is intentionally NOT edited.
-- This migration has a later timestamp prefix, so it runs after that seed in
-- ordered hand-apply too — fresh/redeployed envs end up with DEVPOC-UNLI
-- created-then-deleted (net: gone), identical to existing envs.
--
-- FK handling (verified against 20260517100000):
--   * public.coupon_redemptions.coupon_id -> public.coupons(id)
--       ON DELETE RESTRICT  => dependent redemption rows MUST be deleted first,
--       or the coupons delete raises a foreign-key violation.
--   * public.purchases.coupon_id -> public.coupons(id)
--       ON DELETE SET NULL  => historical purchases that used DEVPOC-UNLI keep
--       their row; coupon_id is auto-nulled by the FK. No manual step, and
--       acceptable for a redundant dev coupon (purchase money columns are
--       already denormalized on the row).
--
-- Idempotent / safe to re-run: both deletes are naturally no-ops once the
-- coupon (and its redemptions) are absent. No DB application here — the
-- operator applies this via the Supabase SQL editor (agent is prod-blocked).

begin;

-- 1. Clear ON DELETE RESTRICT dependents first (no-op if none / already gone).
delete from public.coupon_redemptions
where coupon_id in (
  select id from public.coupons where code = 'DEVPOC-UNLI'
);

-- 2. Hard-delete the redundant coupon. purchases.coupon_id auto-SET NULL via FK.
delete from public.coupons
where code = 'DEVPOC-UNLI';

commit;
