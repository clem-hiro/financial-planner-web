# Session Handoff — 2026-05-15

## 1. State Snapshot

Branch `sandbox` at `337f9f9` (= `origin/sandbox`), 10 commits ahead of `origin/main` (`8a1f679`). PR #2 (worktree → sandbox, income-tax + inbox + salary-review reminder) and PR #3 (sandbox → main, project tooling + advisor UI polish + dev seed + income-tax bundle) merged this session. PR #4 (sandbox → main, planning breakpoint fix) merged. Co-developer (CleAyz) pushed in parallel: `[Contact Advisor] Allow dismiss on blur`, a Codex agents/skills setup, and a `[Financial Setup] Move to main tabs instead of profile tabs` navigation refactor (added `src/app/(app)/more/page.tsx` + `src/lib/client-main-nav.ts`). The 3 income-tax migrations (`20260518000000`, `20260519000000`, `20260520000000`) were applied via Supabase Dashboard SQL Editor by the operator. The `20260521000000` DEVPOC-UNLI coupon migration also applied. Dev users seeded: `_dev@dev.com` (advisor, phone `+6596340104` confirmed) and `_dev_client@dev.com` (client, pw `dev123`, advisor link wired via consumed access key).

## 5. Active Focus

**Next focus — QR-code key sharing for advisors.**

Goal: advisors can expose an access key as a scannable QR code; clients who scan it land on a deeplink that pre-fills the access-key field in the client signup form, eliminating manual typing. The deeplink's website URL must be derived dynamically at runtime (so it works across local dev / Vercel preview / production), not hardcoded.

Next session should **research first, then plan, then execute** in three discrete phases:

1. **Research** — read the existing key-purchase + redemption flow:
   - `src/server/advisor-key-purchase-actions.ts` (existing buy / quote / contact actions).
   - `src/features/advisor/AdvisorAccessKeysSection.tsx` (where per-key actions live in the UI today; per the prior plan, this section is also flagged as a UX target — the recent-keys table currently leaks who-redeemed-what; not in this scope but worth knowing).
   - `src/app/(app)/advisor/access-keys/page.tsx`.
   - `src/features/auth/LoginForm.tsx:85-133` for the client-side access-key consumption path. Deeplink should pre-fill the `userMeta.access_key` value.
   - The `handle_new_user` trigger at `supabase/migrations/20260517110000_drop_phone_mirror_columns.sql:65-142` to confirm the access-key handoff path is unchanged.
2. **Pick a QR library** — evaluate options. Default candidate: `qrcode` (npm, ~mature, small) for server-side SVG / data-URL generation. Alternatives: `qrcode.react` (client-side React component). Decide whether QR is generated in a server action returning data-URL or in a client component. Surface as a dependency-gate AskUserQuestion before adding (per global rules).
3. **Dynamic site URL derivation** — research the safe runtime path:
   - In Next.js 16: read `request.headers.get('x-forwarded-host')` and `x-forwarded-proto` from the route handler context, OR use `headers()` from `next/headers` (async in Next 16). Fall back to `NEXT_PUBLIC_SITE_URL` env var if header parsing fails (production hardening).
   - On Vercel specifically: `process.env.VERCEL_URL` + `process.env.VERCEL_ENV` give canonical URL per environment.
   - Avoid: hardcoding any URL; using `window.location` server-side; relying on `NEXT_PUBLIC_SUPABASE_URL` (different domain).
   - The deeplink path is something like `/login?access_key=<value>&intent=client-signup`. LoginForm already accepts query params (verify) — read it before designing.
4. **Plan + execute** — use `/worktree` for isolation. Standard 3-phase rhythm (migration if needed → server action / route → UI + tests). Likely no DB migration since access keys already exist; this is purely UX.

Deliverable: a small `<QrCodeForKey accessKey={...} />` component in `src/features/advisor/`, rendered alongside each access-key row in the advisor's keys section, plus the deeplink consumption in `LoginForm`.

## 6. Open Loops

### Reference — Dev → Production switch (no app-level config)

When promoting from sandbox to production, this is the complete checklist. Per the established design decision, there is **no app-level env var or code branch** driving dev/prod behavior — every difference is a Supabase Dashboard config or per-environment credentials.

| # | Where | Action | Why |
|---|---|---|---|
| 1 | Supabase Dashboard → Authentication → Sign In / Providers → Email | Flip **Confirm Email** ON | In dev it's OFF (signup grants session immediately). In prod it's ON. |
| 2 | Supabase Dashboard → Authentication → Sign In / Providers → Phone | Set **provider = Twilio** + Account SID / Auth Token / Message Service SID | Until configured, `auth.updateUser({phone})` errors. |
| 3 | Phone provider → "Confirm phone change" toggle | **Leave ON** (default) | What causes `updateUser({phone})` to actually send the OTP. |
| 4 | Deployment env (Vercel etc.) | Set `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` to prod values | Standard. |
| 5 | (No code change needed) | `/auth/callback` route is already wired | Required for prod email-confirm flow. |

