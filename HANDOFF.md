# Session Handoff — 2026-05-20

## 1. State Snapshot

Branch `sandbox` @ `504bf6a` — **HEAD is unchanged this session; the entire advisor↔client proposal-workflow redesign is UNCOMMITTED in the working tree (64 files)** per the user's standing "commits require explicit request" rule. The redesign is fully implemented and independently verified: tsc 0, 417 tests, `/simplify` + `/unslop` + verify-loop, a per-component functional smoke matrix, AND a real-browser Playwright sweep (Chromium + WebKit). Two critical defects were caught by the quality gates (that all-green CI would have shipped) and closed: (a) `base_version` conflict-safety was inert in prod; (b) the accept path's withdraw-vs-accept corruption + partial-failure create-duplication → fixed via a **claim→write→finalize** SECURITY DEFINER path (`pending→'accepting'→'accepted'`). The user hand-applied migrations **`20260601`→`20260606`** to the shared prod DB; a real-DB post-mortem returned **10/10 green** — and caught a critical miss: `20260603`'s comment falsely assumed `financial_profiles.updated_at` existed; it did not, so the trigger it added was breaking **every prod `financial_profiles` UPDATE** until the user hotfixed it (now tracked as corrective migration `20260606000000_financial_profiles_updated_at.sql`). A real-browser sweep then found a pre-existing app-wide **SSR hydration mismatch** (render-time `new Date()` + locale-default `Intl`) — fixed and real-browser re-verified (zero hydration errors both engines; main projection charts render). Origin housekeeping: the two stale `backup/*-preMerge-20260517` branches were deleted (fully merged, ahead=0); **`origin/archive/main-9ff33cc-pre-reset` kept** (1 unique pre-reset commit — delete only on explicit sign-off). Playwright was added then **fully removed** (devDep + binaries gone; `package.json`/lockfile clean). `sandbox` is ahead 4 / **behind 1** vs `origin/main` (the PR #13 squash — back-merge still pending). Operational reality unchanged: **one shared dev+prod Supabase, no migration ledger, hand-applied via SQL editor; agent hard-blocked from prod DB / `.env` / `main` merge**.

Active phase: no `build-context.json` / `build-sequence.md` (repo uses HANDOFF §6 + `BACKLOG.md` + `LEARNINGS.md`). Plan of record for the shipped redesign: `~/.claude/plans/1-and-2-done-clever-hejlsberg.md`.

## 5. Active Focus

**NEXT SESSION = fine tweaks from the implementations that landed this session.** The feature is real-DB + real-browser verified; what remains is user-gated decisions + optional polish — no further core implementation.

