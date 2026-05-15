# Session Handoff — 2026-05-15

## 1. State Snapshot

Branch `sandbox` at `fc2f931`, **pushed to `origin/sandbox`** (2026-05-15; in sync, `0 0`) and ahead of `origin/main` (`8a1f679`). Prior session: PRs #2/#3/#4 merged. Co-developer (CleAyz) pushed in parallel: `[Contact Advisor] Allow dismiss on blur`, a Codex agents/skills setup, and a `[Financial Setup] Move to main tabs instead of profile tabs` navigation refactor (added `src/app/(app)/more/page.tsx` + `src/lib/client-main-nav.ts`). The local QR commits were **rebased onto CleAyz's `c86ea38`** (an empty merge commit — zero net file changes; rebase was conflict-free and tree-identical) then fast-forward pushed. The income-tax migrations (`20260518000000`–`20260520000000`) + `20260521000000` DEVPOC-UNLI coupon migration applied via Supabase Dashboard SQL Editor by the operator. Dev users seeded: `_dev@dev.com` (advisor, phone `+6596340104` confirmed) and `_dev_client@dev.com` (client, pw `dev123`, advisor link wired via consumed access key).

**This session (2026-05-15) — 5 commits, pushed (post-rebase SHAs):**
- `b9f054e fix(advisor): bind phone-verify to sent number, not live input` — the carried-forward P0 phone-verify race fix (capture `sentToPhone`).
- `dd2c047 chore(handoff): add P1 for per-category income-tax tooltips`.
- `80c7245 feat(advisor): QR-code key sharing with one-time deeplinks` — full QR feature: server-side `qrcode` SVG, opaque-token deeplink, `advisor_qr_share_tokens` table + RPCs, native `<dialog>`, WCAG 2.2 AA, anti-quishing trust signals.
- `1cf1060 fix(advisor): QR token — idempotent mint + peek-on-GET, consume-on-POST` — post-ship review fixes (Bug A retire-on-page-render, Bug B consume-on-GET).
- `fc2f931 chore(handoff): QR-share shipped + P0 resolved + accepted posture`.
- **Migration `20260522000000_advisor_qr_share_tokens.sql` was applied by the operator** via Supabase Dashboard SQL Editor (the final canonical block: table + 3 indexes incl. `advisor_qr_share_tokens_active_idx` + RLS + `peek_qr_share_token` + `consume_qr_share_token` + 4-arg `mint_qr_share_token`). Operator confirmed "query ran". Validation queries are in the plan file.
- **Operator action items still open:** (1) `SITE_URL` set in Vercel production env by operator (reported done) — verify scope = Production + redeploy; (2) before production: Supabase Auth → URL Configuration → Redirect URLs allowlist must include the prod `…/auth/callback`; (3) sandbox→main PR + Vercel-preview real-phone scan smoke test (only path not exercisable on localhost). `.env.local.example` `SITE_URL` line decided (keep) — `ENVIRONMENT` line dropped per user (no code reads it; `VERCEL_ENV` discriminates).

## 5. Active Focus

**QR-code key sharing — SHIPPED on `sandbox` (commits `dea6e04` + `fcba463`).** Feature complete, lead-verified (tsc/lint/150 tests/grep clean), code-reviewed (GO, 0 blockers), migration applied by operator. Not yet pushed; not yet promoted to `main`.