### P0 (do next)

- **P0** `src/features/advisor/AdvisorPhoneVerificationForm.tsx:19-21,71-85` — phone-verify form has two related race-condition bugs (P0, **2 sessions**):
  - `verified` predicate compares `user.phone` (from prop) against the current input value, not against the number actually sent for OTP. If the user edits the input mid-flow, the badge can flip incorrectly.
  - `verifyCode` calls `verifyOtp({phone: <current input>})` but the OTP was minted for whatever phone was sent at `sendCode` time. If the user edits between Send and Verify, Supabase returns "Token expired/invalid" — misleading error.
  - **Fix:** capture `sentToPhone` in local state inside `sendCode()`; use that for both the `verified` check and as the `phone` argument to `verifyOtp`. Reset `sentToPhone` when the input changes. ~10 LOC.

### P1 (do soon)

#### From this session's audit (2026-05-15)

- **P1** `scripts/seed-dev-users.mjs:128-141` — `ensureFreshAvailableKey` is TOCTOU racy across concurrent `npm run seed:dev` runs. Acceptable for dev tooling per the auditor; document or add a partial unique index on `(advisor_user_id) WHERE status='available'` if a tighter guarantee is wanted later.
- **P1** `src/features/income-tax/IncomeTaxSection.tsx:32-37` — `deriveAutoAppliedReliefs` returns a single `null` indistinguishably for "missing field" vs "present-but-invalid" (e.g., legacy `cpf_age_band` not in `SgCpfAgeBand` enum). Form's hint banner only mentions the missing-field case. Mitigation: discriminate the result (`{kind:"missing", fields} | {kind:"invalid_band", value} | AutoAppliedReliefs`) and branch the banner copy.
- **P1** `src/features/income-tax/IncomeTaxSection.tsx:35` — `ageCompletedOnDate(profile.birth_date, new Date())` uses live wall clock for the earned-income relief tier. IRAS tiers are calculated against the assessment year's last day. Mitigation: pass `new Date(\`${yearFromYearMonth(referenceYearMonth)}-12-31\`)` so the tier matches IRAS semantics for past/future tax years.
- **P1** `src/features/income-tax/IncomeTaxSection.tsx:26-47` and `src/data/income-tax-synthetic-expense.ts:30-58` — duplicate logic. Both derive `(age, mandatoryCpfSgd, annualBonus)` from the same `(profile, referenceYearMonth)` inputs with identical guards. Drift risk on age-band rule changes. Mitigation: extract `deriveCpfDerivedInputs(profile, referenceYearMonth)` in `src/domain/finance/sg-cpf-derived.ts`; both callers add their own thin layer.
- **P1** Missing tests for `deriveAutoAppliedReliefs`. Pure-ish helper with a branchy guard ladder. Add `src/features/income-tax/IncomeTaxSection.test.ts` against frozen `now`.

#### From the income-tax PR #2 worktree-review (carried forward, **needs human inspection**)

- **P1** `src/server/inbox/ensure-salary-review-notification.ts:30` and `src/features/dashboard/ProfileIncomeForm.tsx:99` — year-of-acknowledgment uses local TZ on the client and server TZ on the server. On Dec 31 night, the `salary_review_due:<year>` dedupe key derived client-side may not match the inbox row written server-side. Mitigation: compute year server-side and pass to client as a prop, or share a date helper.
- **P1** `src/app/api/profile/route.ts` — no `revalidatePath` is called when `salary_increment_month` / `last_salary_review_at` is updated. Today's only consumer (the form) calls `markInboxItemReadByDedupeKeyAction` (which does `revalidatePath("/", "layout")`) and then `router.refresh()`, so the bell badge stays consistent. But if any external caller PATCHes those fields directly, the bell snapshot in `(app)/layout.tsx` would be stale until next navigation.
- **P1** No API integration test for the income-tax `PATCH /api/income-tax` route asserting that posting `{tax_rebate_percent: 60}` alone (without `tax_rebate_cap_sgd`) returns 400 with the `superRefine` message. Schema enforces both-or-neither; explicit regression test missing.

#### From prior session(s) (carried forward, **2 sessions**)

