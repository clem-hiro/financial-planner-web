---
name: trace-flow
description: >
  Trace the forward call chain from an entry point through the layered architecture (UI → server action → repository → supabase). Reads docs/function-tree/function-tree.json. Use to understand which layers a request touches, or to verify a layer boundary is respected.
---

# Trace flow

Forward-walk the call chain from an entry point. Surfaces the layer transitions
(UI → server-action → repository → supabase) that engineering-handbook §4
describes — but derived from the actual code, not the hand-drawn diagram.

Default max depth: 6 hops (deeper than the project's layered architecture warrants).

## Phase 1 — Freshness gate

```bash
npm run map:check 2>&1 | tail -3
```

Stale → stop with the same message as blast-radius. `--allow-stale` to override.

## Phase 2 — Resolve the entry point

Same logic as `$blast-radius` Phase 2 — resolve the user-supplied argument text to a fully-qualified
function ID. Multiple matches → ask which.

## Phase 3 — Walk

BFS forward on the `edges` arrays. For each function ID:

```bash
jq -r --arg id "$ID" '
  .modules[].functions[]
  | select(.id == $id)
  | .edges[]
  | select(.kind == "calls" or .kind == "renders" or .kind == "new")
  | .target // empty
' docs/function-tree/function-tree.json
```

Skip:
- External edges (npm packages — terminal).
- Already-visited IDs (cycles).
- `dynamic-import` edges (they target modules, not functions — note them as a
  comment "dynamically imports M" but don't recurse).

## Phase 4 — Render the trace

Group nodes by root (`src/app` → `src/features` → `src/server` → `src/data` →
`src/domain` → `src/lib` → external) and render as an indented tree. Each node:
`<id>  _(classification)_  [line N]`. Annotate layer transitions with a marker:

```
src/features/expenses/ExpenseForm.tsx#ExpenseForm  _(client-component)_  [L24]
  └─ src/server/actions.ts#createExpense  _(server-action)_  [L82]      ← TRUST BOUNDARY
      └─ src/data/repositories/expenses.ts#insertExpense  _(regular)_   [L15]
          └─ [external] @supabase/auth-js
```

Mark `← TRUST BOUNDARY` when a Client Component calls a Server Action (the
client/server boundary). Mark `← LAYER` when crossing `features → server`,
`server → data`, or `data → domain`.

## Phase 5 — Verdict

- If the trace stays within one root → "**Layer-local.** No cross-layer concerns."
- If it crosses `client-component → server-action` → "**Crosses trust boundary.**
  Server action will re-validate inputs; verify the call site sends Zod-shaped data."
- If it crosses `server-action → data → domain → lib` cleanly → "**Layered as
  expected.** Matches engineering-handbook §4."
- If `data` calls `features` or `domain` calls `data` → "**Layer violation.**
  Inverted dependency direction — flag for refactor."

## Notes

- Walk is purely structural (call edges), not runtime. A function with a
  conditional branch to two repositories will show both branches as edges; the trace
  represents *possible* flow, not *executed* flow.
- For deeply branching trees, cap each level's children at 20 and report
  `+M more` rather than exploding the output.
- Tests as terminal nodes are interesting — if the trace lands in a `.test.ts`,
  surface it: "Reaches test fixture — flow is exercised by `<path>`."
