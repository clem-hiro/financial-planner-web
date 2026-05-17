# Session Handoff — 2026-05-17

## 1. State Snapshot

Branch `sandbox` @ `f7d9522`, **in sync with `origin/sandbox`** (`0 0`). **PR #8 squash-merged + back-merged this session** → `origin/main` @ `d977bf3`; `main` and `sandbox` are content-identical (6 sandbox-ahead commits = history shape only). No open PRs. Landed & pushed: nav-gradient fix `d319b4f`; QR-digest P0 `17a5edc` (`20260527000000_qr_digest_search_path_fix.sql`) — **applied to prod by the user and verified** (`proconfig` = `search_path=public, extensions` for both `peek`/`redeem`; pgcrypto-in-`extensions`-on-prod confirmed). Backup anchors on origin: `backup/main-preMerge-20260517` (988de45), `backup/sandbox-preMerge-20260517` (17a5edc); `backup/*-20260516` superseded.

**⚠ Biggest loose end:** the **proposal-overlay infra is fully implemented, independently reviewer-verified (tsc 0 / eslint 0 / vitest 235/235 / 5-point correctness+security PASS), but UNCOMMITTED on `sandbox`** — 7 new + 6 modified files (see §6 P0). Operational reality unchanged: no `schema_migrations` ledger, migrations hand-applied via SQL editor, pgcrypto in `extensions` on prod; co-dev **CleAyz** pushes sandbox/main in parallel — fetch + check divergence, **merge never rebase**, sandbox→main **squash-merge** + back-merge.

## 5. Active Focus

**NEXT SESSION STARTS HERE (user directive):** implement the **restricted advisor view** — advisor cannot see a linked client's data until that client consents; BOTH advisor and client see client data, gated by consent. Plan (FULLY REVISED 2026-05-17 — read it, it superseded the old per-table approach): `~/.claude/plans/image-1-this-is-dapper-truffle.md` (PDPA research `~/.claude/plans/…-agent-aefb3013f136983d6.md`). **Architecture decision (load-bearing, confirm before building):** the invariant must hold for non-claude-code future work too, so enforcement is **structural/DB-resident, not tooling**: Pillar 1 = a Postgres EVENT TRIGGER auto-enabling RLS on every new table; Pillar 2 = NO direct cross-user RLS policies — advisor→client reads ONLY via SECURITY DEFINER consent-checking RPCs (chokepoint; default advisor-invisible). This **supersedes** the old "per-table `advisor_can_read_client` predicate + `$rls-audit` linter" (process control, insufficient per the constraint) and is a **bigger refactor** (advisor read path moves off direct `.from(table)` to `.rpc()`). Still locked: append-only `advisor_client_consents`; fail-closed + re-consent prompt; Option B wording, App="BYOFA", server-side adviser name; contact-FA dialog gate. Migrations start at **`20260528000000`**. **Two pre-build decisions in the plan:** confirm the structural architecture; resolve the `financial_income_tax_configs` advice-integrity anomaly (advisor is silently tax-blind — fix via consent-gated RPC, recommended, or document+disclaimer). A **Pre-Production Invariant Checklist** (10 checks, run against prod) is in the plan as the one final ship gate.

**Implementation constraint (user, mandatory):** apply the RLS change to **ONE table's data first** (recommended pilot `financial_investments` — leaf, single advisor-UI surface; **NOT `financial_profiles`** which gates the roster). Then **validate** (as a linked advisor with a non-consented client: that table returns 0 rows; + functional UI check) and **get user review BEFORE continuing** to the remaining 11 advisor-read policies + 2 roster RPCs. Record the per-table procedure in a runbook; repeat.

**Sequencing dependency:** the uncommitted proposal-overlay infra (§6 P0) and the consent-gate both edit `src/app/(app)/advisor/client/[id]/page.tsx`. Resolve the overlay commit + CleAyz coordination **before/at the start of** the consent work to avoid working-tree/merge collision.

## 6. Open Loops

**Resolved this session (dropped; trace in `git log`):** QR P0 / old task #21 (`17a5edc`, applied+verified on prod, now on `main`); PR #8 (squash-merged → `d977bf3` + SOP back-merge `f7d9522`); 2026-05-16 nav-gradient carryover (`d319b4f`).

### New this session

