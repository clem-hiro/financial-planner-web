# Codebase Issues — 2026-05-17

## Summary

0 TODOs, 0 FIXMEs, 0 HACKs, 0 STUBs, 0 other.

## Changes Since Last Scan

- **Resolved:** 0
- **New:** 0
- **Persisted:** 0

No marker delta. Prior scan (2026-05-16 baseline) was 0; current scan (`src/`, `scripts/`, `supabase/`, `*.ts`/`*.tsx`/`*.sql`, excluding `node_modules`) is still **0** — despite a large session (QR-digest P0 fix, PR #8 squash+back-merge, and the full proposal-overlay infra: `apply-overlay.ts`, `overlay-gate.ts`, `ProposalProjectionCompare.tsx` + 4 test files + the `apply-changes.ts`/`dashboard.ts` refactor). No `TODO`/`FIXME`/`HACK`/`STUB`/`XXX`/`WORKAROUND` markers introduced.

## Note

Repo convention favors `HANDOFF.md` §6 (P0/P1) + `BACKLOG.md` (P2) over inline code markers. This session's open work is tracked there:
- §6 **P0**: proposal-overlay infra is committed (`9a8f326`) + pushed + **PR #9 open** (sandbox→main, NOT merged) — needs CleAyz coordination on the two `apply-changes.ts` behavior changes before squash-merge.
- §6 **P1**: deferred `/simplify`+`/unslop` sweep on the overlay diff (run post-merge); old task #22 (QR dialog zoom); live QR-scan→signup prod smoke test.
- §6 next-session focus: the **client↔advisor consent gate** (restricted advisor view) — plan `~/.claude/plans/image-1-this-is-dapper-truffle.md`, one-table-pilot-then-review.
- §6 **P2** (in `BACKLOG.md`): parity numeric-fidelity gap; pre-existing `isNewEntity` quirk; access-keys error-log; dashboard growth-rate plumbing.
