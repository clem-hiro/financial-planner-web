# Session Handoff — 2026-05-18

## 1. State Snapshot

Branch `sandbox` @ `c36a5ee`, **in sync with `origin/sandbox`** (`0 0`). `origin/sandbox` is now a **strict superset of `origin/main`** (sandbox-only=3, **main-only=0** — back-merged this session so Phase 2 builds on a fully-synced base). **Consent-gate Phase 1 SHIPPED + applied to prod** (migration `20260528000000_advisor_consent_invariant.sql`; structural prod checks 2a–2e verified by the user; `verify_consent_gated_access()` correctly RAISEs on the 10 not-yet-migrated tables = the Phase-2 backlog). CleAyz's "Financial Setup" revamp (`83ca534`) + cash-flow + QR + Phase-1 are all on **both** branches. Operational reality unchanged: **no migration ledger**, migrations hand-applied to a **shared prod** via SQL editor; co-dev **CleAyz** pushes sandbox/main in parallel — fetch + divergence check, **merge never rebase**, sandbox→main **squash** + back-merge.

## 5. Active Focus

**NEXT SESSION = implement consent-gate Phase 2.** Read first: `~/.claude/plans/consent-gate-phase2-prep.md` (readiness review), then `~/.claude/plans/consent-gate-phase1-build-sequence.md` + `~/.claude/plans/image-1-this-is-dapper-truffle.md` (parent plan). Phase 1 gated only `financial_investments` + `financial_income_tax_configs`. Phase 2 = (a) migrate the remaining ~10 advisor-read surfaces to the consent chokepoint (`financial_expenses, financial_goals, financial_budget_lines, financial_budget_line_month_overrides, financial_cash_accounts, financial_liabilities, financial_cpf_balances, financial_housing_loans, financial_vehicles`, **`financial_profiles` LAST**); (b) roster RPC consent treatment; (c) **client-facing consent grant/withdraw UX** (the headline — currently NO write path exists, see §6 P0-H1); (d) ship gate: `verify_consent_gated_access()` clean on prod + the 10-pt Pre-Prod checklist. Replicate the Phase-1 pattern: Option-A `opts.viewer` discriminator + `advisor_read_<table>` SECURITY DEFINER RPC (template = `advisor_read_investments` in `20260528000000`) + drop all 4 legacy `*_advisor_clients` policies; one-surface-then-user-review; next migration prefix **`20260529000000`**. Sequencing rec (prep §5): 7 leaf surfaces → goals/budget_lines (dual read-path: dashboard + `advisor/client/[id]/page.tsx`) → roster → profiles last → client consent UX → ship gate.

**⚠ P0 PREREQUISITE before the Phase-2 consent-write UX ships — fix C1 (see §6).** The latest-event-wins tie-break is nondeterministic; it becomes exploitable exactly when the grant/withdraw producer exists. Fix the ordering in the same phase as the write path.

**Open Phase-2 decisions (resolve in a build-sequence ratification pass, à la Phase-1 D1/D2/D3):** P2-D1 setup-hub seam (`loadSetupTabBundle`/`loadSetupEvaluationContext` in `src/data/setup-status.ts` — a 2nd whole-portfolio read, self-only today but built toward "future advisor view"; must be gated or it bypasses the chokepoint); P2-D2 roster RPC `advisor_client_list_metrics` (returns client financial fields → needs `security definer` + per-row `advisor_can_read_client`; couples to profiles-last); P2-D3 migration-prefix dup (low-urgency hygiene, see §6); P2-D4 per-surface vs batched-leaves granularity + whether to add a `resolveClientReader(viewer)` indirection in `getDashboardPayload` before ~10 more ternaries accrete (preserve the byte-identical C8 self path).

## 6. Open Loops

**Resolved this session (trace in `git log`):** proposal-overlay infra committed `9a8f326` + PR #9 squash→`main` `3d695ad` + back-merge; consent-gate Phase 1 shipped (`70bc8d0`) + validated on prod-parity scratch + applied to prod; consent column (`d02992f`) + label `Granted/Withdrawn/Not Granted` (`30ae3c7`); CleAyz Financial Setup revamp merged + integrity-verified (`3027b53`/`307426f`); back-merge main→sandbox (`c36a5ee`); deferred passdown `/simplify`+`/unslop` sweep — **done this session** (6-agent audit; findings below); save-profile bug root-caused (debug verdict).

