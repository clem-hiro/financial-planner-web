# Session Handoff — 2026-05-16

## 1. State Snapshot

Branch `sandbox` @ `fba9f9d`, **in sync with `origin/sandbox`** (`0 0`), a **strict superset of `origin/main`** (sandbox 4 ahead, 0 behind). **PR #6 MERGED** to `main` (`edbc4cb`, 2026-05-16) — merged as a **regular merge commit, NOT squashed** (the 6 QR-dialog iteration commits are individually on `main`; not retro-fixed — would require destructive `main` history rewrite). **PR #7 OPEN** — https://github.com/clem-hiro/financial-planner-web/pull/7 — seed `genKey()` hex fix + handoff; net 3 files; **must be squash-merged**, then back-merge `origin/main`→`sandbox` per the merge-not-rebase SOP. `main` contains: phone-verify P0 fix, full QR key-sharing feature + token follow-up + dialog centering/backdrop, income-tax 500 fix. Operator applied migration `20260522000000_advisor_qr_share_tokens.sql` **plus a one-time manual prod data SQL** (strip legacy `DEV-` access-key prefix + clear `advisor_qr_share_tokens`) — recorded in §6 for reproducibility. Dev users seeded (`_dev@dev.com` advisor / `_dev_client@dev.com` client, pw `dev123`). No active build-sequence/phase doc (project doesn't use one). Co-dev CleAyz pushes to `sandbox`/`main` in parallel — always fetch + check divergence before branch ops.

## 5. Active Focus

**NEW user-directed topic — no carryover.** Per the user, the next session is a brand-new topic to be defined and discussed at session start. There is **no in-progress implementation focus**. Do NOT assume continuation of QR / income-tax / seed work. **Ask the user what the new topic is before doing anything.**

**Operational loose ends only (not implementation focus), in order:**
1. Squash-merge **PR #7**, then `git checkout sandbox && git merge origin/main && git push` (post-merge re-sync SOP).
2. Verify `SITE_URL` is set in Vercel **Production** scope + redeploy.
3. Supabase Auth → URL Configuration → **Site URL** = prod origin and **Redirect URLs** includes `https://<prod>/auth/callback` (one shared Supabase project serves localhost + prod; the `Confirm Email` toggle is project-global — see §6 onboarding item).
4. Real-phone QR scan smoke test on the Vercel preview/prod (only path not exercisable on localhost; keys now conform so signup will pass).

## 6. Open Loops

**Resolved this session (dropped; trace in `git log`):** phone-verify P0 race (`b9f054e`); income-tax `PATCH` 500 / 23502 (`c178287`); QR dialog centering + backdrop (`9f8d4bb`, `1361a08`, inline-style — root cause was Turbopack JIT dropping arbitrary classes, see `LEARNINGS.md`); seed `genKey()` `DEV-` format → prod hex (`7e3a924`); the one-time manual prod `DEV-`-strip data SQL (run by operator).

### New — from the 2026-05-16 passdown audit (QR feature, already merged via PR #6 — needs a future QR-hardening cycle, NOT the next session's new topic unless user redirects)

