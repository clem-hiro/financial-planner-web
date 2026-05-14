# Session Handoff — 2026-05-14

## 1. State Snapshot

Branch `sandbox` at `c588967`, in sync with `origin/sandbox`. Hosted Supabase DB has migrations applied through `20260517110000_drop_phone_mirror_columns.sql` (Option C — phone is single-source-of-truth in `auth.users`). No build-sequence or active phase file in this repo. Working tree carries only untracked tooling dirs (`.claude/`, `.codex/`, `docs/`, `scripts/`) plus the staged plan file at `/Users/hiroshifujiwara/.claude/plans/...corbato.md` which preserves the **income tax calculator plan** for resumption.

## 5. Active Focus

**Next session: income tax calculator feature.** The full plan is preserved at the bottom of `/Users/hiroshifujiwara/.claude/plans/read-engineering-docs-and-function-tree-enumerated-corbato.md` under "Paused — Income Tax Calculator Plan." Three phases (calculator, inbox notifications, increment-month reminder), all four AskUserQuestion decisions already captured (reliefs = categorical fields, notifications = inbox, tax flows as synthetic expense, `/setup?tab=income_tax` section). Tax-fact grounding (IRAS bracket table YA 2024 onwards, $80K cap, earned-income tiers, Personal Income Tax Rebate as opt-in) is in the plan file with sources.

This session was a side quest, now closed:

1. Cherry-picked the advisor key-purchase + coupons + phone-verify + WhatsApp-contact feature from `main` onto `sandbox` (commit `7f990f8`).
2. Collapsed phone storage to single-source-of-truth in `auth.users` — dropped `financial_profiles.phone_e164` mirror, `syncAdvisorVerifiedPhoneAction`; rewrote `get_my_advisor_contact()` to JOIN `auth.users` (commit `0d94eef`).
3. Added `/auth/callback` route + pruned dead helpers (`e164PhoneSchema`, `whatsapp-link.ts`) (commit `35665a1`).
4. Hardened `/auth/callback` `next=` redirect against open-redirect + oversized Location header (commit `c588967`).

Both DB migrations (`20260517100000_*` and `20260517110000_*`) were applied manually via the Supabase Dashboard SQL editor in this session. Pre-flight data check confirmed zero rows had populated phone columns before the drop.

## 6. Open Loops

### Dev → Production switch — required steps (no app-level config)

When promoting from sandbox to production, this is the complete checklist. Per the latest design decision, there is **no app-level env var or code branch** driving dev/prod behavior — every difference is a Supabase Dashboard config or per-environment credentials.