### New this session (from the passdown audit + investigations)

- **P0 — C1: consent latest-event-wins tie-break uses random UUIDv4 `id desc`.** `advisor_can_read_client` (`20260528000000:~90` `order by created_at desc, id desc`) and the TS reducer `computeConsentStatuses` (`src/data/repositories/advisor-clients.ts:~55`) tie-break identical-`created_at` events by a *random* UUID. Same-transaction (`now()` = txn start, identical) or same-tick grant+withdraw ⇒ nondeterministic consent decision, incl. possible silent advisor access to data the client believes revoked. Latent today (no write producer — H1) but **must be fixed in the same phase as the Phase-2 consent-write UX**. Fix: add a monotonic `bigint generated always as identity` (or `bigserial`) column to `advisor_client_consents`, tie-break on it in BOTH the SQL predicate and the TS reducer (keep them byte-identical — documented invariant), + a parity test using realistic lowercase-uuid-shaped ids (the existing test uses string-sortable `id-1`/`id-2` and CANNOT catch this). New migration `20260529000000`-range. → `LEARNINGS.md` `[anti-pattern]`.
- **P0 — H1: no consent-write producer in app code.** Feature is inert end-to-end (fail-closed denies every advisor; no grant/withdraw path). This IS Phase 2 (c). When built: append-only INSERT only (no UPDATE/DELETE — RLS deliberately omits them), `created_at` server-assigned (never client-supplied — would forge ordering), and it must land *with* the C1 monotonic-ordering fix.
- **P1 — H2: `withConsentStatus` conflates consent-query error with "no consent", silently.** `src/data/repositories/advisor-clients.ts:~94` `error||!data ? emptyMap : compute` → roster shows false "Not Granted" on transient DB failure with zero observability. Add `console.error` + a distinct `"unknown"` sentinel (don't collapse error into the definitive "none"). The *gate* is unaffected (separate fail-closed RPC) — display-only.
- **P1 — H3: `withConsentStatus` `.in(ids)` bounded only by an unrelated upstream page-size clamp.** Latent whole-page-wrong if the clamp is raised or a new caller passes unbounded ids → trips H2. Make it self-defending (chunk ids ~100, or assert/clamp locally).
- **P1 — perf: `advisor_can_read_client` evaluated 4–6× per advisor client-detail render; multiplicative in Phase 2 (~14–28 at N≈12).** `src/app/(app)/advisor/client/[id]/page.tsx:55-71,105`. Phase-2 prerequisites: (fix #1, safe) drop the duplicate `advisorReadInvestments` fetch in page.tsx and source `investments` from the already-fetched advisor `payload`; (fix #2, trust-boundary decision) request-scope `advisor_can_read_client` via React `cache()` (pattern: `getCachedProfileById`) — the RPC-internal re-checks are correct defense-in-depth, do NOT remove them.
- **P1 — Phase-2 leverage refactor (do BEFORE Phase 2):** extract `CONSENT_DENIED_MESSAGE` + an `assertConsent(supabase, clientId)` guard into `src/server/advisor-consent.ts`; refactor the two inline blocks (`advisor-client-actions.ts:58-67`, `advisor-proposal-actions.ts:60-69`). Converts a ~10-surface shotgun-surgery into one import; regex-loose tests stay green.
- **P1 — save-profile root cause = repo-AHEAD no-ledger drift (NOT prod-ahead; hypothesis falsified).** Every `financial_profiles` column the app writes IS migration-backed; the bug is a bundled migration not hand-applied to shared prod → PGRST204 → `route.ts:225-231` swallows it into a generic 500. **User action:** run on prod (Supabase SQL editor) `select column_name from information_schema.columns where table_schema='public' and table_name='financial_profiles' order by 1;` and confirm the 31-col repo set (esp. `expense_growth_nominal`, `salary_increment_month`, `last_salary_review_at`); apply any missing migration. **Hardening (separate):** surface the PGRST code/message in `route.ts` instead of the generic 500.

### Persisted from prior sessions

- **P1 (≥6 sessions) — shared-DB / no-migration-ledger. CONFIRMED-harmful; ESCALATED, needs explicit user decision** (per-env Supabase projects + a real migration tool/ledger). Root cause of the save-profile bug AND it compounds every one of Phase 2's ~10 manual surface migrations. Corroborating evidence this session: the `20260525`/`20260526` byte-identical duplicate (P2-D3) + the save-profile drift.
- **P1 — QR dialog zoom-robust sizing** (`AdvisorKeyQrShareButton.tsx`, old task #22, user-requested, not done — needs the user's manual zoom checklist).
- **P1 — live QR-scan→client-signup smoke test on prod** (unexercised end-to-end).
- **P1 — advisor access-keys page bypasses request-cache** (`src/app/(app)/advisor/access-keys/page.tsx`).
- **P1 — Relief field-spec triplication** (`IncomeTaxForm.tsx`/`validation.ts`/`income-tax-configs.ts`).
- **P1 (≥4 sessions) — income-tax cluster** (`deriveAutoAppliedReliefs` null; `ageCompletedOnDate(..,new Date())` live clock; tooltip; missing tests) and **salary-review/profile** (`/api/profile` missing `revalidatePath` for `salary_increment_month`/`last_salary_review_at`; client/server TZ on `salary_review_due`).
- **P1 (in `LEARNINGS.md`)** — `fulfill_access_key_purchase` no key-gen cap / M2-M3-M6 guards; coupon-validation GC; `AdvisorPhoneVerificationForm:46` overwrite.

_P2+ long-tail → `BACKLOG.md`: consent enum tri-naming (`active`/`granted`/`Granted`); `dashboard-advisor-viewer.test.ts` clock-pinning (dormant time-coupling); `consentBadge` tone-type dup (verified non-issue, do not pursue); LEARNINGS line-9 pgcrypto-schema entry contradicts INVARIANTS (`extensions` on prod) — reconcile._

### Security note (passdown audit)

`security-auditor` found **NO Critical/High/Medium** in the Phase-1 consent code: fail-closed predicate, sound SECURITY DEFINER (pinned search_path, revoke-public/grant-authenticated), append-only ledger, non-forgeable `opts.viewer`, server-resolved advisor identity. The consent gate is structurally sound as a PDPA trust boundary. C1 is an *edge-case/ordering* defect (race on tie), not a static auth gap.

## References

- Architecture/conventions/domain: `CLAUDE.md` → `AGENTS.md`
- Marker scan: `CODEBASE-ISSUES.md` (0 markers — repo uses HANDOFF §6)
- Anti-patterns/corrections: `LEARNINGS.md`
- Long-tail backlog (P2+): `BACKLOG.md`
- Phase-2 prep: `~/.claude/plans/consent-gate-phase2-prep.md`
- Phase-1 build-sequence: `~/.claude/plans/consent-gate-phase1-build-sequence.md`; parent plan: `~/.claude/plans/image-1-this-is-dapper-truffle.md`
- This session's commits: `git log --oneline f7d9522..c36a5ee`
- Co-dev: CleAyz parallel — fetch + divergence; **merge never rebase**; sandbox→main **squash** + back-merge

## 7. Invariants — Do Not Break

Refer to `INVARIANTS.md` (canonical, append-only). **Follow-up for the C1 fix:** once the monotonic tie-break lands, add an invariant — *"consent latest-event-wins ordering MUST be a total monotonic order (insertion-monotonic column), and the SQL predicate + TS `computeConsentStatuses` reducer MUST stay byte-identical."*

## 8. Agent Team State

- **Team:** `consent-gate-plan` (socket-backed; created this session). **Should be torn down** — all work delivered & shipped; user moving to a fresh Phase-2 session.
- **Teammates (all idle):** `coder` (consent gate + column + label impl), `reviewer` (code-review verifications), `researcher` (Phase-1 blast-radius, D2 verdict, Phase-2 prep), `debug` (save-profile root cause + drift falsification).
- **Orchestrator analysis:** none.
- **Unfinished coordination:** none — graceful teardown pending (SendMessage `shutdown_request` → ack → kill panes → `TeamDelete`). The 6 passdown-audit agents were ephemeral `Agent` calls (not team members), already complete.
- **Recurrence guard:** spawn teammates with cwd = **repo root** (subdir cwd froze on the external-`@AGENTS.md` trust prompt in a prior session).
