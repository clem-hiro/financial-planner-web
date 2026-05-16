# Session Handoff — 2026-05-15

## 1. State Snapshot

**CURRENT (end of 2026-05-16 session):** Branch `sandbox` at `8851b36`, in sync with `origin/sandbox` (`0 0`), a **strict superset of `origin/main`** (divergence cleared via back-merge `8851b36`). **PR #6 MERGED** to `main` (`edbc4cb`, 2026-05-16 04:42 UTC) — note: merged as a **regular merge commit, NOT squashed** (the 6 dialog-iteration commits are individually on `main`; not retro-fixed — would require destructive `main` history rewrite). **PR #7 OPEN** (https://github.com/clem-hiro/financial-planner-web/pull/7 — seed genKey hex fix `7e3a924` + handoff; net 3 files; **squash-merge this one**). `main` now contains: QR feature + token follow-up + dialog centering/backdrop + income-tax 500 fix. `sandbox`-only (in PR #7): the seed-key fix + handoff.

---
**Historical (2026-05-15 session log, kept for context):** Since the QR push: fast-forwarded past 4 CleAyz commits (`[Home]`/`[Expenses]`/`[Optimise UI]` — UI/loading/copy only, zero income-tax overlap; ff conflict-free) to `ec74211`, then committed `c178287 fix(income-tax): coerce blank reliefs to 0, not null (500 → 200)` and ff-pushed. Prior session: PRs #2/#3/#4 merged. Co-developer (CleAyz) pushed in parallel: `[Contact Advisor] Allow dismiss on blur`, a Codex agents/skills setup, and a `[Financial Setup] Move to main tabs instead of profile tabs` navigation refactor (added `src/app/(app)/more/page.tsx` + `src/lib/client-main-nav.ts`). The local QR commits were **rebased onto CleAyz's `c86ea38`** (an empty merge commit — zero net file changes; rebase was conflict-free and tree-identical) then fast-forward pushed. The income-tax migrations (`20260518000000`–`20260520000000`) + `20260521000000` DEVPOC-UNLI coupon migration applied via Supabase Dashboard SQL Editor by the operator. Dev users seeded: `_dev@dev.com` (advisor, phone `+6596340104` confirmed) and `_dev_client@dev.com` (client, pw `dev123`, advisor link wired via consumed access key).

**This session (2026-05-15) — 5 commits, pushed (post-rebase SHAs):**
- `b9f054e fix(advisor): bind phone-verify to sent number, not live input` — the carried-forward P0 phone-verify race fix (capture `sentToPhone`).
- `dd2c047 chore(handoff): add P1 for per-category income-tax tooltips`.
- `80c7245 feat(advisor): QR-code key sharing with one-time deeplinks` — full QR feature: server-side `qrcode` SVG, opaque-token deeplink, `advisor_qr_share_tokens` table + RPCs, native `<dialog>`, WCAG 2.2 AA, anti-quishing trust signals.
- `1cf1060 fix(advisor): QR token — idempotent mint + peek-on-GET, consume-on-POST` — post-ship review fixes (Bug A retire-on-page-render, Bug B consume-on-GET).
- `fc2f931 chore(handoff): QR-share shipped + P0 resolved + accepted posture`.
- `7a687c4 chore: document SITE_URL in env example + refresh handoff`.
- `c178287 fix(income-tax): coerce blank reliefs to 0, not null (500 → 200)` — **was a real pre-existing P0-grade bug** (Postgres 23502: blank relief → `null` into NOT NULL DEFAULT 0 columns; broke the common save path for any user leaving a relief blank). Fixed 4-layer with Zod as canonical chokepoint (`reliefAmount` null→0 transform, `.optional()` preserved so omitted keys stay untouched), form `?? 0`, repo patch type, +5 Zod unit cases. Live smoke confirmed: original 500 body now → HTTP 200, relief persisted as 0. Code-reviewed GO 0 blockers. Surfaced by operator hitting `/setup?tab=income_tax` as `_dev_client`.
- **Since `c178287` (branch tip now `7e3a924`, in sync w/ origin):** 6 QR-dialog-positioning iteration commits (`82c8f78`→`1361a08`, final = inline-style centering `9f8d4bb` + `dialog::backdrop` source-CSS rule `1361a08`; Playwright-verified centered in Chromium+WebKit — real-Safari was stale-Turbopack-CSS); handoff/SITE_URL chores (`7a687c4`, `d3d5d6f`); merge `08f257b` (re-sync origin/main → sandbox, conflict-free); **`7e3a924 fix(seed): genKey emits prod-format pure hex`**. PR #6 (sandbox→main) is OPEN — must be **squash-merged**.
- `7e3a924` — **pre-existing client-signup bug**: `scripts/seed-dev-users.mjs` `genKey()` emitted `DEV-<8hex>` which fails `clientAccessKeyInputSchema` (`^[A-F0-9]+$`); every client signup with a seeded key → "Invalid access key format". Only surfaced via the real QR signup path (seed creates clients server-side, bypassing the schema). Prod keys were always conforming (`fulfill_access_key_purchase` = 32 upper-hex). Fix: seed now `randomBytes(16).hex.toUpperCase()` = 32 upper-hex (prod parity; also 32-bit→128-bit entropy upgrade). **Strict schema kept (user decision, not relaxed)**; +7 contract tests lock it. Code-reviewed GO 0 blockers.
- **Manual prod data migration run by operator 2026-05-16 (NOT in any migration file — record for reproducibility):** to fix the already-issued `DEV-` keys without re-seeding, the operator ran in Supabase SQL Editor: `begin; delete from public.advisor_qr_share_tokens; update public.advisor_access_keys set access_key = substring(access_key from 5) where access_key like 'DEV-%'; commit;` (strips the 4-char `DEV-` prefix → the remaining 8 chars were already upper-hex; clears ephemeral QR tokens first to avoid the FK on `advisor_qr_share_tokens.access_key`). Consequence: all pre-existing QR tokens were deleted — advisors must re-open "Show QR" to mint a fresh token bound to a now-hex key before testing signup.
- **Migration `20260522000000_advisor_qr_share_tokens.sql` was applied by the operator** via Supabase Dashboard SQL Editor (the final canonical block: table + 3 indexes incl. `advisor_qr_share_tokens_active_idx` + RLS + `peek_qr_share_token` + `consume_qr_share_token` + 4-arg `mint_qr_share_token`). Operator confirmed "query ran". Validation queries are in the plan file.
- **Operator action items still open (gate PRODUCTION):** (1) `SITE_URL` set in Vercel production env by operator (reported done) — verify scope = Production + redeploy; (2) before production: Supabase Auth → URL Configuration → Redirect URLs allowlist must include the prod `…/auth/callback`; (3) **squash-merge PR #7**, then back-merge `origin/main`→`sandbox` (the established post-merge re-sync SOP — see §"merge-not-rebase" learning); (4) real-phone QR scan smoke test on the Vercel preview/prod (only path not exercisable on localhost — note: every newly-minted QR token is now bound to a conforming 32-hex key, so signup will pass). `.env.local.example` `SITE_URL` line kept; `ENVIRONMENT` line dropped per user. **PR-merge learning:** PR #6 was merged non-squash by mistake despite the recorded instruction → noisy `main` history; future sandbox→main PRs must be squash-merged (recorded so the next session/operator is deliberate).