- **P0** QR token **consume-before-commit** ordering — `src/features/auth/LoginForm.tsx:102-126`. `consumeQrTokenAction` burns the single-use token *before* signup is durable. Any later failure (Zod reject, `validate_client_access_key_for_signup` false, `supabase.auth.signUp` error, email-confirm-not-completed, tab close) leaves the token permanently dead with **no compensation and no user signal** — advisor must Refresh QR; client retrying the stale deeplink gets a plain signin form with no explanation. Also: in the pure-QR flow, `consumeQrTokenAction` failure **silently falls back to the peeked `accessKey`** (fails open, not closed) → single-use bypassed on consume failure; double-click race possible. Fix needs a design decision (consume on signup success; or reservation+confirm; fail-closed; compensation) — surface options to the user before implementing.
- **P1** `peekExistingLiveToken` returns a token for a key no longer `status='available'` — `src/server/advisor-qr-share.ts:38-59` (flagged independently by code-reviewer + edge-case-auditor). If a key is claimed via the non-QR path, the trigger doesn't touch `advisor_qr_share_tokens`, so the page reuses a dead token; second scanner gets opaque "invalid key" + token wasted. Fix: `peekExistingLiveToken`'s SELECT should join `advisor_access_keys` and require `status='available'` (mirrors `pickOldestAvailableKey`).
- **P1** `mint_qr_share_token` retire-then-insert is **not atomic vs a concurrent mint** — `supabase/migrations/20260522000000…sql`. Two near-simultaneous mints (Refresh + page-render) can leave 2 live tokens for one (advisor,key); the SQL comment's "one active QR per key" invariant is not actually enforced. Downstream claim-guard prevents corruption (no data integrity issue). Fix: `SELECT … FOR UPDATE` on the access-key row inside the RPC.
- **P1** Advisor access-keys page bypasses the session's new request-cache — `src/app/(app)/advisor/access-keys/page.tsx:17-26`. 2 redundant round-trips/render (`auth.getUser` + profiles SELECT) the layout's `getRequestAuth()` already deduped for sibling pages (dashboard/setup were migrated; this one wasn't). **Clean 1-block fix:** replace lines 17-29 with `const { supabase, user, profile } = await getRequestAuth()` (from `@/data/supabase/request-context`). Deferred at wrap to avoid reopening the PR cycle.
- **P1** Relief field-spec triplication — `src/features/income-tax/IncomeTaxForm.tsx:36-60`, `src/lib/validation.ts:294-310`, `src/data/repositories/income-tax-configs.ts:11-33`. 17 relief keys declared 3×; per-field max caps duplicated 2× with literals. CPFB re-bases caps annually → synchronized 3-file edit; a form/schema cap divergence fails silently as an undiagnosable 400. Extract a client-safe `RELIEF_FIELDS` table (key+max) consumed by all three. Deliberate refactor, not urgent.

### Persisted from prior sessions (carried; full text in git history of HANDOFF / prior commits)

- **P1 (2 sessions) — income-tax cluster:** `deriveAutoAppliedReliefs` returns single `null` for missing-vs-invalid (`IncomeTaxSection.tsx:32-37`); `ageCompletedOnDate(..., new Date())` uses live clock not assessment-year-end (`:35`); per-category tooltip restructure (`dd2c047` added the P1 — `TaxMethodologyTooltip` → per-`FieldGroup` `InfoTooltip`); missing `deriveAutoAppliedReliefs` tests. Note: the income-tax `PATCH` rebate-pair invariant is now partially covered by this session's Zod unit tests (`validation.test.ts`) — the remaining gap is an **API-harness** integration test (still P1).
- **P1 (≥2 sessions) — salary-review/profile:** client/server TZ mismatch on `salary_review_due:<year>` dedupe key (`ensure-salary-review-notification.ts:30` + `ProfileIncomeForm.tsx:99`); `/api/profile` lacks `revalidatePath` for `salary_increment_month`/`last_salary_review_at` (only safe via current single caller).
- **P1 (≥3 sessions — promoted to `LEARNINGS.md`; close or act):** `fulfill_access_key_purchase` key-gen loop has no iteration cap (`20260517100000…:555-572`); coupon-validation-attempts GC runs per-check instead of pg_cron/`random()<0.01`; `AdvisorPhoneVerificationForm:46` `setPhone(normalized)` silently overwrites typed phone; `fulfill_access_key_purchase` M2/M3/M6 defensive guards.
- **P1 (≥3 sessions) — other-contributor onboarding / shared-DB decision.** Now materially more urgent: this session proved one Supabase project is shared by localhost + Vercel prod (the `DEV-` key incident + the `Confirm Email` project-global toggle conflict). Textbook fix: one Supabase project per env (dev/prod) + per-env URL+anon key. **Flag to user for an explicit decision** — it keeps causing real incidents.

## References

- Architecture, conventions, domain model: `CLAUDE.md` → `AGENTS.md`
- Code marker scan: `CODEBASE-ISSUES.md` (0 markers — repo uses HANDOFF §6 over inline TODOs)
- Anti-patterns / corrections: `LEARNINGS.md`
- Long-tail backlog (P2+): `BACKLOG.md`
- This session's diff: `git log --oneline 9fb1584..fba9f9d` then `git diff 9fb1584..fba9f9d`
- QR-share plan + validation/migration SQL: `~/.claude/plans/purrfect-questing-canyon.md`
- Open PR: #7 (sandbox→main, seed fix) — **squash-merge**
- Co-dev: CleAyz pushes to sandbox/main in parallel — fetch + check divergence before any branch op; use **merge** (never rebase) to reconcile the shared `sandbox`

## 7. Invariants — Do Not Break

**Cumulative.** Each persists until explicitly retired by the user.

- **Phone single-source-of-truth: `auth.users.phone` only.** Never reintroduce `financial_profiles.phone_e164` or any mirror. Cross-user reads via `get_my_advisor_contact()` SECURITY DEFINER RPC. _(added: 2026-05-14)_
- **No app-level dev/prod gating for auth.** Every dev/prod difference is a Supabase Dashboard config or per-env Supabase URL+anon key. No `NEXT_PUBLIC_DEPLOYMENT_ENV`-style flag. _(added: 2026-05-14)_
- **`handle_new_user` must not consume `raw_user_meta_data.phone_e164`.** Advisor phone is OTP-only on `/advisor/profile`. _(added: 2026-05-14)_
- **No service-role key in app code.** RLS is the trust boundary; cross-user `auth.users` reads via SECURITY DEFINER RPCs only. `scripts/` is the ONLY `SUPABASE_SERVICE_ROLE_KEY` consumer; never under `src/`; never `NEXT_PUBLIC_`-prefixed. _(added: 2026-05-14, expanded: 2026-05-15)_
- **Migration filenames unique per timestamp prefix** (`_100000`, `_200000` for sub-day ordering). Latest file: `20260522000000_advisor_qr_share_tokens.sql`. _(added: 2026-05-14, updated: 2026-05-15)_
- **`/auth/callback` `next=` must be validated** — same-origin, single `/`, ≤512 chars (`safeNext`). _(added: 2026-05-14)_

### Retired Invariants
- ~~QR deeplinks carry only the opaque token, never the access key~~ — retired per user 2026-05-16: QR feature shipped/merged (PR #6); contract still enforced by code (`peek/consume` RPCs, `?qr_token=` shape) but no longer a do-not-break invariant. _(retired: 2026-05-16)_
- ~~QR token: peek-on-GET, consume-on-POST~~ — retired per user 2026-05-16 (note: the open **P0** consume-ordering finding may revisit this contract anyway). _(retired: 2026-05-16)_
- ~~`SITE_URL` is the production canonical origin, not `VERCEL_URL`~~ — retired per user 2026-05-16: still true in code (`getSiteOrigin`) but de-listed as an invariant. _(retired: 2026-05-16)_

## 8. Agent Team State

No team active at handoff. Three teams were created and **gracefully torn down** this session: `qr-share` (QR feature), `income-tax-fix` (500 fix), `seed-key-fix` (genKey hex). No unfinished coordination. No orchestrator analysis docs created.
