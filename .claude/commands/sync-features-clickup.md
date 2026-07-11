---
description: Sync new git activity into the BYOFA ClickUp Feature Roadmap list. Proposes status/description updates per feature task; applies on user confirm. Invoke via /sync-features-clickup.
---

Sync git activity since the last sync into the BYOFA ClickUp **Feature Roadmap** list.

## State file

`.claude/clickup-sync.json` — gitignored. Shape:

```json
{ "lastSyncedSha": "<commit sha>", "lastSyncedAt": "<iso8601>" }
```

If the file is missing, treat the starting point as `HEAD~20` and tell the user this is a first-run fallback.

## ClickUp target (canonical)

- **List view:** https://app.clickup.com/90182722727/v/l/6-901818233981-1
- **List ID:** `901818233981`
- **Workspace ID:** `90182722727`
- **MCP server:** `user-clickup`

Field mapping and inventory → task list: `.cursor/rules/project-context-clickup-sync.mdc`.

### Status mapping (git / PROJECT_CONTEXT → ClickUp native status)

| ClickUp status | When to use |
|----------------|-------------|
| `DONE` | Inventory **Shipped** / code implemented in repo — **only** status automation may set for “complete implementation” |
| `NOT STARTED` | Partial, MVP, stub, or scaffold with known gaps |
| `OPEN` | Planned, not implemented, or removed from inventory |

**Manual-only — never propose or apply:** `READY TO TEST`, `TO BE DISCUSSED`, `TESTED`. If a task is already on one of these, skip status in the proposal (description / custom fields may still change).

`DONE` = recognized in `PROJECT_CONTEXT.md`, not QA complete. You move items to `READY TO TEST`; QA moves to `TESTED`.

Also update **description** and custom fields (**What it does**, **Next step**, **Area**, **User Type**, **Priority**) when git activity materially changes shipped behaviour. Align copy with `PROJECT_CONTEXT.md` inventory when available.

## Steps

1. **Read state.** Load `.claude/clickup-sync.json`. If missing → fallback to `HEAD~20` and note this to the user.
2. **List commits.** `git log <lastSyncedSha>..HEAD --pretty=format:"%h %s" --name-only`. If empty: report "Nothing to sync" and stop.
3. **Classify each commit.** Parse conventional-commit scope and changed paths. Map to **Task name** values in the roadmap list (see `.cursor/rules/project-context-clickup-sync.mdc`).
4. **Fetch current ClickUp state** for implicated tasks only: `clickup_filter_tasks` on list `901818233981`, match by task name; use `clickup_get_task` when you need full description or custom fields.
5. **Propose changes.** Table columns: `Task name | current status | proposed status | What it does (if changing) | Next step (if changing) | commits`. Skip rows where nothing changes.
6. **Ask the user to confirm** — present the table and wait. Never auto-apply unless the user explicitly says to apply all. Allow per-row overrides.
7. **Apply** via `clickup_update_task` with `status`, `description`, and `custom_fields` (omit unchanged fields).
8. **Write state.** Update `.claude/clickup-sync.json` with `git rev-parse HEAD` and current ISO timestamp.

## Commit → Task name hints (paths)

| Path / scope | Likely task name(s) |
|--------------|---------------------|
| `src/features/dashboard/`, `src/data/dashboard.ts` | Client home dashboard, Monthly spending view, Net worth summary, Long-term projections |
| `src/features/goals/`, housing loans | Housing planning |
| `src/features/planning/`, `src/features/setup/` | Setup, Wealth planning, Cash flow planning |
| `src/features/budget/` | Budget lines, Guided budget templates, Cash flow planning |
| `src/features/debts/` | Debt planning |
| `src/features/advisor/` | Advisor client list, Advisor client workspace, Advisor proposal flow |
| `src/features/app-shell/`, consent | Advisor client list, Contact advisor |
| `src/features/onboarding/` | Client onboarding, Guided budget templates |

When ambiguous, ask the user which **Task name** to update.

## Status heuristics

- `feat`: new capability → propose `DONE` if inventory Shipped / complete, else `NOT STARTED`
- `fix` on task already `DONE` → usually keep `DONE`; update description only if behaviour changed
- `refactor` / `chore` / `docs` only → no task update unless inventory changed
- Multi-commit sequence with working end-state → `DONE` only when inventory says Shipped
- Explicit MVP / stub / scaffold → `NOT STARTED`
- Task on `READY TO TEST`, `TO BE DISCUSSED`, or `TESTED` → **no status field** in proposal

Never downgrade `DONE` → `OPEN` without explicit user instruction. Never change manual-only statuses without explicit user instruction.

## Output format

- Range synced: `<old-sha>..<new-sha>` (`<N>` commits)
- Updates applied: count + bullet list (Task name + fields changed)
- Skipped: list with reason
