---
description: Sync new git activity into the BYOFA Features Notion tracker. Proposes status updates per feature area, applies on user confirm. Invoke via /sync-features-notion.
---

Sync git activity since the last sync into the BYOFA Features Notion tracker.

## State file

`.claude/notion-sync.json` — gitignored. Shape:

```json
{ "lastSyncedSha": "<commit sha>", "lastSyncedAt": "<iso8601>" }
```

If the file is missing, treat the starting point as `HEAD~20` and tell the user this is a first-run fallback.

## Notion target (canonical)

- Page: [BYOFA Features](https://www.notion.so/BYOFA-Features-35fa694147bf8093be2fc57673cee41a)
- Database: **Feature Roadmap Table** — `collection://363a6941-47bf-81d1-9580-000baf6b7dd3`
- **Use the `Status` text property** (`Done` | `Partial` | `Planned` | `Missing`). Do **not** use a `BYOFA` icon column (it does not exist on this database).
- Also update **`What it does`** and **`Next step`** when git activity materially changes shipped behaviour. Align copy with `PROJECT_CONTEXT.md` inventory when available.

### Status mapping (git / PROJECT_CONTEXT → Notion)

| Notion `Status` | When to use |
|-----------------|-------------|
| `Done` | Shipped end-to-end for normal users |
| `Partial` | Real workflow with known gaps, MVP, stub, or scaffold |
| `Planned` | Placeholder / not implemented |
| `Missing` | Removed from repo or explicitly out of scope |

## Steps

1. **Read state.** Load `.claude/notion-sync.json`. If missing → fallback to `HEAD~20` and note this to the user.
2. **List commits.** `git log <lastSyncedSha>..HEAD --pretty=format:"%h %s" --name-only`. If empty: report "Nothing to sync" and stop.
3. **Classify each commit.** Parse conventional-commit scope and changed paths. Map to **Feature** row titles in the roadmap table (see `.cursor/rules/project-context-notion-sync.mdc` inventory → Notion row list).
4. **Fetch current Notion state** for implicated rows only: `notion-search` on `collection://363a6941-47bf-81d1-9580-000baf6b7dd3`, then `notion-fetch` each page for current `Status`, `What it does`, `Next step`.
5. **Propose changes.** Table columns: `Feature | current Status | proposed Status | What it does (if changing) | Next step (if changing) | commits`. Skip rows where nothing changes.
6. **Ask the user to confirm** — present the table and wait. Never auto-apply unless the user explicitly says to apply all. Allow per-row overrides.
7. **Apply** via `notion-update-page` with `command: "update_properties"` and properties such as:
   ```json
   { "Status": "Done", "What it does": "...", "Next step": "..." }
   ```
   Omit properties that should stay unchanged.
8. **Write state.** Update `.claude/notion-sync.json` with `git rev-parse HEAD` and current ISO timestamp.

## Commit → Feature row hints (paths)

| Path / scope | Likely Feature row(s) |
|--------------|------------------------|
| `src/features/dashboard/`, `src/data/dashboard.ts` | Client home dashboard, Monthly spending view, Net worth summary, Long-term projections |
| `src/features/goals/`, housing loans | Housing planning |
| `src/features/planning/`, `src/features/setup/` | Financial setup, Wealth planning, Cash flow planning |
| `src/features/budget/` | Budget lines, Guided budget templates, Cash flow planning |
| `src/features/debts/` | Debt planning |
| `src/features/advisor/` | Advisor client list, Advisor client workspace, Advisor proposal flow |
| `src/features/app-shell/`, consent | Advisor client list, Contact advisor |
| `src/features/onboarding/` | Client onboarding, Guided budget templates |

When ambiguous, ask the user which **Feature** row to update.

## Status heuristics

- `feat`: new capability → `Done` if complete, else `Partial`
- `fix` on row already `Done` → usually keep `Done`; update **What it does** only if behaviour changed
- `refactor` / `chore` / `docs` only → no row update unless inventory changed
- Multi-commit sequence with working end-state → `Done`
- Explicit MVP / stub / scaffold → `Partial`

Never set `Missing` or downgrade `Done` → `Planned` without explicit user instruction.

## Output format

- Range synced: `<old-sha>..<new-sha>` (`<N>` commits)
- Updates applied: count + bullet list (Feature + fields changed)
- Skipped: list with reason