## 5. Active Focus

**All 2026-05-15/16 workstreams are SHIPPED.** Merged to `main` via PR #6: phone-verify P0 fix, full QR-code key-sharing feature + token follow-up (idempotent mint, peek-on-GET/consume-on-POST), QR dialog centering (inline-style — Playwright-verified) + `dialog::backdrop` source-CSS, income-tax 500 fix. In PR #7 (open, squash-merge): seed `genKey()` prod-hex fix. No open P0. No open implementation focus carried forward.

**Next session — NEW TOPIC (user-directed).** Per the user: the next session focuses on a new topic to be decided and discussed at session start — there is **no carryover feature/implementation focus**. Do NOT assume continuation of QR/income-tax/seed work; ask the user what the new topic is.

**Only loose ends before that (operational, not implementation):** finish the §1 "Operator action items" (squash-merge PR #7 → back-merge sync; verify `SITE_URL` Production scope; Supabase Auth redirect allowlist; real-phone QR smoke test). The P1/P2 backlog in §6 (income-tax tooltip restructure, global Tailwind cursor regression, client-component test infra, etc.) remains available but is NOT the directed focus — surface only if the user asks.

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
- **P1 (partially addressed 2026-05-16, `c178287`)** Income-tax `PATCH /api/income-tax` test coverage. The **Zod-layer** invariants are now unit-tested in `src/lib/validation.test.ts` (blank relief → 0; omitted relief → untouched; range bounds; rebate `superRefine` both-or-neither incl. `{tax_rebate_percent:60}` alone → reject). Live 4-row curl smoke also ran green this session (ad-hoc, not committed). **Still P1:** a committed **API/harness-level** integration test hitting the route end-to-end (route → Zod → upsert) — asserts an *unlisted* relief column stays unchanged on partial update (locks the omitted-key-untouched invariant against a future route refactor; the pure `{...patch}` spread guarantees it today but nothing tests it at the API surface). Per testing-philosophy: the invariant has one route producer, so one API-surface test covers it; the Zod unit test does not.

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
- Migration ledger: `supabase/migrations/` — latest file is `20260522000000_advisor_qr_share_tokens.sql` (applied 2026-05-15). **Plus one manual prod data migration 2026-05-16 (no file): `DEV-` access-key prefix strip + `advisor_qr_share_tokens` clear — see §1 "Manual prod data migration".** Re-apply to any other Supabase env that was seeded with the old `DEV-` `genKey`.
- QR-share plan + validation SQL: `~/.claude/plans/purrfect-questing-canyon.md`
- QR-share review record: `REVIEW-FEEDBACK.md` (repo root, untracked — transient; T10 verdict GO-WITH-FOLLOWUPS)
- Dev seed: `npm run seed:dev` (idempotent; reads `SUPABASE_SERVICE_ROLE_KEY` from `.env.local`)
- Dev users: `_dev@dev.com` (advisor) / `_dev_client@dev.com` (pw `dev123`, client, already linked to dev advisor)
- DEVPOC-UNLI coupon: 100% discount, no expiry, available in buy-keys form
- Income-tax PR (merged): https://github.com/clem-hiro/financial-planner-web/pull/2
- Sandbox→main syncs (merged): PR #3 (project tooling bundle), PR #4 (planning breakpoint fix)
- Co-developer activity: CleAyz pushing to sandbox in parallel; expect divergence between sessions
