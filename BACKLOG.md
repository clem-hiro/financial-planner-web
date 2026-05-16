# Backlog — P2+ long-tail

Demoted/low-priority items. Promote to `HANDOFF.md` §6 when they become next-session relevant.

## UI / design system
- **Global Tailwind v4 cursor regression.** v4 preflight dropped default `cursor: pointer` on `<button>`. Fixed only for the QR dialog buttons (`AdvisorKeyQrShareButton.tsx`). Every other button (phone-verify Send Code, buy-keys Purchase, LoginForm submit, etc.) shows the arrow cursor. Cleanest global fix: `@layer base { button:not(:disabled){ cursor:pointer } }` in `src/app/globals.css`.
- **Button-token consolidation.** Solid-navy primary (`bg-[#0c192f]`/`hover:bg-[#152a45]`) hand-duplicated across `AdvisorKeyQrShareButton`, `AdvisorBuyKeysSection`, `LoginForm`. Promote to a shared token in `src/ui/` (sibling to `fpPrimaryButtonClass`).
- **Promote `useCopyToClipboard`** (currently local in `AdvisorKeyQrShareButton.tsx`) to `src/lib/use-clipboard.ts` — generic, likely-reused (access-key/buy-keys copy flows). Low blast radius.

## Tests / tooling
- **Automate the QR trigger/RLS scenario matrix.** `supabase/tests/qr_redeem_scenarios.sql` is currently operator-run against a scratch DB (no DB integration harness — option 3 decision, no new dep). Rationale to automate later: the P0 atomic-redeem invariant in `handle_new_user` is the highest-risk surface and only a real-Postgres run proves it; a gated `test:integration` (Supabase CLI local stack or a pg test instance) would let CI catch regressions instead of relying on a manual pre-deploy run. Cost deferred deliberately: needs a Postgres/Supabase test instance + a pg-client/Supabase-CLI dev dependency + CI wiring (Dependency Gate).
- **No client-component test infra** for `AdvisorKeyQrShareButton`, the modified `LoginForm`, or the `/login` GET-vs-POST split (dialog countdown/refresh/copy/focus untested; QR-branch `qr_token`-not-`access_key` + advisor banner are now manual checks in `supabase/tests/README.md` §11–12). Same deferral as the historical `AdvisorPhoneVerificationForm` gap.
- **`vitest.config.ts` isolation not pinned.** `site-origin.test.ts` mutates `process.env`/shared state; safe only via Vitest default per-file process isolation. Pin `pool`/`isolate` or migrate to `vi.stubEnv`. (See `LEARNINGS.md`.)

## Cosmetic / low-impact
- `supabase/migrations/20260522000000…sql:2` comment "TTL literal `15 minutes` mirrors src/config" is misleading — the SQL has no such literal; TTL is single-sourced in TS (`QR_DEEPLINK_EXPIRY_MS`, passed as `expires_at`). Reword the comment if the file is next edited.