- **P1** `supabase/migrations/20260517100000_advisor_key_purchases_coupons_contact.sql:555-572` — `fulfill_access_key_purchase` key-generation loop has no iteration cap. Termination relies on 128-bit RNG entropy + `statement_timeout`. Defensive fix: add `v_attempts < p_quantity * 16` ceiling that raises if exceeded.
- **P1** `supabase/migrations/20260517100000_*.sql:288-291, 434-437` — coupon-validation-attempts GC runs `DELETE FROM coupon_validation_attempts WHERE attempted_at < now() - interval '1 day'` on every coupon check. Move to a daily pg_cron sweep or gate behind `random() < 0.01`.
- **P1** `src/features/advisor/AdvisorPhoneVerificationForm.tsx:46` — `setPhone(normalized)` silently overwrites the user-typed phone with the E.164-normalized form. If region inference is wrong, user has no chance to correct. Surface the normalized number in the `info` line ("Verification code sent to <number>").
- **P1** `src/domain/finance/advisor-client-health.ts:149` — `formatYearMonth(new Date())` reached only when fixture omits `payload.month`. Today's tests don't exercise the load-bearing branch. If the fixture grows, becomes timezone-flaky across month boundaries. Pass an explicit `payload.month: "2026-05"` when the fixture grows.
- **P1** Other-contributor onboarding documentation. With CleAyz now actively pushing to sandbox, the "shared DB or own DB" decision is increasingly relevant (drop-column migrations on a shared dev DB break the un-pulled contributor's app). The textbook fix is one Supabase project per contributor + `supabase link` + `supabase db push`. Discussed in earlier conversation; not yet documented in `AGENTS.md`.
- **P1** Audit medium-severity defensive items in `fulfill_access_key_purchase` (M2, M3, M6 from the original advisor-keys audit). Defensive guards (`raise if v_purchase.id is null after fallback select`; `returning remaining_redemptions` on the coupon UPDATE) would prevent silent regressions if more unique constraints are added later.

## 7. Invariants — Do Not Break

**Invariants are cumulative.** Each entry persists until explicitly retired by the user.

- **Phone single-source-of-truth: `auth.users.phone` only.** Never reintroduce `financial_profiles.phone_e164` or any mirror column. App reads phone via `auth.getUser()` (for own user) or via the `get_my_advisor_contact()` SECURITY DEFINER RPC (for cross-user reads). _(added: 2026-05-14)_
- **No app-level dev/prod gating for auth.** Every dev/prod difference for auth is a Supabase Dashboard config (`Confirm Email`, Twilio creds) or per-environment Supabase URL + anon key. There is no `NEXT_PUBLIC_DEPLOYMENT_ENV` env var; do not introduce one for auth-related behavior. _(added: 2026-05-14)_
- **`handle_new_user` trigger must not consume `raw_user_meta_data.phone_e164`.** Signup no longer carries phone. Advisor phone collection is exclusively via the OTP flow on `/advisor/profile`. _(added: 2026-05-14)_
- **No service role key in app code.** RLS is the trust boundary. All cross-user reads of `auth.users` go through SECURITY DEFINER RPCs, never via the admin API. The seed script under `scripts/` is the ONLY consumer of `SUPABASE_SERVICE_ROLE_KEY`; never import it from anywhere under `src/`. Never prefix with `NEXT_PUBLIC_`. _(added: 2026-05-14, expanded: 2026-05-15)_
- **Migration filenames are unique per timestamp prefix.** Use `_100000`, `_200000` etc. when a sub-day ordering is needed. Latest applied: `20260521000000_seed_devpoc_unli_coupon.sql`. _(added: 2026-05-14)_
- **`/auth/callback` `next=` query param must be validated.** Only same-origin paths starting with single `/`, length ≤ 512. Already enforced in `src/app/auth/callback/route.ts:safeNext`. _(added: 2026-05-14)_

## References

- Architecture, conventions, domain model: `CLAUDE.md` → `AGENTS.md`
- Marker scan (TODO/FIXME/HACK/STUB): `CODEBASE-ISSUES.md`
- Long-tail backlog (P2+): `BACKLOG.md` (create if needed)
- Anti-patterns and corrections: `LEARNINGS.md` (if present)
- This session's diff: `git log --oneline 8a1f679..sandbox` then `git diff 8a1f679..sandbox`
- Migration ledger: `supabase/migrations/` — latest is `20260521000000_seed_devpoc_unli_coupon.sql`
- Dev seed: `npm run seed:dev` (idempotent; reads `SUPABASE_SERVICE_ROLE_KEY` from `.env.local`)
- Dev users: `_dev@dev.com` (advisor) / `_dev_client@dev.com` (pw `dev123`, client, already linked to dev advisor)
- DEVPOC-UNLI coupon: 100% discount, no expiry, available in buy-keys form
- Income-tax PR (merged): https://github.com/clem-hiro/financial-planner-web/pull/2
- Sandbox→main syncs (merged): PR #3 (project tooling bundle), PR #4 (planning breakpoint fix)
- Co-developer activity: CleAyz pushing to sandbox in parallel; expect divergence between sessions