**Next focus — pick from P1 backlog below.** No specific next feature was directed. Strong candidates in priority order:
1. **P0 is clear** (the phone-verify race was the only P0; it's fixed in `6c4f4af`). No open P0.
2. The income-tax follow-ups (P1 cluster from the 2026-05-15 audit, incl. the per-category tooltip restructure just added) are the densest remaining area.
3. Or: push the 6 sandbox commits + open a sandbox→main PR for the QR feature, then smoke-test on Vercel preview (real phone scan over the internet — the only path not exercisable on localhost).

Decide with the user at session start.

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

- **RESOLVED 2026-05-15** (`6c4f4af`) — `AdvisorPhoneVerificationForm` phone-verify race. Fixed by capturing `sentToPhone` in local state in `sendCode()`, using it for both the `verified` predicate and the `verifyOtp` phone arg, and clearing it on input change. No open P0.

### P1 (do soon)

#### From this session's audit (2026-05-15)

- **P1** `scripts/seed-dev-users.mjs:128-141` — `ensureFreshAvailableKey` is TOCTOU racy across concurrent `npm run seed:dev` runs. Acceptable for dev tooling per the auditor; document or add a partial unique index on `(advisor_user_id) WHERE status='available'` if a tighter guarantee is wanted later.
- **P1** `src/features/income-tax/IncomeTaxSection.tsx:32-37` — `deriveAutoAppliedReliefs` returns a single `null` indistinguishably for "missing field" vs "present-but-invalid" (e.g., legacy `cpf_age_band` not in `SgCpfAgeBand` enum). Form's hint banner only mentions the missing-field case. Mitigation: discriminate the result (`{kind:"missing", fields} | {kind:"invalid_band", value} | AutoAppliedReliefs`) and branch the banner copy.
- **P1** `src/features/income-tax/IncomeTaxSection.tsx:35` — `ageCompletedOnDate(profile.birth_date, new Date())` uses live wall clock for the earned-income relief tier. IRAS tiers are calculated against the assessment year's last day. Mitigation: pass `new Date(\`${yearFromYearMonth(referenceYearMonth)}-12-31\`)` so the tier matches IRAS semantics for past/future tax years.
- **P1** `src/features/income-tax/IncomeTaxSection.tsx:26-47` and `src/data/income-tax-synthetic-expense.ts:30-58` — duplicate logic. Both derive `(age, mandatoryCpfSgd, annualBonus)` from the same `(profile, referenceYearMonth)` inputs with identical guards. Drift risk on age-band rule changes. Mitigation: extract `deriveCpfDerivedInputs(profile, referenceYearMonth)` in `src/domain/finance/sg-cpf-derived.ts`; both callers add their own thin layer.
- **P1** Missing tests for `deriveAutoAppliedReliefs`. Pure-ish helper with a branchy guard ladder. Add `src/features/income-tax/IncomeTaxSection.test.ts` against frozen `now`.
- **P1** Income-tax tooltips: split the single top-of-section `TaxMethodologyTooltip` into per-category tooltips. Today `src/features/income-tax/IncomeTaxSection.tsx:58` renders one `<TaxMethodologyTooltip />` covering the whole computation (topic `sg-income-tax-ya2026`). Form (`IncomeTaxForm.tsx`) is already organized into 5 `FieldGroup`s — Earned income, CPF / SRS, Family, NS, Career & other. Redesign: each `FieldGroup` carries its own `InfoTooltip` keyed to a per-category methodology topic (e.g. `sg-income-tax-earned-income-ya2026`, `…-cpf-srs-ya2026`, etc.), so users see the rules for the category they're filling in rather than a wall of text at the top. Likely needs: extending `FieldGroup` to accept an optional `methodologyTopicId`/`tooltipAriaLabel`, splitting the source methodology content per category, and removing the section-level tooltip (or keeping a thin "Methodology overview" link). _(added: 2026-05-15)_

#### From the QR-share feature (2026-05-15, post-ship)

- **Accepted posture (signed off by user, NOT a defect — recorded so it isn't re-litigated):** `peek_qr_share_token` is idempotent/non-consuming (required to make link-preview prefetch safe). Consequence: a leaked/screenshotted QR URL exposes the access key on *every* GET within the 15-min TTL, and `LoginForm`'s raw-key field-fallback lets signup proceed with that key until the underlying key is `claimed`. Double-claim remains impossible (DB trigger is the single-use gate). The fallback is retained because removing it breaks legitimate retry-after-failed-signup. If a hard token-bound on key exposure is ever wanted, that's a separate follow-up requiring a re-issue mechanism. _(added: 2026-05-15)_
- **P2** Project-wide Tailwind v4 cursor regression. v4 preflight dropped the default `cursor: pointer` on `<button>`. Fixed only for the QR dialog buttons in `dea6e04`. Every other button (`AdvisorPhoneVerificationForm` Send Code, `AdvisorBuyKeysSection` Purchase, `LoginForm` submit, etc.) still shows the default arrow cursor. Cleanest global fix: `@layer base { button:not(:disabled){cursor:pointer} }` in the global stylesheet. _(added: 2026-05-15)_
- **P2** No client-component test infra for `AdvisorKeyQrShareButton`, the modified `LoginForm`, or the `/login` GET-vs-POST split — same deferral as the `AdvisorPhoneVerificationForm` P2 below. The QR dialog (countdown, refresh, copy, focus trap) and the consume-on-submit path are untested.
- **P2** `refactoring-expert` flagged `bg-[#0c192f]`/`hover:bg-[#152a45]` solid-navy primary button duplicated across `AdvisorKeyQrShareButton`, `AdvisorBuyKeysSection`, `LoginForm`. Promote to a shared token in `src/ui/` (sibling to `fpPrimaryButtonClass`). Also `useCopyToClipboard` worth promoting to `src/lib/use-clipboard.ts` (low blast radius, likely reuse). Both "discuss" priority — not done in-scope.

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
- **Migration filenames are unique per timestamp prefix.** Use `_100000`, `_200000` etc. when a sub-day ordering is needed. Latest applied: `20260522000000_advisor_qr_share_tokens.sql`. _(added: 2026-05-14, updated: 2026-05-15)_
- **`/auth/callback` `next=` query param must be validated.** Only same-origin paths starting with single `/`, length ≤ 512. Already enforced in `src/app/auth/callback/route.ts:safeNext`. _(added: 2026-05-14)_
- **QR deeplinks carry only the opaque token, never the access key.** `/login?qr_token=<22-24 char base64url>`. The access key is resolved server-side via SECURITY DEFINER RPC. Never put `access_key` in a URL. _(added: 2026-05-15)_
- **QR token: peek-on-GET, consume-on-POST.** `/login` server render calls the read-only `peek_qr_share_token` only. Consume (`consume_qr_share_token`, atomic single-use) happens exclusively in the POST-time `consumeQrTokenAction` from the signup submit. Never regress to consuming on GET — link-preview prefetch would burn tokens. _(added: 2026-05-15)_
- **`SITE_URL` is the production canonical origin, not `VERCEL_URL`.** `getSiteOrigin()` uses `SITE_URL` when `VERCEL_ENV==='production'`; otherwise header-derived against a host allowlist. `VERCEL_URL` is deployment-scoped and must not be used as the canonical origin. _(added: 2026-05-15)_

## References

- Architecture, conventions, domain model: `CLAUDE.md` → `AGENTS.md`
- Marker scan (TODO/FIXME/HACK/STUB): `CODEBASE-ISSUES.md`
- Long-tail backlog (P2+): `BACKLOG.md` (create if needed)
- Anti-patterns and corrections: `LEARNINGS.md` (if present)
- This session's diff: `git log --oneline 8a1f679..sandbox` then `git diff 8a1f679..sandbox`
- Migration ledger: `supabase/migrations/` — latest is `20260522000000_advisor_qr_share_tokens.sql` (applied 2026-05-15)
- QR-share plan + validation SQL: `~/.claude/plans/purrfect-questing-canyon.md`
- QR-share review record: `REVIEW-FEEDBACK.md` (repo root, untracked — transient; T10 verdict GO-WITH-FOLLOWUPS)
- Dev seed: `npm run seed:dev` (idempotent; reads `SUPABASE_SERVICE_ROLE_KEY` from `.env.local`)
- Dev users: `_dev@dev.com` (advisor) / `_dev_client@dev.com` (pw `dev123`, client, already linked to dev advisor)
- DEVPOC-UNLI coupon: 100% discount, no expiry, available in buy-keys form
- Income-tax PR (merged): https://github.com/clem-hiro/financial-planner-web/pull/2
- Sandbox→main syncs (merged): PR #3 (project tooling bundle), PR #4 (planning breakpoint fix)
- Co-developer activity: CleAyz pushing to sandbox in parallel; expect divergence between sessions
