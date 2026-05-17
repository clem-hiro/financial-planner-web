# Codebase Issues — 2026-05-16

## Summary

0 TODOs, 0 FIXMEs, 0 HACKs, 0 STUBs, 0 other.

## Changes Since Last Scan

- **Resolved:** 0
- **New:** 0
- **Persisted:** 0

No marker delta. Prior scan (2026-05-16 baseline) was 0; current scan (`src/`, `scripts/`, `supabase/`, excluding `node_modules`) is still 0 — despite a very large session (QR hardening, cash-flow Phase 1+2, the [Debts] reconciliation merge, prod QR hotfix). No `TODO`/`FIXME`/`HACK`/`STUB`/`XXX`/`WORKAROUND` markers introduced.

## Note

Repo convention favors `HANDOFF.md` §6 (P0/P1) + `BACKLOG.md` (P2) over inline code markers. This session's open work is tracked there:
- §6 P0: repo↔prod migration divergence (task #21 — `20260527000000_qr_digest_search_path_fix.sql` not yet created).
- §6 P1: QR dialog zoom sizing (task #22), live QR-scan prod smoke test, PR #8 squash-merge.
- §6 P2 (also `BACKLOG.md`): `access-keys/page.tsx:39` error-log `{}` masking; duplicated growth-rate plumbing in `dashboard.ts`.

If a future session adds markers, this file diffs them and surfaces resolved/persisted/new.