- **P0 — proposal-overlay infra implemented + verified but UNCOMMITTED on `sandbox`.** 7 new (`apply-overlay.ts`, `overlay-gate.ts`, `ProposalProjectionCompare.tsx`, 4 test files) + 6 modified (`apply-changes.ts`, `dashboard.ts`, advisor client page, `AdvisorClientWorkspace.tsx`, review page, `ProposalReviewView.tsx`). Reviewer PASS 5/5 with fresh evidence. **Two co-dev-owned `apply-changes.ts` behavior changes need CleAyz coordination before merge:** (1) the 3 formerly-dropped profile fields (`retirement_dividend_yield_annual`, `retirement_withdrawal_rate_annual`, `annual_salary_growth_nominal`) now persist on accept; (2) a partial investment edit no longer clobbers unchanged fields (was: name→"Investment", current_value→0). Next session: get the user's commit go-ahead → commit overlay files **by name** (coder is alive for this, §8) → CleAyz heads-up → then tear down team.
- **P1 — deferred passdown quality sweep.** `/simplify`+`/unslop` (smell/perf/flakiness/security frame) was **not** run on the overlay diff this session — deliberately deferred to avoid auto-mutating uncommitted co-dev-sensitive WIP pre-handoff. Reviewer covered correctness+security (5/5). Run `/simplify`+`/unslop` on the overlay diff **after it's committed**.
- **P1 — QR dialog zoom-robust sizing (old task #22, NOT done, user-requested).** `src/features/advisor/AdvisorKeyQrShareButton.tsx`: dialog inline `width:'28rem'`, `maxWidth:'92vw'`, `maxHeight:'min(82dvh,40rem)'`, no explicit `height`, `boxSizing:'border-box'`; QR wrapper inline `width:'13.75rem'`, drop arbitrary class, keep `[&_svg]:h-auto [&_svg]:w-full`. Needs the user's manual zoom checklist.
- **P1 — live QR-scan → client-signup smoke test on prod (pending).** Schema verified + on `main`, but the end-to-end scan→signup runtime path is unexercised.

### Persisted from prior sessions

- **P1 — advisor access-keys page bypasses request-cache** (`src/app/(app)/advisor/access-keys/page.tsx`): redundant `auth.getUser` + profiles SELECT vs layout `getRequestAuth()`. Re-verify line refs.
- **P1 — Relief field-spec triplication** (`IncomeTaxForm.tsx`, `validation.ts`, `income-tax-configs.ts`): 17 keys × 3; CPFB re-bases annually → silent 400 on drift. Extract client-safe `RELIEF_FIELDS`.
- **P1 (≥3 sessions) — income-tax cluster:** `deriveAutoAppliedReliefs` missing-vs-invalid `null`; `ageCompletedOnDate(.., new Date())` live clock not assessment-year-end; tooltip restructure; missing tests; API-harness PATCH rebate-pair test.
- **P1 (≥3 sessions) — salary-review/profile:** client/server TZ mismatch on `salary_review_due:<year>`; `/api/profile` missing `revalidatePath` for `salary_increment_month`/`last_salary_review_at`.
- **P1 (≥4 sessions, in `LEARNINGS.md`):** `fulfill_access_key_purchase` key-gen loop no iteration cap; coupon-validation GC per-check; `AdvisorPhoneVerificationForm:46` `setPhone(normalized)` overwrites typed input; `fulfill_access_key_purchase` M2/M3/M6 guards.
- **P1 (≥5 sessions) — shared-DB / no-migration-ledger. CONFIRMED-harmful; escalate.** Hand-applied yet another migration (`20260527`) to prod this session. Needs an explicit user decision (per-env Supabase projects + a real migration tool/ledger).

_P2+ long-tail (incl. the reviewer's 2 non-blocking overlay items: parity numeric-fidelity gap, pre-existing `isNewEntity` quirk; access-keys error-log; dashboard growth-rate plumbing): `BACKLOG.md`._

## References

- Architecture, conventions, domain model: `CLAUDE.md` → `AGENTS.md`
- Marker scan: `CODEBASE-ISSUES.md` (0 markers — repo uses HANDOFF §6)
- Anti-patterns / corrections: `LEARNINGS.md`
- Long-tail backlog (P2+): `BACKLOG.md`
- Consent-gate plan (next focus): `~/.claude/plans/image-1-this-is-dapper-truffle.md`
- Overlay infra plan: `~/.claude/plans/proposal-overlay-projection-gate.md`
- This session's commits: `git log --oneline aa25586..f7d9522`; uncommitted overlay diff: `git diff` + untracked `src/domain/advisor-proposals/*overlay* *parity*`
- Backups (origin): `backup/main-preMerge-20260517` (988de45), `backup/sandbox-preMerge-20260517` (17a5edc)
- Co-dev: CleAyz parallel — fetch + divergence check; **merge never rebase**; sandbox→main **squash** + back-merge

## 7. Invariants — Do Not Break

Refer to INVARIANTS.md

## 8. Agent Team State

- **Team:** `proposal-overlay` (ALIVE, NOT torn down — intentional, pending the user's overlay-commit decision; socket `claude-swarm-89741`).
- **Teammates:** `coder` (impl — tasks #1–#3 done+verified; idle; **kept alive to do the commit-by-name** once authorized; no TaskUpdate tool — lead manages board), `reviewer` (code-reviewer — task #4 done, PASS 5/5; idle).
- **Orchestrator analysis:** none.
- **Unfinished coordination:** overlay commit + CleAyz heads-up (the two `apply-changes.ts` behavior changes) → then graceful team teardown (SendMessage `shutdown_request` → ack → kill panes %1/%2 on `claude-swarm-89741` → `TeamDelete`).
- **Recurrence guard:** spawn teammates with cwd = **repo root** (this session they spawned with cwd `src/features/advisor` → froze on the external-`@AGENTS.md`-import trust prompt until the user pressed `1`).
