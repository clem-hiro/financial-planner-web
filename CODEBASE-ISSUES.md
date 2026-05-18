# Codebase Issues — 2026-05-18

## Summary

0 TODOs, 0 FIXMEs, 0 HACKs, 0 STUBs, 0 other.

## Changes Since Last Scan

- **Resolved:** 0
- **New:** 0
- **Persisted:** 0

No marker delta. Prior scan (2026-05-17) was 0; current scan (`src/`, `scripts/`, `supabase/` — `*.ts`/`*.tsx`/`*.sql`, excluding `node_modules`) is still **0**, despite a large session (consent-gate Phase 1 + consent column + label relabel + CleAyz Financial-Setup-revamp merge + main→sandbox back-merge). No `TODO`/`FIXME`/`HACK`/`STUB`/`XXX`/`WORKAROUND` markers introduced.

## Note

Repo convention favors `HANDOFF.md` §6 (P0/P1) + `BACKLOG.md` (P2) over inline code markers. The substantive items the next session must act on are **not** marker-shaped — they are the passdown-audit findings in `HANDOFF.md` §6:

- §6 **P0**: C1 — consent latest-event-wins tie-break uses random UUIDv4 `id desc` ⇒ nondeterministic on same-`created_at` (fix with the Phase-2 consent-write UX). H1 — no consent-write producer yet (Phase 2 (c), the headline).
- §6 **P1**: `withConsentStatus` silent error→"none" (H2) + unbounded `.in()` (H3); `advisor_can_read_client` 4–6×/render (Phase-2-multiplicative perf); pre-Phase-2 `assertConsent`/`CONSENT_DENIED_MESSAGE` extraction; save-profile repo-AHEAD drift (user runs the prod `financial_profiles` column-list verify) + `route.ts:225-231` generic-500 hardening.
- §6 next-session focus: **consent-gate Phase 2** — `~/.claude/plans/consent-gate-phase2-prep.md`; per-surface, one-then-review.
- §6 **P2** (`BACKLOG.md`): consent enum tri-naming; test clock-pinning; `consentBadge` tone-type (non-issue); LEARNINGS line-9 pgcrypto-schema vs INVARIANTS reconcile.

If a future session adds markers, this file diffs them and surfaces resolved/persisted/new.