1. **DEFERRED commit decision (headline open action).** The entire verified redesign is uncommitted (64 working-tree files) per the user's standing "commits require explicit request" rule. Resurface this first — the longer it sits, the higher the loss risk. Recommended path when the user approves: one reviewed commit on `sandbox`, back-merge `origin/main`→`sandbox` first (merge-not-rebase; squash on the sandbox→main PR — `LEARNINGS.md` SOP), no push without explicit go.
2. **DEFERRED `origin/main`→`sandbox` back-merge** (sandbox behind 1 = PR #13 squash). Mechanically simple; folds into the commit/PR flow.
3. **Optional mini-chart `minHeight` polish** — the 3 `ResponsiveContainer`s (`ProjectionMiniChart`, `AgeCombinedAssetsProjectionChart`, `CpfProjectionByAgeChart`) still emit the known-benign Recharts 3.x dev-only async-measure `width(-1)/height(-1)` noise (~9 mini-charts measured 14×14 in headless). This is **NOT** the hydration bug (that is fixed) — it is the long-documented benign console noise. Explicit numeric `minHeight` deterministically renders them + silences the warning. Low-risk ~5 lines; optional.
4. **UX fine-tweaks on the now-rendering proposal screens** (any that surface when the user actually walks them: advisor `?view=overview|proposals` + the collapsible rail; client `/setup?tab=advisor-proposals` → `/setup/advisor-proposals/[id]` review + sticky Accept/Reject; compose-new-entry forms for budget_line/goal/investment).

Orientation: plan `~/.claude/plans/1-and-2-done-clever-hejlsberg.md`; backend = `src/server/advisor-proposal-actions.ts` + `src/domain/advisor-proposals/{apply-changes,apply-overlay,proposal-status-display}.ts` + migrations `20260601`–`20260606`; frontend = `src/features/advisor/{AdvisorClientDetailShell,AdvisorProposalsTable,AdvisorProposalDetailView,WithdrawProposalButton,AdvisorProposeRemovalButton}.tsx`, `src/features/proposals/{ClientProposalsView,ClientProposalReviewView,ProposalReviewView}.tsx`, `src/ui/CollapsiblePaneRail.tsx`.

Dead ends ruled out this session: the "doesn't render well" was NOT a Tailwind JIT-drop, NOT Safari (WebKit is clean — Chrome-surfaced), NOT the proposal redesign — it was a pre-existing render-time-`new Date()`/locale SSR hydration mismatch (now fixed). Mini-chart 14×14 is benign async-measure, not a layout bug.

## 6. Open Loops

**Resolved this session (trace via the working-tree diff + the plan file):** the entire propose-plans redesign (prior §5 Active Focus) — implemented, 2 critical remediations, smoke matrix, real-DB + real-browser verified; PR #13 merged + the two prior migrations confirmed (prior P0s "1 and 2 done"); the deferred passdown 6-agent audit (the full feature passed the complete 6-agent `/simplify`+`/unslop`+verify-loop this session; the net-new hydration delta got a focused fresh-frame security+edge-case pass — clean); the SSR hydration "doesn't render well" bug (root-caused + fixed + real-browser re-verified); the `financial_profiles.updated_at` prod break (hotfixed + corrective `20260606`).

**P0**
- **Entire verified redesign uncommitted (64 working-tree files).** User's standing rule = commits require explicit request. Resurface immediately; loss risk grows with time.

**P1**
- **`origin/main`→`sandbox` back-merge pending** (sandbox behind 1; PR #13 squash). Merge-not-rebase, squash SOP.
- **Mini-chart `minHeight` polish** _(persisted, 2 sessions)_ — benign Recharts dev-only async-measure noise on the 3 `ResponsiveContainer`s; optional deterministic fix; the documented next-session fine-tweak.
- **Deferred design-system sweep: ~40+ arbitrary `[#0c192f]`/`from-[#…]` sites repo-wide** _(persisted)_ — same Turbopack JIT-drop latent risk (LoginForm, AppShell, planning/setup, `more/page.tsx`, `input-classes.ts`, `ScrollToTopButton`, `app-tab-styles.ts:appActiveGradientStyle`). Candidate fix: register brand hexes as Tailwind v4 `@theme` tokens.
- **(≥8 sessions, ESCALATED — now with a confirmed PROD INCIDENT) no-migration-ledger / shared dev+prod Supabase.** This session it caused a real prod break: `20260603`'s false `financial_profiles.updated_at` precondition broke every prod profile UPDATE until hand-hotfixed; caught only by the real-DB post-mortem (every test layer + the in-memory fake masked it). This is no longer hypothetical compounding risk — it produced a live incident. Needs an explicit user decision (per-env Supabase projects + a real migration tool/ledger). Promoted to `LEARNINGS.md` as `[anti-pattern]` with a guard this session; still requires the user-level infra decision.
- **`origin/archive/main-9ff33cc-pre-reset` removal** _(new — standing decision)_ — kept deliberately (1 unique pre-reset commit, "advisor key purchase/coupons/phone/WhatsApp"). Delete only on explicit user sign-off that the post-reset lineage is canonical and that commit is intentionally discarded.
- **Persisted-from-prior cluster (untouched this session):** advisor-perf `advisor_can_read_client` 4–6×/client-detail render (`advisor/client/[id]/page.tsx`); `withConsentStatus` H2 (error→silent "Not Granted"; add `console.error`+`"unknown"` sentinel) / H3 (`.in(ids)` chunk ~100); save-profile prod-column-verify + surface PGRST code (`src/app/api/profile/route.ts:225-231`); QR-dialog zoom-robust sizing; live QR-scan→signup prod smoke; advisor access-keys page bypasses request-cache; income-tax cluster (`deriveAutoAppliedReliefs` null / live-clock / tooltip / missing tests) + relief field-spec triplication; `fulfill_access_key_purchase` no key-gen cap.

**P2+ → `BACKLOG.md`** (consent enum tri-naming; `dashboard-advisor-viewer.test.ts` clock-pinning; `appActiveGradientStyle` literal hex = part of the design-system sweep).

**Housekeeping (next session, not blocking):** global memory dir ~28KB is over the `/passdown` soft threshold (~12KB) — run `memory-curator` (scope global) next session; deliberately not run during this wrap (user directed a clean close, no questions).

## References
- Architecture, conventions, domain model: `CLAUDE.md` → `AGENTS.md`
- Marker scan: `CODEBASE-ISSUES.md` (0 markers)
- Anti-patterns/corrections: `LEARNINGS.md` (this session added the SSR-render-time-`new Date()`/locale hydration `[anti-pattern]` + corrective-migration/precondition entries)
- Long-tail backlog (P2+): `BACKLOG.md`
- Canonical invariants: `INVARIANTS.md` (append-only)
- Shipped-redesign plan of record: `~/.claude/plans/1-and-2-done-clever-hejlsberg.md`
- This session's work = the uncommitted working tree (`git diff` / `git status`); HEAD `504bf6a` unchanged
- Co-dev: CleAyz parallel — fetch + divergence check; **merge never rebase**; sandbox→main **squash** + back-merge

## 7. Invariants — Do Not Break

`INVARIANTS.md` is canonical & append-only. Carried forward (all still valid; not re-confirmed individually this session per user "no questions" — none retired):

- **Consent latest-event-wins MUST be a total monotonic order** via `advisor_client_consents.seq`; SQL `advisor_can_read_client` (`order by c.created_at desc, c.seq desc`) and TS `computeConsentStatuses` (`Number(seq)`) byte-identical. _(added: 2026-05-18)_
- **`advisor_client_consents` is append-only** — INSERT only; `client_user_id`/`advisor_user_id`/`created_at`/`seq` server-assigned, never client/form input. _(added: 2026-05-18)_
- **`verify_consent_gated_access()` recognizes `id = auth.uid()` self-form** in addition to `user_id = auth.uid()`; check #3 precise conjunction (self-form OR consent-routed), not a blanket public pass. _(added: 2026-05-18)_
- **Migration filenames unique per timestamp prefix.** _(added: 2026-05-18)_
- **Agent must NOT touch prod DB or `.env*`, and cannot merge to `main`** — hard safety-classifier block; agent-relayed/verbal authorization explicitly insufficient; user-direct only. _(added: 2026-05-18; reaffirmed 2026-05-19/20 — all 6 migrations + the hotfix were user-applied)_
- **Dashboard-surface load-bearing brand color/gradient/shadow MUST NOT use arbitrary `[...]` Tailwind classes** — Tailwind v4 + Turbopack dev JIT-drops them → invisible UI. Use inline-style constants or authored `globals.css` from `--exec-navy` tokens. _(added: 2026-05-19)_
- **pgcrypto-calling SECURITY DEFINER functions MUST declare `set search_path = public, extensions`**; never hard-qualify `extensions.<fn>`. _(added: 2026-05-19)_
- **SSR-hydration determinism: hydrated components MUST NOT compute SSR-affecting output from `new Date()`/`Date.now()`/`Math.random()` or locale-default `Intl`/`toLocale*(undefined,…)` at render.** Server vs client diverge → React hydration mismatch → subtree regenerated → Recharts `ResponsiveContainer` measures 0 → blank charts. Pass server-computed `asOf`/`currentAge` via the payload (never an `?? …new Date()` render fallback); pin locale to `"en-SG"`; defer genuinely client-only values to `useEffect`. _(added: 2026-05-20)_
- **Accept-path: the claim gates the writes.** `claim_advisor_proposal_for_accept` (`pending→'accepting'`, `FOR UPDATE`, fail-loud) MUST succeed BEFORE any entity write; entity writes only if claimed; `finalize_advisor_proposal_accept` (`'accepting'→'accepted'`, fail-loud) after. A proposal stuck in `'accepting'` is the terminal non-re-acceptable state (no create-op duplication). Never write entities before the claim; never relocate the `applyProposalChanges` overlay mapper into SQL (C6: one mapper, preview==accept). _(added: 2026-05-20)_
- **`base_version` optimistic concurrency:** every advisor UPDATE/DELETE change captures the target entity's `updated_at` as `base_version` at suggest-time; accept detects divergence per *distinct* base_version (not first-row-wins) and aborts zero-write on conflict; CREATE keeps `base_version=null` (applies unguarded). _(added: 2026-05-20)_
- **`financial_profiles.updated_at` exists (corrective `20260606`) and the `set_updated_at` trigger depends on it.** Fresh-env migration ordering caveat: `20260603` creates that trigger BEFORE `20260606` adds the column — clean bootstraps MUST apply through `20260606` before exercising the app; a future fresh-env squash should fold the column ahead of the trigger. Never retro-edit an already-applied migration (forward-only, no ledger). _(added: 2026-05-20)_

### Retired Invariants
_(none retired this session — user directed "no questions"; cumulative carry-forward only.)_

## 8. Agent Team State

- **Team:** `proposal-redesign` — **torn down this session** (graceful `shutdown_request` → `shutdown_approved` ack → both teammates terminated → `TeamDelete` succeeded; team/task dirs cleaned).
- **Teammates:** `backend-eng` (migrations/RPC/domain/actions), `frontend-eng` (UI/components/hydration fix). No active members.
- **Orchestrator analysis:** none.
- **Unfinished coordination:** none — clean shutdown.
- **Recurrence guard:** spawn teammates with cwd = **repo root**; verify `.claude/settings.json` `enabledMcpjsonServers` matches `.mcp.json` (`notion`) before spawning to avoid the trust-dialog stall.
