---
name: "source-command-sync-features-notion"
description: "Sync new git activity into the BYOFA Features Notion tracker. Proposes status updates per feature area, applies on user confirm. Invoke via /sync-features-notion."
---

# source-command-sync-features-notion

Use this skill when the user asks to run the migrated source command `sync-features-notion`.

## Command Template

Sync git activity since the last sync into the BYOFA Features Notion tracker.

## State file

`.Codex/notion-sync.json` — gitignored. Shape:

```json
{ "lastSyncedSha": "<commit sha>", "lastSyncedAt": "<iso8601>" }
```

If the file is missing, treat the starting point as `HEAD~20` and tell the user this is a first-run fallback.

## Steps

1. **Read state.** Load `.Codex/notion-sync.json`. If missing → fallback to `HEAD~20` and note this to the user.
2. **List commits.** `git log <lastSyncedSha>..HEAD --pretty=format:"%h %s" --name-only`. If empty: report "Nothing to sync" and stop.
3. **Classify each commit.** Parse conventional-commit scope (`feat(scope):`, `fix(scope):`, etc.) and changed paths. Use the mapping below to identify which Notion database + which Feature Area row is implicated.
4. **Fetch current Notion state for implicated rows only.** Use `notion-search` with the row's `data_source_url` + the Feature Area name. Then `notion-fetch` on each hit to see the current `BYOFA` value.
5. **Propose changes.** Build a table: `database | feature area | current BYOFA | proposed BYOFA | reasoning (commit refs)`. Skip rows where current = proposed.
6. **Ask the user to confirm** — present the table and wait. Never auto-apply. Allow per-row override (e.g. "skip Auth, apply rest").
7. **Apply via `notion-update-page`** with `command: "update_properties"` and `properties: {"BYOFA": "<icon>"}`.
8. **Write state.** Update `.Codex/notion-sync.json` with the new HEAD SHA and current timestamp. Use `git rev-parse HEAD`.

## Mapping: commit scope / path → Notion database + area

Reference for first-pass classification. When ambiguous, ASK the user — don't guess.

| Commit scope / path prefix | Notion database | Likely Feature Area row |
|---|---|---|
| `auth`, `src/features/auth/`, `src/app/auth/`, `src/app/login/` | Core Platform | Auth |
| `app-shell`, `src/features/app-shell/` | Core Platform | (ask — multiple candidates) |
| `dashboard`, `src/features/dashboard/` | Dashboard / Home | (ask) |
| `planning`, `src/features/planning/`, `src/features/setup/` | Planning Workspace | (ask) |
| `expenses`, `spend`, `budget`, `src/features/expenses/`, `src/features/spend/`, `src/features/budget/` | Expenses & Activity | (ask) |
| `goals`, `src/features/goals/` | Goals & Future | (ask) |
| `advisor`, `src/features/advisor/` | Advisor Workspace | (ask) |
| `onboarding`, `help`, `src/features/onboarding/`, `src/features/help/` | Core Platform | (ask — could be Onboarding, Help, etc.) |
| AI-related work (chat, LLM, embeddings) | AI / Intelligence Layer | (ask) |

If a commit's scope isn't in this table, ask the user which database+row it maps to.

## Status icon heuristics

These are starting suggestions only — always confirm with the user.

- `feat(scope): add <new thing>` on a row currently ⚪ or ❌ → suggest ✅
- `feat(scope): add <partial>` → suggest 🟡 unless the user signals completion
- `fix(scope): ...` on a row currently ✅ → no change (suggest no update)
- `refactor(scope): ...` → no change
- Multi-commit sequence where final state is "working end-to-end" → ✅
- Commit explicitly says "MVP", "stub", "scaffold" → 🟡

Never auto-flip ✅ → ❌ or apply 🔥 (competitive advantage) without an explicit user instruction.

## Page reference

- Page: https://www.notion.so/BYOFA-Features-35fa694147bf8093be2fc57673cee41a
- Memory: `byofa-features-notion-tracker.md` has the full database list and schema. Read it for the data-source-urls.

## Output format

Final message should include:
- Range synced: `<old-sha>..<new-sha>` (`<N>` commits)
- Updates applied: count + bullet list
- Skipped / asked-about: list with reason
