# Session Handoff — 2026-05-16

## 1. State Snapshot

Branch `sandbox` @ `aa25586`, **in sync with `origin/sandbox`** (`0 0`), **strict superset of `origin/main`** (3 ahead: `cc3ed97` cash-flow, `c80a496` origin/sandbox re-sync merge, `aa25586` origin/main reconciliation merge; 0 behind). **PR #6 & PR #7 MERGED.** **PR #8 OPEN** — https://github.com/clem-hiro/financial-planner-web/pull/8 — sandbox→main, carries the cash-flow enhancement + the [Debts] reconciliation; **must be squash-merged** per SOP, then back-merge `origin/main`→`sandbox`. Three big workstreams landed on `sandbox` this session: (a) **QR security hardening** (`b1085a9`: atomic redeem in `handle_new_user`, `token_hash` at rest, advisor name on scan, mint `FOR UPDATE`); (b) **cash-flow** Phase 1+2 (`cc3ed97`); (c) **reconciliation** onto co-dev's `[Debts]` feature (`988de45` on main) — adopted `sumInvestableSurplusOverHorizon` as the single surplus engine, folded cash-flow scope in, restored the Finding-A cap, re-parented our migration to `20260526000000`. Migrations on disk: …`20260523` (QR), `20260524` (co-dev advisor_proposals), `20260525` (co-dev liability_debt_planning), `20260526` (expense_growth_nominal). **Prod QR hotfix applied by operator via Supabase SQL editor** (mint `p_token_hash` signature, peek/redeem with `search_path=public, extensions`, stale `…p_force_new` overload + `consume_qr_share_token` dropped) — verified correct. Co-dev CleAyz pushes to `sandbox`/`main` in parallel — always `git fetch` + check divergence before branch ops; reconcile via **merge never rebase**. Backup branches retained: `backup/cashflow-preMerge-20260516`, `backup/sandbox-preMainMerge-20260516`, `backup/preMainReconcile-20260516`.

**Operational reality discovered this session (load-bearing):** the **serving DB has no `supabase_migrations.schema_migrations` ledger** — migrations are **hand-applied via the SQL editor**, and its lineage **diverged** from the repo (it had a stale `mint_qr_share_token(…, p_force_new, p_token)` the repo never defined). **pgcrypto lives in the `extensions` schema on prod** (NOT `public` as the repo migrations assume) — this is why QR `peek`/`redeem` need `search_path = public, extensions`.

## 5. Active Focus

**No carryover implementation topic. Per the user, the next session's task is to be defined and discussed at session start — ask first.** All in-flight loose ends below are captured at priority in §6; the user explicitly deferred ordering them to next session's discussion (do not assume an order).

State at handoff: cash-flow + QR-hardening + [Debts] reconciliation are committed and pushed to `sandbox`; PR #8 open. Prod QR mint is unblocked (operator hand-fix verified). Two small, fully-specified follow-ups were dispatched to the `cashflow-projection` team but the coder **stalled and did not produce them** (see §6 P0/P1 and §8) — their specs are locked in tasks #21 and #22.

## 6. Open Loops