| # | Where | Action | Why |
|---|---|---|---|
| 1 | Supabase Dashboard → Authentication → Sign In / Providers → Email | Flip **Confirm Email** ON | In dev it's OFF (signup grants session immediately). In prod it's ON (Supabase blocks signin until the user clicks the confirmation link). |
| 2 | Supabase Dashboard → Authentication → Sign In / Providers → Phone | Set **provider = Twilio** + configure Twilio Account SID, Auth Token, Message Service SID | Until configured, `auth.updateUser({phone})` errors. The OTP verify form on `/advisor/profile` is wired to surface this error explicitly ("Check that Supabase Auth Phone is enabled with an SMS provider"). |
| 3 | Supabase Dashboard → Authentication → Sign In / Providers → Phone → **Confirm phone change** toggle | **Leave ON** (the default) | This is what causes `updateUser({phone})` to actually send the OTP. Flipping it off would silently set the phone without verification, defeating the explicit-click flow. |
| 4 | Project deployment env (Vercel, Render, etc.) | Set `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the prod project's values | Standard. |
| 5 | (No code change needed) | `/auth/callback` route is already in the codebase (`src/app/auth/callback/route.ts`); LoginForm already sets `emailRedirectTo` to it | Required for prod email-confirm flow to land somewhere instead of 404'ing. |

### P0 (do next)

- **P0** Resume the income tax calculator plan. Plan file location given above; first deliverable is the migration + domain calc + repo + page for the calculator (Phase 1). Inbox + increment-reminder are subsequent phases.
- **P0** `src/features/advisor/AdvisorPhoneVerificationForm.tsx:19-21,71-85` — phone-verify form has two related race-condition bugs (audit findings H3 + H4):
  - `verified` predicate compares `user.phone` (from prop) against the current input value, not against the number actually sent for OTP. If the user edits the input mid-flow, the badge can flip incorrectly.
  - `verifyCode` calls `verifyOtp({phone: <current input>})` but the OTP was minted for whatever phone was sent at `sendCode` time. If the user edits between Send and Verify, Supabase returns "Token expired/invalid" — misleading error pointing at the user input change, not the underlying mismatch.

    **Fix:** capture `sentToPhone` in local state inside `sendCode()`; use that for both the `verified` check and as the `phone` argument to `verifyOtp`. Reset `sentToPhone` when the input changes. ~10 LOC.

### P1 (do soon)

- **P1** `supabase/migrations/20260517100000_advisor_key_purchases_coupons_contact.sql:555-572` — `fulfill_access_key_purchase` key-generation loop has no iteration cap. Termination relies on 128-bit RNG entropy + `statement_timeout`. Defensive fix: add `v_attempts < p_quantity * 16` ceiling that raises if exceeded. Cheap insurance against future RNG misconfig.
- **P1** `supabase/migrations/20260517100000_*.sql:288-291, 434-437` — coupon-validation-attempts GC runs `DELETE FROM coupon_validation_attempts WHERE attempted_at < now() - interval '1 day'` on every coupon check. Under concurrent advisor load this contends on row locks unnecessarily. Move to a daily pg_cron sweep, or gate behind `random() < 0.01`.
- **P1** `src/features/advisor/AdvisorPhoneVerificationForm.tsx:46` — `setPhone(normalized)` silently overwrites the user-typed phone with the E.164-normalized form. If region inference is wrong, user has no chance to correct. Surface the normalized number in the `info` line ("Verification code sent to <number>") so the user can confirm.
- **P1** `src/domain/finance/advisor-client-health.ts:149` — `formatYearMonth(new Date())` is reached only when the test fixture omits `payload.month`. Today's `advisor-client-health.test.ts` doesn't exercise the load-bearing branch (fixture has null `cpf_age_band`), so it's not flaky now. If the fixture grows to assert CPF-aware take-home in the headline, this becomes timezone-flaky across month boundaries. Pass an explicit `payload.month: "2026-05"` when the fixture grows.
- **P1** Other-contributor onboarding documentation. If this repo ever gains a second contributor, the "shared DB or own DB" decision becomes urgent (drop-column migrations on a shared dev DB break the un-pulled contributor's app). The textbook fix is one Supabase project per contributor + `supabase link` + `supabase db push`. Discussed in conversation; not yet documented in `AGENTS.md` / `PROJECT_CONTEXT.md`.
- **P1** Audit medium-severity defensive items in `fulfill_access_key_purchase` (M2, M3, M6 from the audit). Today they're safe because of FOR UPDATE locking + the single-unique-constraint shape, but defensive guards (`raise if v_purchase.id is null after fallback select`; `returning remaining_redemptions` on the coupon UPDATE) would prevent silent regressions if more unique constraints are added later.

## 7. Invariants — Do Not Break

- **Phone single-source-of-truth: `auth.users.phone` only.** Never reintroduce `financial_profiles.phone_e164` or any mirror column. App reads phone via `auth.getUser()` (for own user) or via the `get_my_advisor_contact()` SECURITY DEFINER RPC (for cross-user reads). _(added: 2026-05-14)_
- **No app-level dev/prod gating for auth.** Every dev/prod difference for auth is a Supabase Dashboard config (`Confirm Email`, Twilio creds) or per-environment Supabase URL + anon key. There is no `NEXT_PUBLIC_DEPLOYMENT_ENV` env var; do not introduce one for auth-related behavior. _(added: 2026-05-14)_
- **`handle_new_user` trigger must not consume `raw_user_meta_data.phone_e164`.** Signup no longer carries phone. Advisor phone collection is exclusively via the OTP flow on `/advisor/profile`. _(added: 2026-05-14)_
- **No service role key in app code.** RLS is the trust boundary. All cross-user reads of `auth.users` go through SECURITY DEFINER RPCs, never via the admin API. _(added: 2026-05-14)_
- **Migration filenames are unique per timestamp prefix.** Sandbox already had `20260517000000_housing_loan_bsd_paid_from_cpf_oa.sql` when the advisor migration was cherry-picked; it was renumbered to `20260517100000_*` to avoid the collision. Future migrations must avoid prefix collision — use `_100000`, `_200000` etc. when a sub-day ordering is needed. _(added: 2026-05-14)_
- **`/auth/callback` `next=` query param must be validated.** Only same-origin paths starting with single `/`, length ≤ 512. Already enforced in `src/app/auth/callback/route.ts:safeNext`. _(added: 2026-05-14)_

## References

- Architecture, conventions, domain model: `CLAUDE.md` → `AGENTS.md`
- Marker scan (TODO/FIXME/HACK/STUB): `CODEBASE-ISSUES.md`
- Income tax calculator plan (paused, ready to resume): `/Users/hiroshifujiwara/.claude/plans/read-engineering-docs-and-function-tree-enumerated-corbato.md` § "Paused — Income Tax Calculator Plan"
- This session's diff: `git log --oneline 7f3b77f..HEAD` then `git diff 7f3b77f..HEAD` (merge base with `main`)
- Migration ledger: `supabase/migrations/` — 33 files; latest is `20260517110000_drop_phone_mirror_columns.sql`
- Supabase Dashboard config for prod switch: section "Dev → Production switch" above
