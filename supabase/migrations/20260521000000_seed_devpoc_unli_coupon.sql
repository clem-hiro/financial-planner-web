-- Seed a 100%-discount global coupon for dev / POC testing.
-- Mirrors the POCUNLIMITED seed pattern in 20260517100000_advisor_key_purchases_coupons_contact.sql:91-101.
-- Idempotent: re-running this migration is a no-op once the coupon exists.

insert into public.coupons (
  advisor_user_id,
  code,
  kind,
  discount_percent,
  free_key_quantity,
  remaining_redemptions,
  expires_at
)
values (
  null,             -- global (not scoped to any single advisor)
  'DEVPOC-UNLI',
  'discount_percent',
  100,              -- 100% off
  null,
  null,             -- unlimited redemptions
  null              -- no expiry
)
on conflict do nothing;
