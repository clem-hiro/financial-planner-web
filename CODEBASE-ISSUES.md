# Codebase Issues — 2026-05-20

## Summary
0 TODOs, 0 FIXMEs, 0 HACKs, 0 STUBs, 0 other.

## Changes Since Last Scan
- **Resolved:** 0
- **New:** 0
- **Persisted:** 0

No marker delta. Prior scans (2026-05-18, 2026-05-19) were 0; current scan via
`git grep -nE 'TODO|FIXME|HACK|XXX|WORKAROUND|STUB'` across `src/**` and
`supabase/**` (excluding tests) is still **0**, despite a very large session
(full advisor↔client proposal-workflow redesign + 2 critical remediation
rounds + functional smoke matrix + SSR-hydration fix + 6 hand-applied
migrations + corrective `20260606`). No markers introduced by any of the
new/modified files (proposal feature, hydration delta, migrations).

## Note

Repo convention favors `HANDOFF.md` §6 (P0/P1) + `BACKLOG.md` (P2) +
`LEARNINGS.md` over inline code markers. The substantive items the next
session must act on are not marker-shaped — see `HANDOFF.md` §5/§6:

- **P0**: the entire verified redesign is **uncommitted** (64 working-tree
  files) — commit decision is the user's call (standing "explicit request"
  rule); resurface first.
- **P1**: `origin/main`→`sandbox` back-merge (behind 1); optional mini-chart
  `minHeight` polish (benign Recharts dev-only async-measure noise — the
  documented next-session fine-tweak, NOT the now-fixed hydration bug);
  deferred `[#0c192f]` design-system sweep; the **ESCALATED** (≥8-session,
  now with a confirmed prod incident) no-migration-ledger / shared
  dev+prod Supabase decision; `archive/main-9ff33cc-pre-reset` removal
  (keep until explicit sign-off); the persisted perf/withConsentStatus/
  save-profile/QR/income-tax cluster.
- **Next-session focus**: fine tweaks only — commit/back-merge decisions +
  optional polish + any UX nits on the now-rendering proposal screens.
  Core implementation is done and real-DB + real-browser verified.

If a future session adds markers, this file diffs them (resolved/new/persisted).