**Resolved this session (dropped; trace in `git log`):** prior §6 QR **P0 consume-before-commit** + the 3 QR **P1s** (`peekExistingLiveToken` dead-token, `mint` non-atomic, peek/consume contract) — all superseded by the QR hardening (`b1085a9`: redemption is atomic in `handle_new_user`, `peekExistingLiveToken` deleted/always-mint, mint `FOR UPDATE`, `token_hash` at rest). The cash-flow Finding-A bug + expense-inflation gap (this session's research) — fixed in `cc3ed97`/`aa25586`.

### New this session

- **P0 — repo↔prod migration divergence (task #21, NOT done).** Operator hand-applied a corrected `20260523`-equivalent to prod (with `search_path=public, extensions`), but the **repo's `20260523000000` still has unqualified `digest()` under `search_path=public`** → the next deploy/any fresh env where pgcrypto is in `public` is fine, but prod (pgcrypto in `extensions`) regresses QR scan/signup. Fix = forward-only `supabase/migrations/20260527000000_qr_digest_search_path_fix.sql` (`create or replace` `peek_qr_share_token`+`redeem_qr_share_token` with `set search_path = public, extensions`, verbatim bodies from `20260523`, re-assert grants). Spec is locked in **task #21**. Also unresolved: the serving DB has no migration ledger and a divergent lineage — see §1; this keeps causing incidents (relates to the shared-DB P1 below).
- **P1 — QR dialog zoom-robust sizing (task #22, NOT done, user-requested).** `src/features/advisor/AdvisorKeyQrShareButton.tsx` still has `width:'100%'`, `maxHeight:'100vh'`, arbitrary `[&_svg]:max-w-[280px]` → the popup re-proportions to the viewport on every browser-zoom step and can cover the full vertical axis. Fix (locked in **task #22**, exact values): dialog inline style → `width:'28rem'`, `maxWidth:'92vw'`, `maxHeight:'min(82dvh, 40rem)'`, no explicit `height` (content-driven), `boxSizing:'border-box'`; QR wrapper inline `width:'13.75rem'`, drop the arbitrary class, keep core `[&_svg]:h-auto [&_svg]:w-full`. Inline style is mandatory (LEARNINGS: Turbopack JIT drops arbitrary `[...]`). Visual/zoom is NOT headlessly verifiable — needs the user's manual zoom checklist (100/150/200/400% + ~360px width: scales uniformly, centered, margin all sides, never near full height, internal scroll only at extreme zoom).
- **P1 — live QR-scan → client signup smoke test on prod (pending).** Operator hand-fix verified the *schema* (mint resolves, peek/redeem have the right `search_path`), but the end-to-end scan→signup path (`peek` on `/login` GET, `redeem` inside `handle_new_user`) has not been exercised on prod. Until run, QR client signup is unverified end-to-end.
- **P1 — PR #8 review + squash-merge** (sandbox→main; cash-flow + [Debts] reconciliation; large scope). Then back-merge `origin/main`→`sandbox`.
- **P2 — observability:** `src/app/(app)/advisor/access-keys/page.tsx:39` `console.error(..., e)` serialized the PostgREST error to `{}`, masking the `PGRST202` root cause for the whole debugging cycle. Harden to log `e?.code ?? (e instanceof Error ? e.message : JSON.stringify(e))`. → `BACKLOG.md`.
- **P2 — `/simplify` report-only:** duplicated growth-rate plumbing across the two `dashboard.ts` `sumInvestableSurplusOverHorizon` call sites; `profileExpenseGrowthNominal`/`profileAnnualSalaryGrowthNominal` recomputed ~107×/render (incl. the ~51-pt chart loop) — hoist to single locals near the `monthsToRet` definition. Behavior-neutral cleanup. → `BACKLOG.md`.

### Persisted from prior sessions

- **P1 — advisor access-keys page bypasses the request-cache** (`src/app/(app)/advisor/access-keys/page.tsx`): redundant `auth.getUser` + profiles SELECT per render vs the layout's `getRequestAuth()`. May have shifted after the [Debts] merge — re-verify line refs before acting.
- **P1 — Relief field-spec triplication** (`IncomeTaxForm.tsx`, `validation.ts`, `income-tax-configs.ts`): 17 relief keys × 3, caps duplicated; CPFB re-bases annually → silent 400 on drift. Extract a client-safe `RELIEF_FIELDS` table.
- **P1 (3 sessions) — income-tax cluster:** `deriveAutoAppliedReliefs` missing-vs-invalid `null`; `ageCompletedOnDate(..., new Date())` uses live clock not assessment-year-end; per-category tooltip restructure; missing `deriveAutoAppliedReliefs` tests; API-harness integration test for the PATCH rebate-pair invariant.
- **P1 (≥3 sessions) — salary-review/profile:** client/server TZ mismatch on `salary_review_due:<year>` dedupe key; `/api/profile` lacks `revalidatePath` for `salary_increment_month`/`last_salary_review_at`.
- **P1 (≥4 sessions, in `LEARNINGS.md`) — close or act:** `fulfill_access_key_purchase` key-gen loop no iteration cap; coupon-validation GC per-check vs pg_cron/`random()<0.01`; `AdvisorPhoneVerificationForm:46` `setPhone(normalized)` overwrites typed input; `fulfill_access_key_purchase` M2/M3/M6 guards.
- **P1 (≥4 sessions) — shared-DB / no-migration-ledger decision. Now CONFIRMED-harmful.** This session proved the single shared Supabase project + hand-applied migrations + no `schema_migrations` ledger caused a divergent prod lineage and the pgcrypto-schema incident. Textbook fix: per-env Supabase projects + a real migration tool/ledger. **Needs an explicit user decision** — it has now caused multiple production incidents.

## References

- Architecture, conventions, domain model: `CLAUDE.md` → `AGENTS.md`
- Code marker scan: `CODEBASE-ISSUES.md` (0 markers — repo uses HANDOFF §6 over inline TODOs)
- Anti-patterns / corrections: `LEARNINGS.md`
- Long-tail backlog (P2+): `BACKLOG.md`
- This session's diff: `git log --oneline 87ba755..aa25586` then `git diff 87ba755..aa25586`
- Cash-flow plan + audit: `~/.claude/plans/run-research-for-security-fancy-valley.md`; QR security audit + sourced brief: same dir (`…-agent-a94779d5bcdc239fb.md`)
- Open PR: **#8** (sandbox→main, cash-flow + [Debts] reconciliation) — **squash-merge**
- Prod QR hotfix SQL (verbatim, with `search_path=public, extensions`): in the conversation transcript; durable repo form pending as task #21 (`20260527000000_qr_digest_search_path_fix.sql`)
- Backups: `backup/cashflow-preMerge-20260516`, `backup/sandbox-preMainMerge-20260516`, `backup/preMainReconcile-20260516`
- Co-dev: CleAyz pushes to sandbox/main in parallel — fetch + check divergence; **merge never rebase**; sandbox→main PRs **squash-merge**

## 7. Invariants — Do Not Break

**Cumulative.** Each persists until explicitly retired by the user. (User confirmed all valid + new ones added, 2026-05-16.)

- **Phone single-source-of-truth: `auth.users.phone` only.** Never reintroduce `financial_profiles.phone_e164` or any mirror. Cross-user reads via `get_my_advisor_contact()` SECURITY DEFINER RPC. _(added: 2026-05-14)_
- **No app-level dev/prod gating for auth.** Every dev/prod difference is Supabase Dashboard config or per-env URL+anon key. No `NEXT_PUBLIC_DEPLOYMENT_ENV`-style flag. _(added: 2026-05-14)_
- **`handle_new_user` must not consume `raw_user_meta_data.phone_e164`.** Advisor phone is OTP-only on `/advisor/profile`. _(added: 2026-05-14)_
- **No service-role key in app code.** RLS is the trust boundary; cross-user `auth.users` reads via SECURITY DEFINER RPCs only. `scripts/` is the ONLY `SUPABASE_SERVICE_ROLE_KEY` consumer; never under `src/`; never `NEXT_PUBLIC_`-prefixed. _(added: 2026-05-14, expanded: 2026-05-15)_
- **Migration filenames unique per timestamp prefix** (`_100000`/`_200000` sub-day ordering). Latest on disk: `20260526000000_profile_expense_growth_nominal.sql` (co-dev: `20260524`/`20260525`). Next QR fix reserved: `20260527000000_qr_digest_search_path_fix.sql`. _(added: 2026-05-14, updated: 2026-05-16)_
- **`/auth/callback` `next=` must be validated** — same-origin, single `/`, ≤512 chars (`safeNext`). _(added: 2026-05-14)_
- **One cash-flow surplus engine: `sumInvestableSurplusOverHorizon`** (`src/domain/finance/investable-surplus.ts`). `gE=0 ∧ gI=0` MUST stay byte-identical to the pre-extension [Debts] computation (exact `===0` fast-path regression guard). Never reintroduce a competing accrual (the deleted `accrueTakeHomeSurplus`/`buildAgeAssetProjection`). _(added: 2026-05-16)_
- **Net-worth-by-age chart caps surplus/bonus at the target retirement age (Finding A).** Per-age call `months: Math.min(p.monthsFromToday, monthsToRet)`, scalar `monthsToRet`; chart must equal `projectedAtRetirement` at retirement. _(added: 2026-05-16)_
- **QR token stored only as `sha256` hash (`token_hash`)** — raw token never persisted; lives only in the QR URL. _(added: 2026-05-16)_
- **QR redemption is atomic inside `handle_new_user`** (consume + key-claim + bind one auth-insert txn; bad/replayed token RAISEs → full rollback, fail-closed). No pre-signup consume, no fail-open fallback. _(added: 2026-05-16)_
- **`digest()` in the QR SECURITY DEFINER functions must resolve regardless of pgcrypto's schema** — `peek_qr_share_token`/`redeem_qr_share_token` use `set search_path = public, extensions`. Do NOT hard-qualify `extensions.digest` (breaks repo-lineage dev DBs where pgcrypto is in `public`). _(added: 2026-05-16)_

### Retired Invariants
- ~~QR deeplinks carry only the opaque token, never the access key~~ — retired 2026-05-16 (QR shipped; contract still code-enforced). _(retired: 2026-05-16)_
- ~~QR token: peek-on-GET, consume-on-POST~~ — retired 2026-05-16; superseded by atomic-redeem-in-trigger (consume moved into `handle_new_user`). _(retired: 2026-05-16)_
- ~~`SITE_URL` is the production canonical origin, not `VERCEL_URL`~~ — retired 2026-05-16 (still true in `getSiteOrigin`, de-listed as invariant). _(retired: 2026-05-16)_

## 8. Agent Team State

- **Team:** `cashflow-projection` (still exists at handoff; not torn down).
- **Teammates:** `coder` (implementation — **stalled/idle**, did not produce tasks #21/#22 despite repeated dispatch), `reviewer` (code-reviewer — idle; delivered 5+ clean review rounds this session).
- **Outstanding tasks:** #21 (forward-fix migration `20260527…`) and #22 (QR dialog zoom sizing) — fully specified, not implemented. Next session: either re-drive this team or implement directly, then tear the team down.
- **Earlier team:** `qr-hardening` — created and gracefully torn down this session after the QR work landed.
- **Orchestrator analysis:** none. **Unfinished coordination:** tasks #21/#22 unstarted; coder unresponsive.
