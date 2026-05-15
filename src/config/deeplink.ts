/**
 * Single source of truth for QR-share deeplink TTL.
 * Postgres mirrors this as a literal `interval '15 minutes'` in
 * `supabase/migrations/20260522000000_advisor_qr_share_tokens.sql` —
 * keep them in sync.
 */
export const QR_DEEPLINK_EXPIRY_MINUTES = 15;
export const QR_DEEPLINK_EXPIRY_MS = QR_DEEPLINK_EXPIRY_MINUTES * 60 * 1000;
